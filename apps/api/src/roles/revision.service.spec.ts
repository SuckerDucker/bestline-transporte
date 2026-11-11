import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { aInstante } from './conversion.js';
import { RevisionService } from './revision.service.js';

// Escenario pequeño (horas en minutos desde las 00:00 de Cancún del 10/11):
// BL-01: S-1 05:00 y S-2 07:00; BL-02: S-3 05:10; BL-04 en mantenimiento.
// No cubiertos: S-4 (30 pasajeros, CAPACIDAD) y S-5 10:00 (EMPALME).
// Todos son PRIVADO de Aeropuerto CUN a Zona Hotelera (30 min); encierro Centro.
const USUARIO = 2;
const FECHA = '2026-11-10';
const INICIO_DIA = new Date('2026-11-10T05:00:00Z');
const CUN = 1;
const ZH = 2;
const CENTRO = 3;
const a = (minutos: number) => aInstante(INICIO_DIA, minutos);

const PARAMETROS = [
  ['jornada_maxima_horas', '9.5'],
  ['anticipacion.PRIVADO', '10'],
  ['anticipacion.COMPARTIDO', '20'],
  ['anticipacion.GRUPO', '30'],
  ['motor.penalizacion_carga_min', '15'],
].map(([clave, valor]) => ({ clave, valor }));
const ZONAS = [
  { id: CUN, nombre: 'Aeropuerto CUN', esZonaTermino: true },
  { id: ZH, nombre: 'Zona Hotelera', esZonaTermino: true },
  { id: CENTRO, nombre: 'Centro Cancún', esZonaTermino: false },
];
const MATRIZ = ZONAS.flatMap((o) =>
  ZONAS.map((d) => ({
    zonaOrigenId: o.id,
    zonaDestinoId: d.id,
    minutos: o.id === d.id ? 10 : 30,
  })),
);
const vehiculo = (n: number, cambios: Record<string, unknown> = {}) => ({
  id: n,
  numeroEconomico: `BL-0${n}`,
  capacidad: 14,
  estado: 'DISPONIBLE',
  encierroBase: 'Centro Cancún',
  operador: { id: 100 + n, disponible: true, horaCita: '04:00' },
  ...cambios,
});
const servicio = (id: number, hora: number, pasajeros = 4) => ({
  id,
  folio: `S-${id}`,
  fechaHora: a(hora),
  modalidad: 'PRIVADO',
  pasajeros,
  zonaOrigenId: CUN,
  zonaDestinoId: ZH,
});
/** Asignación guardada: inicio = hora − 10, liberación = hora + 30. */
const asignacion = (
  id: number,
  vehiculoId: number,
  orden: number,
  s: ReturnType<typeof servicio>,
) => {
  const hora = (s.fechaHora.getTime() - INICIO_DIA.getTime()) / 60_000;
  return {
    id,
    rolId: 7,
    servicioId: s.id,
    vehiculoId,
    operadorId: 100 + vehiculoId,
    orden,
    inicioEfectivo: a(hora - 10),
    liberacion: a(hora + 30),
    servicio: s,
  };
};
const S1 = servicio(1, 300);
const S2 = servicio(2, 420);
const S3 = servicio(3, 310);
const S4 = servicio(4, 540, 30);
const S5 = servicio(5, 600);

