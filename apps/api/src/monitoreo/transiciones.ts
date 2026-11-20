// Transiciones de estado de un servicio durante el monitoreo del día.
// Es una función pura (sin base de datos) para poder probarla sola.
//
//   PROGRAMADO → EN_RUTA → EN_SERVICIO → COMPLETADO
//   PROGRAMADO, EN_RUTA o EN_SERVICIO → CANCELADO o NO_SHOW (no el OPERADOR)
//
// COMPLETADO, CANCELADO y NO_SHOW son finales. INCIDENCIA no se usa como
// estado: una incidencia es un registro en su tabla y el servicio conserva su
// estado.
import type { EstadoServicio, RolUsuario } from '../generated/prisma/client.js';

/** Estados a los que se puede pasar desde cada estado. */
export const TRANSICIONES: Partial<Record<EstadoServicio, EstadoServicio[]>> = {
  PROGRAMADO: ['EN_RUTA', 'CANCELADO', 'NO_SHOW'],
  EN_RUTA: ['EN_SERVICIO', 'CANCELADO', 'NO_SHOW'],
  EN_SERVICIO: ['COMPLETADO', 'CANCELADO', 'NO_SHOW'],
};

/** Estados que el OPERADOR puede marcar (solo en sus servicios). */
export const ESTADOS_OPERADOR: EstadoServicio[] = [
  'EN_RUTA',
  'EN_SERVICIO',
  'COMPLETADO',
];

/** Estados que se pueden pedir en PATCH …/estado. */
export const ESTADOS_DESTINO: EstadoServicio[] = [
  ...ESTADOS_OPERADOR,
  'CANCELADO',
  'NO_SHOW',
];

export type ResultadoTransicion =
  { valida: true } | { valida: false; codigo: 400 | 403; mensaje: string };

const rechazo = (codigo: 400 | 403, mensaje: string): ResultadoTransicion => ({
  valida: false,
  codigo,
  mensaje,
});

/**
 * Revisa si un usuario con cierto rol puede pasar un servicio de "desde" a
 * "hacia". Primero el permiso del rol (403) y después la tabla (400).
 */
export function validarTransicion(
  desde: EstadoServicio,
  hacia: EstadoServicio,
  rol: RolUsuario,
): ResultadoTransicion {
  if (rol === 'OPERADOR' && !ESTADOS_OPERADOR.includes(hacia)) {
    return rechazo(
      403,
      `El operador no puede marcar un servicio como ${hacia}`,
    );
  }
  if (!(TRANSICIONES[desde] ?? []).includes(hacia)) {
    return rechazo(400, `No se puede pasar de ${desde} a ${hacia}`);
  }
  return { valida: true };
}

/** Horas reales que se guardan con la transición: inicio y término. */
export function horasReales(hacia: EstadoServicio, ahora: Date) {
  if (hacia === 'EN_RUTA') return { inicioReal: ahora };
  if (hacia === 'COMPLETADO') return { terminoReal: ahora };
  return {};
}
