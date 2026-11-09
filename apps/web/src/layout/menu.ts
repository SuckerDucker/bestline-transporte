import type { LucideIcon } from 'lucide-react'
import { Bus, Hotel, IdCard, LayoutDashboard, MapPinned } from 'lucide-react'
import type { Rol } from '@/auth/tipos'

export interface OpcionMenu {
  ruta: string
  etiqueta: string
  /** Título que se muestra en el encabezado de la pantalla. */
  titulo: string
  icono: LucideIcon
  /** Grupo del menú lateral (sin grupo = arriba, suelto). */
  grupo?: 'Catálogos'
  roles: readonly Rol[]
}

/**
 * Roles que pueden consultar los catálogos. La API deja leer a cualquier rol
 * autenticado, pero al OPERADOR (chofer) no le sirven estas pantallas, así que
 * no se le muestran. Solo el ADMINISTRADOR puede modificar (ver usePuedeEscribir).
 */
export const ROLES_CATALOGOS: readonly Rol[] = ['ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR']

const TODOS_LOS_ROLES: readonly Rol[] = ['ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR', 'OPERADOR']

/** Menú lateral: solo las pantallas que existen; cada una visible para sus roles. */
export const MENU: readonly OpcionMenu[] = [
  { ruta: '/', etiqueta: 'Inicio', titulo: 'Inicio', icono: LayoutDashboard, roles: TODOS_LOS_ROLES },
  { ruta: '/vehiculos', etiqueta: 'Vehículos', titulo: 'Vehículos', icono: Bus, grupo: 'Catálogos', roles: ROLES_CATALOGOS },
  { ruta: '/operadores', etiqueta: 'Operadores', titulo: 'Operadores', icono: IdCard, grupo: 'Catálogos', roles: ROLES_CATALOGOS },
  { ruta: '/zonas', etiqueta: 'Zonas', titulo: 'Zonas', icono: MapPinned, grupo: 'Catálogos', roles: ROLES_CATALOGOS },
  { ruta: '/hoteles', etiqueta: 'Hoteles', titulo: 'Hoteles', icono: Hotel, grupo: 'Catálogos', roles: ROLES_CATALOGOS },
]

export function opcionesPara(rol: Rol): OpcionMenu[] {
  return MENU.filter((opcion) => opcion.roles.includes(rol))
}

/** Título de la pantalla actual según la ruta. */
export function tituloDe(ruta: string): string {
  return MENU.find((o) => o.ruta === ruta)?.titulo ?? 'Best Line · Operaciones'
}
