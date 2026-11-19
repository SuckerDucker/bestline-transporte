import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EstadoServicio } from '../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { MonitoreoService, totalesPorEstado } from './monitoreo.service.js';

const FECHA = '2026-11-10';
const AHORA = new Date('2026-11-10T19:00:00Z'); // 14:00 en Cancún
const COORDINADOR: UsuarioAutenticado = { id: 4, rol: 'COORDINADOR' };
const OPERADOR: UsuarioAutenticado = { id: 6, rol: 'OPERADOR' };

const servicio = (id: number, hora: string, estado: EstadoServicio) => ({
  id,
  folio: `NEX-${id}`,
  estado,
  fechaHora: new Date(`2026-11-10T${hora}:00Z`),
  pasajeros: 4,
  zonaOrigen: { id: 1, nombre: 'Aeropuerto CUN' },
  zonaDestino: { id: 2, nombre: 'Zona Hotelera' },
  hotel: null,
  mayorista: { id: 2, nombre: 'Nexus Tours' },
  _count: { incidencias: id === 2 ? 1 : 0 },
});
const asignacion = (
  id: number,
  s: ReturnType<typeof servicio>,
  operadorId = 1,
) => ({
  id: 100 + id,
  servicioId: s.id,
  orden: id,
  inicioEfectivo: new Date(s.fechaHora.getTime() - 10 * 60_000),
  liberacion: new Date(s.fechaHora.getTime() + 30 * 60_000),
  vehiculo: {
    id: operadorId,
    numeroEconomico: `BL-0${operadorId}`,
    tipo: 'Van',
  },
  operador: {
    id: operadorId,
    nombre: `Operador ${operadorId}`,
    usuarioId: operadorId === 1 ? 6 : null,
  },
  servicio: s,
});
const ROL = {
  id: 16,
  estado: 'AUTORIZADO',
  autorizadoEn: new Date('2026-11-09T22:00:00Z'),
  asignaciones: [
    // 18:00Z ya pasó y sigue PROGRAMADO → retrasado
    asignacion(1, servicio(1, '18:00', 'PROGRAMADO')),
    asignacion(2, servicio(2, '18:30', 'EN_RUTA')),
    // 20:00Z todavía no llega → no está retrasado
    asignacion(3, servicio(3, '20:00', 'PROGRAMADO'), 2),
  ],
};

/** Servicio con su asignación autorizada, como lo lee cambiarEstado. */
const conAsignacion = (
  estado: EstadoServicio,
  usuarioId: number | null = 6,
) => ({
  id: 12,
  folio: 'NEX-0012',
  estado,
  asignaciones: [{ id: 301, operador: { usuarioId } }],
});

