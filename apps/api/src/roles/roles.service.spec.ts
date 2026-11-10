import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  errorPrisma,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { aInstante, aMinutos, horaAMinutos } from './conversion.js';
import { RolesService } from './roles.service.js';

const USUARIO = 1;
const FECHA = '2026-11-10';
const INICIO_DIA = new Date('2026-11-10T05:00:00Z');
const CUN = 1;
const ZH = 2;
const CENTRO = 3;

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
const matrizCompleta = () =>
  ZONAS.flatMap((o) =>
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
  encierroBase: 'centro cancún',
  operador: { id: 100 + n, disponible: true, horaCita: '04:00' },
  ...cambios,
});
const servicio = (id: number, minutos: number, pasajeros = 4) => ({
  id,
  folio: `S-${id}`,
  fechaHora: new Date(INICIO_DIA.getTime() + minutos * 60_000),
  modalidad: 'PRIVADO',
  pasajeros,
  zonaOrigenId: CUN,
  zonaDestinoId: ZH,
});

describe('conversión de horas', () => {
  it('convierte entre HH:mm, minutos e instantes', () => {
    expect(horaAMinutos('04:30')).toBe(270);
    const instante = aInstante(INICIO_DIA, 375);
    expect(instante.toISOString()).toBe('2026-11-10T11:15:00.000Z');
    expect(aMinutos(INICIO_DIA, instante)).toBe(375);
  });
});

