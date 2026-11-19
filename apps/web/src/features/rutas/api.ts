import { useQuery } from '@tanstack/react-query'
import { pedir } from '@/api/cliente'

export type TipoParada = 'ENCIERRO_SALIDA' | 'ORIGEN' | 'DESTINO' | 'ENCIERRO_REGRESO'

/** Parada de la ruta con las horas del rol (no las de OSRM). */
export interface Parada {
  orden: number
  tipo: TipoParada
  /** Hotel o zona. */
  nombre: string
  zona: string
  latitud: number
  longitud: number
  llegada: string | null
  salida: string | null
  /** Solo en la salida del encierro. */
  horaCita?: string
  servicio?: {
    id: number
    folio: string
    tipo: string
    modalidad: string
    pasajeros: number
    origen: string
    destino: string
  }
}

/** GET /roles/:fecha/rutas/:vehiculoId */
export interface Ruta {
  fecha: string
  estadoRol: 'PROPUESTO' | 'AUTORIZADO'
  vehiculo: { id: number; numeroEconomico: string; tipo: string; capacidad: number }
  operador: { id: number; nombre: string; horaCita: string | null }
  servicios: number
  paradas: Parada[]
  /** GeoJSON: coordenadas [longitud, latitud]. */
  geometria: { type: 'LineString'; coordinates: [number, number][] }
  distanciaKm: number
  /** null si el trazado es aproximado. */
  duracionMin: number | null
  trazado: 'carretera' | 'aproximado'
}

/** Ruta sugerida de una unidad (la API consulta OSRM; el navegador nunca). */
export function useRuta(fecha: string, vehiculoId: number | null) {
  return useQuery({
    queryKey: ['rutas', fecha, vehiculoId],
    enabled: fecha !== '' && vehiculoId !== null,
    queryFn: () => pedir<Ruta>(`/roles/${fecha}/rutas/${vehiculoId}`),
    // El trazado de un rol no cambia mientras se consulta la pantalla.
    staleTime: 5 * 60_000,
  })
}
