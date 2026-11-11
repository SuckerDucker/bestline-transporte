import { jest } from '@jest/globals';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

/** Función simulada que acepta cualquier argumento y devuelve una promesa. */
const fn = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

const modelo = () => ({
  findMany: fn(),
  findUnique: fn(),
  findFirst: fn(),
  count: fn(),
  create: fn(),
  createMany: fn(),
  update: fn(),
  updateMany: fn(),
  upsert: fn(),
  delete: fn(),
  deleteMany: fn(),
});

/**
 * Prisma simulado para pruebas unitarias (sin base de datos).
 * $transaction se comporta como el real: si recibe una función la ejecuta con
 * el mismo cliente (tx) y, si recibe un arreglo de consultas, las resuelve todas.
 */
export function crearPrismaSimulado() {
  const simulado = {
    usuario: modelo(),
    bitacora: modelo(),
    vehiculo: modelo(),
    operador: modelo(),
    zona: modelo(),
    hotel: modelo(),
    tiempoTraslado: modelo(),
    parametroOperacion: modelo(),
    mayorista: modelo(),
    importacion: modelo(),
    rolDiario: modelo(),
    asignacion: modelo(),
    servicioNoCubierto: modelo(),
    servicio: modelo(),
    $transaction: fn(),
    $queryRaw: fn(),
  };
  simulado.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: typeof simulado) => Promise<unknown>)(simulado)
      : Promise.all(arg as Promise<unknown>[]),
  );
  simulado.bitacora.create.mockResolvedValue({});
  return simulado;
}

export type PrismaSimulado = ReturnType<typeof crearPrismaSimulado>;

/** Convierte el simulado al tipo que esperan los servicios. */
export const comoPrisma = (simulado: PrismaSimulado) =>
  simulado as unknown as PrismaService;

/** Error de Prisma con el código indicado (P2002, P2003, P2025...). */
export const errorPrisma = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Error simulado ${code}`, {
    code,
    clientVersion: 'prueba',
  });

/** Lo que debe recibir bitacora.create para una acción. */
export const registroBitacora = (
  usuarioId: number,
  accion: string,
  entidad: string,
  entidadId: number,
) => ({ data: { usuarioId, accion, entidad, entidadId } });
