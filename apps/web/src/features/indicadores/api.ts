import { useQuery } from '@tanstack/react-query'
import { pedir } from '@/api/cliente'
import type { Motivo } from '../roles/api'

export type TipoIncidencia = 'RETRASO' | 'FALLA_MECANICA' | 'PASAJERO_NO_SE_PRESENTO' | 'CAMBIO_DE_HORA' | 'OTRO'

export interface UnidadDia {
  vehiculoId: number
  numeroEconomico: string
  capacidad: number
  servicios: number
  pasajeros: number
  /** Pasajeros / capacidad promedio, de 0 a 1. */
  ocupacion: number | null
  horasJornada: number | null
}

/** Indicadores de un día (GET /indicadores → dias). */
export interface IndicadoresDia {
  fecha: string
  estadoRol: 'PROPUESTO' | 'AUTORIZADO' | null
  servicios: number
  asignados: number
  noCubiertos: number
  noCubiertosPorMotivo: Record<Motivo, number>
  /** Porcentaje (0 a 100) o null si no hay rol. */
  cobertura: number | null
  /** Violaciones del verificador; null si el rol no está AUTORIZADO. */
  empalmes: number | null
  completados: number
  cancelados: number
  noShow: number
  incidencias: number
  incidenciasPorTipo: Record<TipoIncidencia, number>
  ocupacion: number | null
  unidades: UnidadDia[]
}

export interface ResumenIndicadores
  extends Omit<IndicadoresDia, 'fecha' | 'estadoRol' | 'unidades'> {
  dias: number
  diasConRol: number
  unidades: {
    vehiculoId: number
    numeroEconomico: string
    servicios: number
    ocupacion: number | null
    horasJornadaPromedio: number | null
  }[]
}

/** GET /indicadores?desde&hasta */
export interface Indicadores {
  desde: string
  hasta: string
  resumen: ResumenIndicadores
  dias: IndicadoresDia[]
}

export function useIndicadores(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['indicadores', desde, hasta],
    enabled: desde !== '' && hasta !== '',
    queryFn: () => pedir<Indicadores>('/indicadores', { query: { desde, hasta } }),
  })
}
