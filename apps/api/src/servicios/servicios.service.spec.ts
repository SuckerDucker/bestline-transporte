import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { ServiciosService } from './servicios.service.js';

describe('ServiciosService', () => {
  let prisma: PrismaSimulado;
  let servicio: ServiciosService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new ServiciosService(comoPrisma(prisma));
    prisma.servicio.findMany.mockResolvedValue([]);
    prisma.servicio.count.mockResolvedValue(0);
  });

  const argumentos = () =>
    prisma.servicio.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      orderBy: unknown;
      skip: number;
    };

  it('arma los filtros: día de Cancún, zona de origen o destino y búsqueda', async () => {
    await servicio.listar({
      fecha: '2026-11-05',
      mayoristaId: 2,
      tipo: 'LLEGADA',
      modalidad: 'PRIVADO',
      zonaId: 4,
      estado: 'PENDIENTE',
      importacionId: 1,
      buscar: 'NX-15',
      pagina: 2,
      limite: 20,
    });

    expect(argumentos().where).toEqual({
      mayoristaId: 2,
      tipo: 'LLEGADA',
      modalidad: 'PRIVADO',
      estado: 'PENDIENTE',
      importacionId: 1,
      // 00:00 a 24:00 del 5 de noviembre en Cancún (UTC−5).
      fechaHora: {
        gte: new Date('2026-11-05T05:00:00.000Z'),
        lt: new Date('2026-11-06T05:00:00.000Z'),
      },
      OR: [{ zonaOrigenId: 4 }, { zonaDestinoId: 4 }],
      AND: {
        OR: [
          { folio: { contains: 'NX-15', mode: 'insensitive' } },
          { localizador: { contains: 'NX-15', mode: 'insensitive' } },
          { vuelo: { contains: 'NX-15', mode: 'insensitive' } },
        ],
      },
    });
    expect(argumentos()).toMatchObject({
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
      skip: 20,
    });
  });

  it('sin filtros no restringe nada', async () => {
    const pagina = await servicio.listar({ pagina: 1, limite: 10 });

    expect(argumentos().where).toEqual({
      mayoristaId: undefined,
      tipo: undefined,
      modalidad: undefined,
      estado: undefined,
      importacionId: undefined,
    });
    expect(pagina).toEqual({ datos: [], total: 0, pagina: 1, limite: 10 });
  });
});
