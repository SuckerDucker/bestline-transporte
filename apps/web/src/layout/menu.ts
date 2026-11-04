import type { Rol } from '../auth/tipos'

export interface OpcionMenu {
  ruta: string
  etiqueta: string
  roles: readonly Rol[]
}

/**
 * Roles que pueden consultar los catálogos. La API deja leer a cualquier rol
 * autenticado, pero al OPERADOR (chofer) no le sirven estas pantallas, así que
 * no se le muestran. Solo el ADMINISTRADOR puede modificar (ver usePuedeEscribir).
 */
export const ROLES_CATALOGOS: readonly Rol[] = ['ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR']

/** Menú lateral: cada opción se muestra solo a los roles indicados. */
export const MENU: readonly OpcionMenu[] = [
  { ruta: '/', etiqueta: 'Inicio', roles: ['ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR', 'OPERADOR'] },
  { ruta: '/vehiculos', etiqueta: 'Vehículos', roles: ROLES_CATALOGOS },
  { ruta: '/operadores', etiqueta: 'Operadores', roles: ROLES_CATALOGOS },
  { ruta: '/zonas', etiqueta: 'Zonas', roles: ROLES_CATALOGOS },
  { ruta: '/hoteles', etiqueta: 'Hoteles', roles: ROLES_CATALOGOS },
]

export function opcionesPara(rol: Rol): OpcionMenu[] {
  return MENU.filter((opcion) => opcion.roles.includes(rol))
}
