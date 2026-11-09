import type { LucideIcon } from 'lucide-react'
import {
  Bus,
  Flag,
  Grid3x3,
  Hotel,
  IdCard,
  LayoutDashboard,
  MapPinned,
  ScrollText,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react'
import type { Rol } from '@/auth/tipos'

/** Grupos del menú lateral, en el orden en que se muestran. */
export const GRUPOS_MENU = ['Catálogos', 'Configuración', 'Administración'] as const
export type GrupoMenu = (typeof GRUPOS_MENU)[number]

export interface OpcionMenu {
  ruta: string
  etiqueta: string
  /** Título que se muestra en el encabezado de la pantalla. */
  titulo: string
  icono: LucideIcon
  /** Grupo del menú lateral (sin grupo = arriba, suelto). */
  grupo?: GrupoMenu
  roles: readonly Rol[]
}

/**
 * Roles que pueden consultar los catálogos y la configuración. La API deja leer
 * a cualquier rol autenticado, pero al OPERADOR (chofer) no le sirven estas
 * pantallas, así que no se le muestran. Solo el ADMINISTRADOR puede modificar
 * (ver usePuedeEscribir).
 */
export const ROLES_CATALOGOS: readonly Rol[] = ['ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR']

/** Usuarios y bitácora: solo el ADMINISTRADOR (igual que en la API). */
export const ROLES_ADMINISTRACION: readonly Rol[] = ['ADMINISTRADOR']

const TODOS_LOS_ROLES: readonly Rol[] = ['ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR', 'OPERADOR']

/** Menú lateral: solo las pantallas que existen; cada una visible para sus roles. */
export const MENU: readonly OpcionMenu[] = [
  { ruta: '/', etiqueta: 'Inicio', titulo: 'Inicio', icono: LayoutDashboard, roles: TODOS_LOS_ROLES },
  { ruta: '/vehiculos', etiqueta: 'Vehículos', titulo: 'Vehículos', icono: Bus, grupo: 'Catálogos', roles: ROLES_CATALOGOS },
  { ruta: '/operadores', etiqueta: 'Operadores', titulo: 'Operadores', icono: IdCard, grupo: 'Catálogos', roles: ROLES_CATALOGOS },
  { ruta: '/zonas', etiqueta: 'Zonas', titulo: 'Zonas', icono: MapPinned, grupo: 'Catálogos', roles: ROLES_CATALOGOS },
  { ruta: '/hoteles', etiqueta: 'Hoteles', titulo: 'Hoteles', icono: Hotel, grupo: 'Catálogos', roles: ROLES_CATALOGOS },
  {
    ruta: '/parametros',
    etiqueta: 'Parámetros',
    titulo: 'Parámetros de operación',
    icono: SlidersHorizontal,
    grupo: 'Configuración',
    roles: ROLES_CATALOGOS,
  },
  {
    ruta: '/zonas-termino',
    etiqueta: 'Zonas de término',
    titulo: 'Zonas de término',
    icono: Flag,
    grupo: 'Configuración',
    roles: ROLES_CATALOGOS,
  },
  {
    ruta: '/matriz-tiempos',
    etiqueta: 'Matriz de tiempos',
    titulo: 'Matriz de tiempos de traslado',
    icono: Grid3x3,
    grupo: 'Configuración',
    roles: ROLES_CATALOGOS,
  },
  { ruta: '/usuarios', etiqueta: 'Usuarios', titulo: 'Usuarios', icono: UserCog, grupo: 'Administración', roles: ROLES_ADMINISTRACION },
  { ruta: '/bitacora', etiqueta: 'Bitácora', titulo: 'Bitácora', icono: ScrollText, grupo: 'Administración', roles: ROLES_ADMINISTRACION },
]

export function opcionesPara(rol: Rol): OpcionMenu[] {
  return MENU.filter((opcion) => opcion.roles.includes(rol))
}

/** Opciones visibles para un rol agrupadas: primero las sueltas y luego cada grupo con opciones. */
export function menuAgrupado(rol: Rol): { grupo: GrupoMenu | null; opciones: OpcionMenu[] }[] {
  const opciones = opcionesPara(rol)
  const grupos = [null, ...GRUPOS_MENU].map((grupo) => ({
    grupo,
    opciones: opciones.filter((o) => (o.grupo ?? null) === grupo),
  }))
  return grupos.filter((g) => g.opciones.length > 0)
}

/** Título de la pantalla actual según la ruta. */
export function tituloDe(ruta: string): string {
  return MENU.find((o) => o.ruta === ruta)?.titulo ?? 'Best Line · Operaciones'
}
