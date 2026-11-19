import type { Rol } from '@/auth/tipos'
import type { EstadoServicio } from '../servicios/tipos'

// Misma tabla que la API (apps/api/src/monitoreo/transiciones.ts). La API
// vuelve a revisarla; aquí solo sirve para mostrar las acciones posibles.
const TRANSICIONES: Partial<Record<EstadoServicio, EstadoServicio[]>> = {
  PROGRAMADO: ['EN_RUTA', 'CANCELADO', 'NO_SHOW'],
  EN_RUTA: ['EN_SERVICIO', 'CANCELADO', 'NO_SHOW'],
  EN_SERVICIO: ['COMPLETADO', 'CANCELADO', 'NO_SHOW'],
}
const ESTADOS_OPERADOR: EstadoServicio[] = ['EN_RUTA', 'EN_SERVICIO', 'COMPLETADO']

/** Texto del botón o de la opción del menú para pasar a cada estado. */
export const ACCION_ESTADO: Partial<Record<EstadoServicio, string>> = {
  EN_RUTA: 'Iniciar',
  EN_SERVICIO: 'Pasajeros a bordo',
  COMPLETADO: 'Completar',
  CANCELADO: 'Cancelar servicio',
  NO_SHOW: 'Marcar no show',
}

/** Estados que piden confirmación antes de aplicarse (no tienen vuelta atrás). */
export const PIDE_CONFIRMACION: EstadoServicio[] = ['CANCELADO', 'NO_SHOW']

/** Estados a los que el usuario puede pasar el servicio desde su estado actual. */
export function siguientes(estado: EstadoServicio, rol: Rol): EstadoServicio[] {
  const posibles = TRANSICIONES[estado] ?? []
  return rol === 'OPERADOR' ? posibles.filter((e) => ESTADOS_OPERADOR.includes(e)) : posibles
}
