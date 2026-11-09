import { BadRequestException } from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
  registroBitacora,
} from '../comun/pruebas/prisma-simulado.js';
import {
  type ErrorCelda,
  TiemposTrasladoService,
} from './tiempos-traslado.service.js';

const ADMIN = 1;
const ZONAS = [
  { id: 1, nombre: 'Aeropuerto CUN', esZonaTermino: true },
  { id: 2, nombre: 'Tulum', esZonaTermino: false },
];
// Falta la combinación Tulum → Tulum.
const TIEMPOS = [
  { id: 10, zonaOrigenId: 1, zonaDestinoId: 1, minutos: 10 },
  { id: 11, zonaOrigenId: 1, zonaDestinoId: 2, minutos: 100 },
  { id: 12, zonaOrigenId: 2, zonaDestinoId: 1, minutos: 105 },
];

describe('TiemposTrasladoService', () => {
  let prisma: PrismaSimulado;
  let servicio: TiemposTrasladoService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new TiemposTrasladoService(comoPrisma(prisma));
    prisma.zona.findMany.mockResolvedValue(ZONAS);
    prisma.tiempoTraslado.findMany.mockResolvedValue(TIEMPOS);
    prisma.tiempoTraslado.upsert.mockImplementation((arg: unknown) =>
      Promise.resolve({ id: 99, ...(arg as { create: object }).create }),
    );
  });

  it('arma la matriz origen × destino e indica las celdas que faltan', async () => {
    const resultado = await servicio.matriz();

    expect(resultado.matriz).toEqual([
      [10, 100],
      [105, null],
    ]);
    expect(resultado.faltantes).toEqual([
      { zonaOrigenId: 2, zonaDestinoId: 2 },
    ]);
    expect(resultado.completa).toBe(false);
  });

  it('guarda en una transacción solo lo que cambió y lo registra en la bitácora', async () => {
    await servicio.guardar(
      [
        { zonaOrigenId: 1, zonaDestinoId: 2, minutos: 95 }, // cambia
        { zonaOrigenId: 2, zonaDestinoId: 1, minutos: 105 }, // igual
        { zonaOrigenId: 2, zonaDestinoId: 2, minutos: 10 }, // nueva
      ],
      ADMIN,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prisma.tiempoTraslado.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'ACTUALIZAR: 100 → 95', 'tiempo_traslado', 99),
    );
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'CREAR: 10 min', 'tiempo_traslado', 99),
    );
  });

  it('400 con el error de cada celda y sin guardar ninguna', async () => {
    let errores: ErrorCelda[] = [];
    try {
      await servicio.guardar(
        [
          { zonaOrigenId: 1, zonaDestinoId: 2, minutos: 0 },
          { zonaOrigenId: 2, zonaDestinoId: 1, minutos: 301 },
          { zonaOrigenId: 2, zonaDestinoId: 2, minutos: 12.5 },
          { zonaOrigenId: 1, zonaDestinoId: 1, minutos: 20 },
          { zonaOrigenId: 1, zonaDestinoId: 1, minutos: 25 },
          { zonaOrigenId: 9, zonaDestinoId: 1, minutos: 30 },
        ],
        ADMIN,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      ({ errores } = (error as BadRequestException).getResponse() as {
        errores: ErrorCelda[];
      });
    }

    expect(errores.map((e) => [e.zonaOrigenId, e.zonaDestinoId])).toEqual([
      [1, 2],
      [2, 1],
      [2, 2],
      [1, 1],
      [9, 1],
    ]);
    expect(errores[0].mensaje).toBe(
      'Aeropuerto CUN → Tulum: los minutos deben ser un número entero de 1 a 300',
    );
    expect(errores[3].mensaje).toContain('repetida');
    expect(errores[4].mensaje).toBe('No existe la zona 9');
    expect(prisma.tiempoTraslado.upsert).not.toHaveBeenCalled();
  });
});
