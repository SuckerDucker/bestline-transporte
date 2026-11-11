import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ClientePrisma } from './datos-motor.js';

export interface RolBloqueado {
  id: number;
  estado: 'PROPUESTO' | 'AUTORIZADO';
}

/**
 * Bloquea la fila de rol_diario de la fecha hasta que termine la transacción
 * (SELECT … FOR UPDATE). Dos coordinadores que cambian el mismo rol a la vez
 * quedan en fila: el segundo espera y después lee los datos ya guardados por
 * el primero, así que su revalidación no usa datos viejos.
 * Devuelve null si no hay rol de esa fecha.
 */
export async function bloquearRol(
  tx: ClientePrisma,
  fecha: string,
): Promise<RolBloqueado | null> {
  const filas = await tx.$queryRaw<RolBloqueado[]>`
    SELECT id, estado::text AS estado
    FROM rol_diario
    WHERE fecha = ${fecha}::date
    FOR UPDATE`;
  return filas[0] ?? null;
}

/** Bloquea el rol y exige que exista y siga PROPUESTO (404 / 409). */
export async function bloquearRolPropuesto(
  tx: ClientePrisma,
  fecha: string,
): Promise<RolBloqueado> {
  const rol = await bloquearRol(tx, fecha);
  if (!rol) throw new NotFoundException(`No hay rol del ${fecha}`);
  if (rol.estado === 'AUTORIZADO') {
    throw new ConflictException(
      `El rol del ${fecha} ya está AUTORIZADO; no se puede modificar`,
    );
  }
  return rol;
}