describe('RolesService', () => {
  let prisma: PrismaSimulado;
  let servicio_: RolesService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio_ = new RolesService(comoPrisma(prisma));
    prisma.rolDiario.findUnique.mockResolvedValue(null);
    prisma.rolDiario.create.mockResolvedValue({ id: 7, estado: 'PROPUESTO' });
    prisma.rolDiario.update.mockResolvedValue({ id: 7, estado: 'PROPUESTO' });
    prisma.servicio.findMany.mockResolvedValue([
      servicio(1, 300),
      servicio(2, 600, 30),
    ]);
    prisma.vehiculo.findMany.mockResolvedValue([
      vehiculo(1),
      vehiculo(2, { estado: 'MANTENIMIENTO' }),
    ]);
    prisma.zona.findMany.mockResolvedValue(ZONAS);
    prisma.tiempoTraslado.findMany.mockResolvedValue(matrizCompleta());
    prisma.parametroOperacion.findMany.mockResolvedValue(PARAMETROS);
  });

  describe('generar', () => {
    it('guarda en una transacción el rol, las asignaciones, los no cubiertos y la bitácora', async () => {
      const resultado = await servicio_.generar(FECHA, USUARIO);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.rolDiario.create).toHaveBeenCalledWith({
        data: { fecha: new Date('2026-11-10T00:00:00Z'), estado: 'PROPUESTO' },
      });
      // S-1 a las 05:00 de Cancún (minuto 300): inicio 04:50 y liberación 05:30
      // (+30 min de CUN a ZH), en BL-01, cuyo operador tiene cita a las 04:00.
      expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
        data: [
          {
            rolId: 7,
            servicioId: 1,
            vehiculoId: 1,
            operadorId: 101,
            orden: 1,
            inicioEfectivo: new Date('2026-11-10T09:50:00Z'),
            liberacion: new Date('2026-11-10T10:30:00Z'),
          },
        ],
      });
      expect(prisma.servicioNoCubierto.createMany).toHaveBeenCalledWith({
        data: [{ rolId: 7, servicioId: 2, motivo: 'CAPACIDAD' }],
      });
      const [{ data }] = prisma.bitacora.create.mock.calls[0] as [
        { data: { accion: string; entidad: string } },
      ];
      expect(data.entidad).toBe('rol_diario');
      expect(data.accion).toMatch(
        /^CREAR: 2026-11-10: 1 asignados, 1 no cubiertos, \d+ ms$/,
      );
      expect(resultado).toMatchObject({
        reemplazado: false,
        resumen: {
          servicios: 2,
          asignados: 1,
          noCubiertos: 1,
          unidadesDisponibles: 1,
          unidadesUsadas: 1,
          porMotivo: { CAPACIDAD: 1, SIN_UNIDAD: 0 },
        },
      });
      // Solo los servicios PENDIENTE del día de Cancún.
      expect(prisma.servicio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            estado: 'PENDIENTE',
            fechaHora: {
              gte: INICIO_DIA,
              lt: new Date('2026-11-11T05:00:00Z'),
            },
          },
        }),
      );
    });

    it('reemplaza un rol PROPUESTO dentro de la misma transacción', async () => {
      prisma.rolDiario.findUnique.mockResolvedValue({
        id: 7,
        estado: 'PROPUESTO',
      });

      const resultado = await servicio_.generar(FECHA, USUARIO);

      expect(prisma.asignacion.deleteMany).toHaveBeenCalledWith({
        where: { rolId: 7 },
      });
      expect(prisma.servicioNoCubierto.deleteMany).toHaveBeenCalledWith({
        where: { rolId: 7 },
      });
      expect(prisma.rolDiario.create).not.toHaveBeenCalled();
      expect(resultado?.reemplazado).toBe(true);
      const [{ data }] = prisma.bitacora.create.mock.calls[0] as [
        { data: { accion: string } },
      ];
      expect(data.accion).toMatch(/^ACTUALIZAR: /);
    });

    it('409 si el rol ya está AUTORIZADO', async () => {
      prisma.rolDiario.findUnique.mockResolvedValue({
        id: 7,
        estado: 'AUTORIZADO',
      });
      await expect(servicio_.generar(FECHA, USUARIO)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 si no hay servicios PENDIENTE', async () => {
      prisma.servicio.findMany.mockResolvedValue([]);
      await expect(servicio_.generar(FECHA, USUARIO)).rejects.toThrow(
        'No hay servicios PENDIENTE el 2026-11-10',
      );
    });

    it('400 si la matriz no tiene un tiempo necesario, con la lista de faltantes', async () => {
      prisma.tiempoTraslado.findMany.mockResolvedValue(
        matrizCompleta().filter(
          (t) => !(t.zonaOrigenId === CENTRO && t.zonaDestinoId === CUN),
        ),
      );
      let respuesta: unknown;
      try {
        await servicio_.generar(FECHA, USUARIO);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        respuesta = (error as BadRequestException).getResponse();
      }
      expect(respuesta).toMatchObject({
        message: 'La matriz de tiempos está incompleta: faltan 1 combinaciones',
        faltantes: ['Centro Cancún → Aeropuerto CUN'],
      });
    });

    it('400 si falta un parámetro o el encierro de una unidad no es una zona', async () => {
      prisma.parametroOperacion.findMany.mockResolvedValue(PARAMETROS.slice(1));
      await expect(servicio_.generar(FECHA, USUARIO)).rejects.toThrow(
        'Falta el parámetro jornada_maxima_horas',
      );

      prisma.parametroOperacion.findMany.mockResolvedValue(PARAMETROS);
      prisma.vehiculo.findMany.mockResolvedValue([
        vehiculo(1, { encierroBase: 'Bodega' }),
      ]);
      await expect(servicio_.generar(FECHA, USUARIO)).rejects.toThrow(
        'El encierro base de BL-01 ("Bodega") no es una zona del catálogo',
      );
    });

    it('usa la hora de cita del operador; sin hora de cita o sin operador no participa', async () => {
      prisma.vehiculo.findMany.mockResolvedValue([
        vehiculo(1, {
          operador: { id: 101, disponible: true, horaCita: '05:45' },
        }),
        // Ya no hay respaldo a un turno: sin hora de cita no participa.
        vehiculo(2, {
          operador: { id: 102, disponible: true, horaCita: null },
        }),
        vehiculo(3, { operador: null }),
      ]);
      // Con cita a las 05:45 + 30 min al aeropuerto no llega al inicio de las 04:50.
      const resultado = await servicio_.generar(FECHA, USUARIO);
      expect(resultado?.resumen).toMatchObject({
        unidadesDisponibles: 1,
        asignados: 0,
        porMotivo: { EMPALME: 1, CAPACIDAD: 1 },
      });
    });

    it('409 si otra generación de la misma fecha se guardó antes (P2002)', async () => {
      prisma.rolDiario.create.mockRejectedValue(errorPrisma('P2002'));
      await expect(servicio_.generar(FECHA, USUARIO)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('consultas', () => {
    const asignacion = (vehiculoId: number, numero: string, orden: number) => ({
      id: vehiculoId * 10 + orden,
      vehiculoId,
      orden,
      vehiculo: { id: vehiculoId, numeroEconomico: numero },
      operador: { id: 100 + vehiculoId, nombre: `Operador ${vehiculoId}` },
    });

    it('obtener agrupa las asignaciones por unidad y ordena por número económico', async () => {
      prisma.rolDiario.findUnique.mockResolvedValue({
        id: 7,
        estado: 'PROPUESTO',
        asignaciones: [
          asignacion(10, 'BL-10', 1),
          asignacion(2, 'BL-2', 1),
          asignacion(2, 'BL-2', 2),
        ],
        _count: { noCubiertos: 4 },
      });

      const rol = await servicio_.obtener(FECHA);

      expect(rol.resumen).toEqual({
        servicios: 7,
        asignados: 3,
        noCubiertos: 4,
        unidadesUsadas: 2,
      });
      expect(
        rol.unidades.map((u) => [
          u.vehiculo.numeroEconomico,
          u.asignaciones.length,
        ]),
      ).toEqual([
        ['BL-2', 2],
        ['BL-10', 1],
      ]);
      expect(rol.unidades[0].asignaciones[0]).not.toHaveProperty('vehiculo');
    });

    it('404 si no hay rol de la fecha', async () => {
      await expect(servicio_.obtener(FECHA)).rejects.toThrow(NotFoundException);
      await expect(servicio_.noCubiertos(FECHA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('noCubiertos devuelve los del rol ordenados por hora del servicio', async () => {
      prisma.rolDiario.findUnique.mockResolvedValue({ id: 7 });
      prisma.servicioNoCubierto.findMany.mockResolvedValue([]);

      await servicio_.noCubiertos(FECHA);

      expect(prisma.servicioNoCubierto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rolId: 7 },
          orderBy: [{ servicio: { fechaHora: 'asc' } }, { id: 'asc' }],
        }),
      );
    });
  });
});
