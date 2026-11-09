import type { Prisma } from '../generated/prisma/client.js';

/** Acciones que se registran en la bitácora. */
export const ACCIONES_BITACORA = [
  'INICIO_SESION',
  'CREAR',
  'ACTUALIZAR',
  'DESACTIVAR',
  'REACTIVAR',
  'CAMBIAR_PASSWORD',
  'ELIMINAR',
] as const;
export type AccionBitacora = (typeof ACCIONES_BITACORA)[number];

/** Entidades que aparecen en la columna "entidad" de la bitácora. */
export const ENTIDADES_BITACORA = [
  'usuario',
  'vehiculo',
  'operador',
  'zona',
  'hotel',
  'parametro_operacion',
  'tiempo_traslado',
] as const;

/** Tamaño de la columna bitacora.accion (VarChar(50)). */
const LARGO_ACCION = 50;

/**
 * Texto que se guarda en bitacora.accion. La tabla no tiene columna de
 * detalle, así que cuando hace falta (por ejemplo el valor anterior y el nuevo
 * de un parámetro) se agrega después de la acción: "ACTUALIZAR: 9.5 → 10".
 * Se recorta al tamaño de la columna para que nunca falle el registro.
 */
export function textoAccion(accion: AccionBitacora, detalle?: string): string {
  const texto = detalle ? `${accion}: ${detalle}` : accion;
  return texto.length > LARGO_ACCION
    ? `${texto.slice(0, LARGO_ACCION - 1)}…`
    : texto;
}

/** Detalle de un cambio de valor: "anterior → nuevo". */
export const cambio = (anterior: unknown, nuevo: unknown) =>
  `${String(anterior)} → ${String(nuevo)}`;

/**
 * Registra una acción en la tabla bitacora.
 * Recibe el cliente de la transacción para que el cambio y su registro se
 * guarden juntos: si uno falla, no se guarda ninguno.
 */
export function registrarBitacora(
  tx: Prisma.TransactionClient,
  usuarioId: number,
  accion: AccionBitacora,
  entidad: string,
  entidadId: number,
  detalle?: string,
) {
  return tx.bitacora.create({
    data: {
      usuarioId,
      accion: textoAccion(accion, detalle),
      entidad,
      entidadId,
    },
  });
}
