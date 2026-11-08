import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { fechaEnCancun, rangoDelDia } from './fechas.js';
import { ResumenService } from './resumen.service.js';

describe('fechas de Cancún', () => {
  it('fechaEnCancun usa la hora local (UTC-5): 03:00 UTC del 11 es todavía el día 10', () => {
    expect(fechaEnCancun(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-10');
  });

  it('rangoDelDia va de las 00:00 de Cancún (05:00 UTC) al día siguiente', () => {
    const { inicio, fin } = rangoDelDia('2026-11-10');
    expect(inicio.toISOString()).toBe('2026-11-10T05:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-11-11T05:00:00.000Z');
  });
});

describe('ResumenService', () => {
  let prisma: PrismaSimulado;
  let servicio: ResumenService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new ResumenService(comoPrisma(prisma));
    // Cada conteo responde según su filtro, para comprobar qué se pregunta.
    prisma.vehiculo.count.mockImplementation((arg) =>
      Promise.resolve(
        (arg as { where: { estado: string } }).where.estado === 'DISPONIBLE'
          ? 9
          : 1,
      ),
    );
    prisma.operador.count.mockImplementation((arg) =>
      Promise.resolve(arg ? 9 : 10),
    );
    prisma.zona.count.mockImplementation((arg) => Promise.resolve(arg ? 2 : 8));
    prisma.hotel.count.mockResolvedValue(8);
    prisma.servicio.count.mockImplementation((arg) =>
      Promise.resolve(
        (arg as { where: { estado?: string } }).where.estado === 'PENDIENTE'
          ? 58
          : 60,
      ),
    );
  });

  it('con fecha indicada devuelve los conteos y filtra los servicios de ese día', async () => {
    const resumen = await servicio.obtener('2026-11-10');

    expect(resumen).toEqual({
      vehiculos: { activos: 10, disponibles: 9, enMantenimiento: 1 },
      operadores: { disponibles: 9, total: 10 },
      zonas: { total: 8, deTermino: 2 },
      hoteles: { total: 8 },
      servicios: { fecha: '2026-11-10', pendientes: 58, total: 60 },
    });
    expect(prisma.servicio.count).toHaveBeenCalledWith({
      where: {
        fechaHora: {
          gte: new Date('2026-11-10T05:00:00.000Z'),
          lt: new Date('2026-11-11T05:00:00.000Z'),
        },
        estado: 'PENDIENTE',
      },
    });
    expect(prisma.servicio.findFirst).not.toHaveBeenCalled();
  });

  it('sin fecha usa el próximo día con servicios a partir de hoy', async () => {
    prisma.servicio.findFirst.mockResolvedValue({
      fechaHora: new Date('2026-11-10T11:00:00Z'),
    });

    const resumen = await servicio.obtener(
      undefined,
      new Date('2026-11-08T18:00:00Z'),
    );

    expect(resumen.servicios.fecha).toBe('2026-11-10');
    expect(prisma.servicio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fechaHora: { gte: new Date('2026-11-08T05:00:00.000Z') } },
        orderBy: { fechaHora: 'asc' },
      }),
    );
  });

  it('sin fecha y sin servicios próximos usa el día de hoy', async () => {
    prisma.servicio.findFirst.mockResolvedValue(null);

    const resumen = await servicio.obtener(
      undefined,
      new Date('2026-11-08T18:00:00Z'),
    );

    expect(resumen.servicios.fecha).toBe('2026-11-08');
  });
});
