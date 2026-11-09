// Tipos de los registros que devuelve la API para cada catálogo.

export const TIPOS_VEHICULO = ['Van', 'Urvan', 'Sprinter', 'Autobús'] as const
export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number]

/** Igual que en la API (apps/api/src/vehiculos/capacidad.ts). */
export const CAPACIDAD_MAXIMA: Record<TipoVehiculo, number> = {
  Van: 14,
  Urvan: 14,
  Sprinter: 20,
  Autobús: 45,
}

export const ESTADOS_VEHICULO = ['DISPONIBLE', 'MANTENIMIENTO', 'BAJA'] as const
export type EstadoVehiculo = (typeof ESTADOS_VEHICULO)[number]

export const NOMBRE_ESTADO_VEHICULO: Record<EstadoVehiculo, string> = {
  DISPONIBLE: 'Disponible',
  MANTENIMIENTO: 'Mantenimiento',
  BAJA: 'Baja',
}

export interface Vehiculo {
  id: number
  numeroEconomico: string
  tipo: string
  capacidad: number
  estado: EstadoVehiculo
  encierroBase: string
}

export interface Operador {
  id: number
  nombre: string
  licencia: string
  telefono: string
  disponible: boolean
  /** Vehículo que maneja; sin vehículo no participa en el rol. */
  vehiculoId: number | null
  /** HH:mm dentro de un bloque de Parámetros; null = no participa en el rol. */
  horaCita: string | null
  vehiculo: Pick<Vehiculo, 'id' | 'numeroEconomico' | 'tipo' | 'capacidad' | 'estado'> | null
}

export interface Zona {
  id: number
  nombre: string
  latitud: number
  longitud: number
  esZonaTermino: boolean
}

export interface Hotel {
  id: number
  nombre: string
  zonaId: number
  latitud: number
  longitud: number
  zona: { id: number; nombre: string }
}