describe('RevisionService', () => {
  let prisma: PrismaSimulado;
  let revision: RevisionService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    revision = new RevisionService(comoPrisma(prisma));
    prisma.rolDiario.findUnique.mockResolvedValue({ id: 7 });
    prisma.$queryRaw.mockResolvedValue([{ id: 7, estado: 'PROPUESTO' }]);
    prisma.asignacion.findMany.mockResolvedValue([
      asignacion(11, 1, 1, S1),
      asignacion(12, 1, 2, S2),
      asignacion(21, 2, 1, S3),
    ]);
    prisma.servicioNoCubierto.findMany.mockResolvedValue([
      { id: 41, rolId: 7, servicioId: 4, motivo: 'CAPACIDAD', servicio: S4 },
      { id: 51, rolId: 7, servicioId: 5, motivo: 'EMPALME', servicio: S5 },
    ]);
    prisma.vehiculo.findMany.mockResolvedValue([
      vehiculo(1),
      vehiculo(2),
      vehiculo(4, { estado: 'MANTENIMIENTO' }),
    ]);
    prisma.zona.findMany.mockResolvedValue(ZONAS);
    prisma.tiempoTraslado.findMany.mockResolvedValue(MATRIZ);
    prisma.parametroOperacion.findMany.mockResolvedValue(PARAMETROS);
    prisma.asignacion.update.mockImplementation(
      async (arg: unknown) => (arg as { data: object }).data,
    );
    prisma.asignacion.create.mockImplementation(async (arg: unknown) => ({
      id: 60,
      ...(arg as { data: object }).data,
    }));
    prisma.rolDiario.update.mockImplementation(async (arg: unknown) => ({
      id: 7,
      ...(arg as { data: object }).data,
    }));
    prisma.servicio.updateMany.mockResolvedValue({ count: 3 });
  });

  /** Órdenes que quedaron por servicio después de renumerar. */
  const ordenes = () =>
    Object.fromEntries(
      (
        prisma.asignacion.updateMany.mock.calls as [
          { where: { servicioId: number }; data: { orden: number } },
        ][]
      ).map(([arg]) => [arg.where.servicioId, arg.data.orden]),
    );
  const bitacora = () =>
    (
      prisma.bitacora.create.mock.calls[0] as [
        { data: { accion: string; entidad: string; entidadId: number } },
      ]
    )[0].data;

  describe('opciones', () => {
    it('marca la unidad actual, da motivo a las inválidas y ordena primero las válidas', async () => {
      const opciones = await revision.opciones(FECHA, 2);

      expect(opciones).toEqual([
        {
          vehiculoId: 2,
          numeroEconomico: 'BL-02',
          capacidad: 14,
          actual: false,
          valido: true,
          posicion: 2,
        },
        {
          vehiculoId: 1,
          numeroEconomico: 'BL-01',
          capacidad: 14,
          actual: true,
          valido: false,
          detalle: 'Es la unidad actual del servicio',
        },
        expect.objectContaining({
          numeroEconomico: 'BL-04',
          valido: false,
          motivo: 'DISPONIBILIDAD',
        }),
      ]);
    });

    it('un no cubierto no tiene unidad actual; CAPACIDAD en todas si no cabe', async () => {
      const opciones = await revision.opciones(FECHA, 4);
      expect(opciones.every((o) => !o.actual && !o.valido)).toBe(true);
      expect(opciones.find((o) => o.vehiculoId === 1)).toMatchObject({
        motivo: 'CAPACIDAD',
        detalle: 'S-4 lleva 30 pasajeros y BL-01 tiene capacidad para 14',
      });
    });

    it('404 si no hay rol o el servicio no es del rol', async () => {
      await expect(revision.opciones(FECHA, 999)).rejects.toThrow(
        'El servicio 999 no es del rol del 2026-11-10',
      );
      prisma.rolDiario.findUnique.mockResolvedValue(null);
      await expect(revision.opciones(FECHA, 2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('mover', () => {
    it('mueve S-2 de BL-01 a BL-02: bloquea, actualiza, renumera ambas y registra en la bitácora', async () => {
      const resultado = await revision.mover(FECHA, 12, 2, USUARIO);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.asignacion.update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: {
          vehiculoId: 2,
          operadorId: 102,
          inicioEfectivo: a(410),
          liberacion: a(450),
        },
      });
      // Destino BL-02: S-3, S-2. Origen BL-01: S-1.
      expect(ordenes()).toEqual({ 3: 1, 2: 2, 1: 1 });
      expect(bitacora()).toMatchObject({
        accion: 'ACTUALIZAR: 2026-11-10: S-2 de BL-01 a BL-02',
        entidad: 'asignacion',
        entidadId: 12,
      });
      expect(resultado).toMatchObject({
        asignacion: { orden: 2 },
        de: 'BL-01',
        a: 'BL-02',
      });
    });

    it('400 con motivo y detalle si se empalma; no guarda nada', async () => {
      // S-1 (05:00) antes de S-3 (05:10) en BL-02: libera 05:30 y no llega.
      await expect(revision.mover(FECHA, 11, 2, USUARIO)).rejects.toMatchObject(
        {
          response: expect.objectContaining({
            motivo: 'EMPALME',
            detalle: 'Empalma con el servicio S-3 de 05:10 en BL-02',
          }),
        },
      );
      expect(prisma.asignacion.update).not.toHaveBeenCalled();
      expect(prisma.bitacora.create).not.toHaveBeenCalled();
    });

    it('400 si ya está en esa unidad', async () => {
      await expect(revision.mover(FECHA, 12, 1, USUARIO)).rejects.toThrow(
        'El servicio S-2 ya está en BL-01',
      );
    });

    it('DISPONIBILIDAD si la unidad no participa o el vehículo no tiene operador; 404 si no existe', async () => {
      await expect(revision.mover(FECHA, 12, 4, USUARIO)).rejects.toMatchObject(
        { response: expect.objectContaining({ motivo: 'DISPONIBILIDAD' }) },
      );
      prisma.vehiculo.findUnique.mockResolvedValueOnce(
        vehiculo(3, { operador: null }),
      );
      await expect(revision.mover(FECHA, 12, 3, USUARIO)).rejects.toMatchObject(
        {
          response: expect.objectContaining({
            motivo: 'DISPONIBILIDAD',
            detalle: 'BL-03 no tiene operador asignado',
          }),
        },
      );
      prisma.vehiculo.findUnique.mockResolvedValueOnce(null);
      await expect(revision.mover(FECHA, 12, 99, USUARIO)).rejects.toThrow(
        'No existe el vehículo 99',
      );
    });

    it('404 si la asignación no es del rol; 409 si el rol está AUTORIZADO', async () => {
      await expect(revision.mover(FECHA, 999, 2, USUARIO)).rejects.toThrow(
        NotFoundException,
      );
      prisma.$queryRaw.mockResolvedValue([{ id: 7, estado: 'AUTORIZADO' }]);
      await expect(revision.mover(FECHA, 12, 2, USUARIO)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.asignacion.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('asignarNoCubierto', () => {
    it('asigna S-5 a BL-02: quita el no cubierto, crea la asignación en orden 2 y registra CREAR', async () => {
      const resultado = await revision.asignarNoCubierto(FECHA, 5, 2, USUARIO);

      expect(prisma.servicioNoCubierto.delete).toHaveBeenCalledWith({
        where: { id: 51 },
      });
      expect(prisma.asignacion.create).toHaveBeenCalledWith({
        data: {
          rolId: 7,
          servicioId: 5,
          vehiculoId: 2,
          operadorId: 102,
          orden: 2,
          inicioEfectivo: a(590),
          liberacion: a(630),
        },
      });
      expect(ordenes()).toEqual({ 3: 1, 5: 2 });
      expect(bitacora()).toMatchObject({
        accion: 'CREAR: 2026-11-10: S-5 (no cubierto por EMPALME) a BL-02',
        entidad: 'asignacion',
        entidadId: 60,
      });
      expect(resultado.a).toBe('BL-02');
    });

    it('400 CAPACIDAD sin tocar los no cubiertos; 404 si no es un no cubierto', async () => {
      await expect(
        revision.asignarNoCubierto(FECHA, 4, 1, USUARIO),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ motivo: 'CAPACIDAD' }),
      });
      expect(prisma.servicioNoCubierto.delete).not.toHaveBeenCalled();
      await expect(
        revision.asignarNoCubierto(FECHA, 2, 1, USUARIO),
      ).rejects.toThrow(
        'El servicio 2 no está en los no cubiertos del rol del 2026-11-10',
      );
    });
  });

  describe('autorizar', () => {
    it('corre el verificador y, si pasa, autoriza con usuario y fecha y programa los asignados', async () => {
      const resultado = await revision.autorizar(FECHA, USUARIO);

      expect(prisma.rolDiario.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: {
          estado: 'AUTORIZADO',
          autorizadoPor: USUARIO,
          autorizadoEn: expect.any(Date),
        },
      });
      expect(prisma.servicio.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
        data: { estado: 'PROGRAMADO' },
      });
      expect(bitacora()).toMatchObject({
        accion: 'AUTORIZAR: 2026-11-10: 3 servicios PROGRAMADO, 2 no cubiertos',
        entidad: 'rol_diario',
        entidadId: 7,
      });
      expect(resultado).toMatchObject({ programados: 3, noCubiertos: 2 });
    });

    it('400 con las violaciones si lo guardado no pasa el verificador; no autoriza', async () => {
      // S-3 guardado en BL-01 entre S-1 y S-2: se empalma con S-1.
      prisma.asignacion.findMany.mockResolvedValue([
        asignacion(11, 1, 1, S1),
        asignacion(21, 1, 2, S3),
        asignacion(12, 1, 3, S2),
      ]);
      let error: unknown;
      try {
        await revision.autorizar(FECHA, USUARIO);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(BadRequestException);
      const respuesta = (error as BadRequestException).getResponse() as {
        violaciones: string[];
      };
      expect(respuesta.violaciones).toEqual(
        expect.arrayContaining([expect.stringMatching(/S-3.*EMPALME/)]),
      );
      expect(prisma.rolDiario.update).not.toHaveBeenCalled();
      expect(prisma.servicio.updateMany).not.toHaveBeenCalled();
    });

    it('409 si ya está AUTORIZADO; 404 si no hay rol', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 7, estado: 'AUTORIZADO' }]);
      await expect(revision.autorizar(FECHA, USUARIO)).rejects.toThrow(
        ConflictException,
      );
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(revision.autorizar(FECHA, USUARIO)).rejects.toThrow(
        'No hay rol del 2026-11-10',
      );
    });
  });
});
