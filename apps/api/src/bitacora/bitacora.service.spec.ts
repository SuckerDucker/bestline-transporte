import { BadRequestException } from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { textoAccion } from '../comun/bitacora.js';
import { BitacoraService } from './bitacora.service.js';

describe('BitacoraService', () => {
  let prisma: PrismaSimulado;
  let servicio: BitacoraService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new BitacoraService(comoPrisma(prisma));
    prisma.bitacora.findMany.mockResolvedValue([]);
    prisma.bitacora.count.mockResolvedValue(0);
  });

  const argumentos = () =>
    prisma.bitacora.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      orderBy: unknown;
      skip: number;
      take: number;
    };

  it('ordena del más reciente al más antiguo y pagina', async () => {
    await servicio.listar({ pagina: 3, limite: 20 });

    expect(argumentos()).toMatchObject({
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      skip: 40,
      take: 20,
    });
  });

  it('filtra por usuario, entidad y acción (también con detalle)', async () => {
    await servicio.listar({
      usuarioId: 1,
      entidad: 'parametro_operacion',
      accion: 'ACTUALIZAR',
      pagina: 1,
      limite: 10,
    });

    expect(argumentos().where).toEqual({
      usuarioId: 1,
      entidad: 'parametro_operacion',
      accion: { startsWith: 'ACTUALIZAR' },
    });
  });

  it('convierte el rango de días de Cancún a instantes UTC (ambos días incluidos)', async () => {
    await servicio.listar({
      desde: '2026-11-01',
      hasta: '2026-11-10',
      pagina: 1,
      limite: 10,
    });

    expect(argumentos().where.fecha).toEqual({
      gte: new Date('2026-11-01T05:00:00.000Z'),
      lt: new Date('2026-11-11T05:00:00.000Z'),
    });
  });

  it('400 si "desde" es posterior a "hasta"', async () => {
    await expect(
      servicio.listar({
        desde: '2026-11-10',
        hasta: '2026-11-01',
        pagina: 1,
        limite: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('textoAccion', () => {
  it('agrega el detalle después de la acción', () => {
    expect(textoAccion('ACTUALIZAR', '9.5 → 10')).toBe('ACTUALIZAR: 9.5 → 10');
    expect(textoAccion('CREAR')).toBe('CREAR');
  });

  it('ya no recorta los textos largos (la columna admite 255)', () => {
    const detalle = 'rol ADMINISTRADOR → SUPERVISOR; ' + 'x'.repeat(100);
    const texto = textoAccion('ACTUALIZAR', detalle);
    expect(texto).toBe(`ACTUALIZAR: ${detalle}`);
    expect(texto.length).toBeGreaterThan(50);
  });
});