describe('MonitoreoService', () => {
  let prisma: PrismaSimulado;
  let servicioMonitoreo: MonitoreoService;

  beforeEach(() => {
    jest.useFakeTimers({ now: AHORA, doNotFake: ['nextTick', 'setImmediate'] });
    prisma = crearPrismaSimulado();
    servicioMonitoreo = new MonitoreoService(comoPrisma(prisma));
  });
  afterEach(() => jest.useRealTimers());

  describe('tablero', () => {
    it('trae los servicios con unidad, operador, incidencias, retrasado y totales por estado', async () => {
      prisma.rolDiario.findUnique.mockResolvedValue(ROL);

      const t = await servicioMonitoreo.tablero(FECHA);

      expect(t.rol).toEqual({
        id: 16,
        estado: 'AUTORIZADO',
        autorizadoEn: ROL.autorizadoEn,
      });
      expect(
        t.servicios.map((s) => [
          s.servicio.folio,
          s.vehiculo.numeroEconomico,
          s.retrasado,
          s.incidencias,
        ]),
      ).toEqual([
        ['NEX-1', 'BL-01', true, 0],
        ['NEX-2', 'BL-01', false, 1],
        ['NEX-3', 'BL-02', false, 0],
      ]);
      // El operador no expone su usuarioId.
      expect(t.servicios[0].operador).toEqual({ id: 1, nombre: 'Operador 1' });
      expect(t.totales).toEqual({
        total: 3,
        retrasados: 1,
        porEstado: {
          PROGRAMADO: 2,
          EN_RUTA: 1,
          EN_SERVICIO: 0,
          COMPLETADO: 0,
          CANCELADO: 0,
          NO_SHOW: 0,
        },
      });
    });

    it('404 si no hay rol o si el rol sigue PROPUESTO', async () => {
      prisma.rolDiario.findUnique.mockResolvedValueOnce(null);
      await expect(servicioMonitoreo.tablero(FECHA)).rejects.toThrow(
        new NotFoundException(`No hay rol autorizado del ${FECHA}`),
      );
      prisma.rolDiario.findUnique.mockResolvedValueOnce({
        ...ROL,
        estado: 'PROPUESTO',
      });
      await expect(servicioMonitoreo.tablero(FECHA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('misServicios', () => {
    it('busca el operador del usuario y filtra el rol por ese operador, en orden de inicio', async () => {
      prisma.operador.findUnique.mockResolvedValue({
        id: 1,
        nombre: 'José Hernández',
        horaCita: '04:00',
        vehiculo: { id: 1, numeroEconomico: 'BL-01', tipo: 'Van' },
      });
      prisma.rolDiario.findUnique.mockResolvedValue({
        ...ROL,
        asignaciones: [ROL.asignaciones[1], ROL.asignaciones[0]],
      });

      const r = await servicioMonitoreo.misServicios(FECHA, OPERADOR);

      expect(prisma.operador.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: 6 } }),
      );
      const consulta = prisma.rolDiario.findUnique.mock.calls[0][0] as {
        include: { asignaciones: { where: unknown } };
      };
      expect(consulta.include.asignaciones.where).toEqual({ operadorId: 1 });
      expect(r.operador).toEqual({
        id: 1,
        nombre: 'José Hernández',
        horaCita: '04:00',
      });
      expect(r.servicios.map((s) => s.servicio.folio)).toEqual([
        'NEX-1',
        'NEX-2',
      ]);
    });

    it('404 si el usuario no está ligado a un operador', async () => {
      prisma.operador.findUnique.mockResolvedValue(null);
      await expect(
        servicioMonitoreo.misServicios(FECHA, OPERADOR),
      ).rejects.toThrow(
        new NotFoundException('Tu usuario no está ligado a un operador'),
      );
    });
  });

  describe('cambiarEstado', () => {
    beforeEach(() => {
      prisma.servicio.updateMany.mockResolvedValue({ count: 1 });
      prisma.servicio.findUniqueOrThrow.mockResolvedValue({ id: 12 });
    });

    it('PROGRAMADO → EN_RUTA: actualiza condicionado al estado leído, guarda inicioReal y registra bitácora con la nota', async () => {
      prisma.servicio.findUnique.mockResolvedValue(conAsignacion('PROGRAMADO'));

      await servicioMonitoreo.cambiarEstado(
        12,
        { estado: 'EN_RUTA', nota: 'Sale tarde' },
        COORDINADOR,
      );

      expect(prisma.servicio.updateMany).toHaveBeenCalledWith({
        where: { id: 12, estado: 'PROGRAMADO' },
        data: { estado: 'EN_RUTA', inicioReal: AHORA },
      });
      expect(prisma.bitacora.create).toHaveBeenCalledWith({
        data: {
          usuarioId: 4,
          accion: 'CAMBIAR_ESTADO: NEX-0012: PROGRAMADO → EN_RUTA · Sale tarde',
          entidad: 'servicio',
          entidadId: 12,
        },
      });
    });

    it('EN_SERVICIO → COMPLETADO guarda terminoReal', async () => {
      prisma.servicio.findUnique.mockResolvedValue(
        conAsignacion('EN_SERVICIO'),
      );
      await servicioMonitoreo.cambiarEstado(
        12,
        { estado: 'COMPLETADO' },
        OPERADOR,
      );
      expect(prisma.servicio.updateMany).toHaveBeenCalledWith({
        where: { id: 12, estado: 'EN_SERVICIO' },
        data: { estado: 'COMPLETADO', terminoReal: AHORA },
      });
    });

    it('la acción de bitácora no pasa de 255 caracteres', async () => {
      prisma.servicio.findUnique.mockResolvedValue(conAsignacion('PROGRAMADO'));
      await servicioMonitoreo.cambiarEstado(
        12,
        { estado: 'CANCELADO', nota: 'x'.repeat(150) },
        COORDINADOR,
      );
      const { data } = prisma.bitacora.create.mock.calls[0][0] as {
        data: { accion: string };
      };
      expect(data.accion.length).toBeLessThanOrEqual(255);
    });

    it('400 con transición inválida y no cambia nada', async () => {
      prisma.servicio.findUnique.mockResolvedValue(conAsignacion('COMPLETADO'));
      await expect(
        servicioMonitoreo.cambiarEstado(12, { estado: 'EN_RUTA' }, COORDINADOR),
      ).rejects.toThrow(
        new BadRequestException('No se puede pasar de COMPLETADO a EN_RUTA'),
      );
      expect(prisma.servicio.updateMany).not.toHaveBeenCalled();
      expect(prisma.bitacora.create).not.toHaveBeenCalled();
    });

    it('OPERADOR: 403 en un servicio ajeno (antes de revisar la transición)', async () => {
      prisma.servicio.findUnique.mockResolvedValue(
        conAsignacion('COMPLETADO', 99),
      );
      await expect(
        servicioMonitoreo.cambiarEstado(12, { estado: 'EN_RUTA' }, OPERADOR),
      ).rejects.toThrow(
        new ForbiddenException('Solo puedes actualizar tus servicios'),
      );
      expect(prisma.servicio.updateMany).not.toHaveBeenCalled();
    });

    it('OPERADOR: 403 si pide CANCELADO o NO_SHOW en su servicio', async () => {
      prisma.servicio.findUnique.mockResolvedValue(conAsignacion('PROGRAMADO'));
      await expect(
        servicioMonitoreo.cambiarEstado(12, { estado: 'NO_SHOW' }, OPERADOR),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404 si el servicio no existe y 400 si no está en un rol autorizado', async () => {
      prisma.servicio.findUnique.mockResolvedValueOnce(null);
      await expect(
        servicioMonitoreo.cambiarEstado(99, { estado: 'EN_RUTA' }, COORDINADOR),
      ).rejects.toThrow(new NotFoundException('Servicio no encontrado'));
      prisma.servicio.findUnique.mockResolvedValueOnce({
        ...conAsignacion('PENDIENTE'),
        asignaciones: [],
      });
      await expect(
        servicioMonitoreo.cambiarEstado(12, { estado: 'EN_RUTA' }, COORDINADOR),
      ).rejects.toThrow(
        new BadRequestException(
          'El servicio NEX-0012 no está asignado en un rol autorizado',
        ),
      );
    });

    it('409 si otro usuario cambió el estado entre la lectura y la escritura', async () => {
      prisma.servicio.findUnique.mockResolvedValue(conAsignacion('PROGRAMADO'));
      prisma.servicio.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        servicioMonitoreo.cambiarEstado(12, { estado: 'EN_RUTA' }, COORDINADOR),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.bitacora.create).not.toHaveBeenCalled();
    });
  });

  describe('incidencias', () => {
    it('registra la incidencia con la descripción recortada y bitácora CREAR', async () => {
      prisma.servicio.findUnique.mockResolvedValue(conAsignacion('EN_RUTA'));
      prisma.incidencia.create.mockResolvedValue({ id: 7 });

      await servicioMonitoreo.registrarIncidencia(
        12,
        { tipo: 'RETRASO', descripcion: '  Vuelo demorado  ' },
        COORDINADOR,
      );

      expect(prisma.incidencia.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            servicioId: 12,
            usuarioId: 4,
            tipo: 'RETRASO',
            descripcion: 'Vuelo demorado',
          },
        }),
      );
      expect(prisma.bitacora.create).toHaveBeenCalledWith({
        data: {
          usuarioId: 4,
          accion: 'CREAR: NEX-0012: RETRASO',
          entidad: 'incidencia',
          entidadId: 7,
        },
      });
    });

    it('400 si la descripción solo tiene espacios', async () => {
      prisma.servicio.findUnique.mockResolvedValue(conAsignacion('EN_RUTA'));
      await expect(
        servicioMonitoreo.registrarIncidencia(
          12,
          { tipo: 'OTRO', descripcion: '   ' },
          COORDINADOR,
        ),
      ).rejects.toThrow(new BadRequestException('descripcion es obligatoria'));
    });

    it('lista las del día con su unidad', async () => {
      prisma.rolDiario.findUnique.mockResolvedValue(ROL);
      prisma.incidencia.findMany.mockResolvedValue([
        {
          id: 7,
          tipo: 'RETRASO',
          servicio: {
            id: 2,
            folio: 'NEX-2',
            asignaciones: [{ vehiculo: { id: 1, numeroEconomico: 'BL-01' } }],
          },
        },
      ]);

      const lista = await servicioMonitoreo.incidenciasDelDia(FECHA);

      expect(prisma.incidencia.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { servicioId: { in: [1, 2, 3] } } }),
      );
      expect(lista).toEqual([
        {
          id: 7,
          tipo: 'RETRASO',
          servicio: { id: 2, folio: 'NEX-2' },
          vehiculo: { id: 1, numeroEconomico: 'BL-01' },
        },
      ]);
    });
  });
});

describe('totalesPorEstado', () => {
  it('cuenta en 0 los estados sin servicios', () => {
    expect(totalesPorEstado([])).toEqual({
      total: 0,
      retrasados: 0,
      porEstado: {
        PROGRAMADO: 0,
        EN_RUTA: 0,
        EN_SERVICIO: 0,
        COMPLETADO: 0,
        CANCELADO: 0,
        NO_SHOW: 0,
      },
    });
  });
});
