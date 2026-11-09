import type { Tono } from '../catalogos/EstadoBadge'

// Mismos valores que los enums de la API (schema.prisma).
export const TIPOS_SERVICIO = ['LLEGADA', 'SALIDA', 'TRASLADO'] as const
export const MODALIDADES = ['PRIVADO', 'COMPARTIDO', 'GRUPO'] as const
export const ESTADOS_SERVICIO = [
  'PENDIENTE',
  'PROGRAMADO',
  'EN_RUTA',
  'EN_SERVICIO',
  'COMPLETADO',
  'CANCELADO',
  'INCIDENCIA',
] as const
export type EstadoServicio = (typeof ESTADOS_SERVICIO)[number]

export const NOMBRE_TIPO: Record<string, string> = { LLEGADA: 'Llegada', SALIDA: 'Salida', TRASLADO: 'Traslado' }
export const NOMBRE_MODALIDAD: Record<string, string> = { PRIVADO: 'Privado', COMPARTIDO: 'Compartido', GRUPO: 'Grupo' }
export const ESTADO_SERVICIO: Record<EstadoServicio, { etiqueta: string; tono: Tono }> = {
  PENDIENTE: { etiqueta: 'Pendiente', tono: 'neutro' },
  PROGRAMADO: { etiqueta: 'Programado', tono: 'info' },
  EN_RUTA: { etiqueta: 'En ruta', tono: 'aviso' },
  EN_SERVICIO: { etiqueta: 'En servicio', tono: 'aviso' },
  COMPLETADO: { etiqueta: 'Completado', tono: 'exito' },
  CANCELADO: { etiqueta: 'Cancelado', tono: 'neutro' },
  INCIDENCIA: { etiqueta: 'Incidencia', tono: 'error' },
}

interface Nombre {
  id: number
  nombre: string
}

/** Servicio como lo devuelve GET /servicios o GET /importaciones/:id. */
export interface Servicio {
  id: number
  folio: string
  localizador: string
  tipo: string
  modalidad: string
  fechaHora: string
  pasajeros: number
  vuelo: string | null
  estado: EstadoServicio
  mayorista?: Nombre
  zonaOrigen: Nombre
  zonaDestino: Nombre
  hotel: Nombre | null
}
