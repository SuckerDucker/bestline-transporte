import type { Prisma } from '../generated/prisma/client.js';

export type AccionBitacora =
  'INICIO_SESION' | 'CREAR' | 'ACTUALIZAR' | 'DESACTIVAR' | 'ELIMINAR';

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
) {
  return tx.bitacora.create({
    data: { usuarioId, accion, entidad, entidadId },
  });
}
