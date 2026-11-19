import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi, pedir } from '@/api/cliente'
import type { EstadoServicio, Servicio } from '../servicios/tipos'

/** El tablero se vuelve a pedir solo cada 30 s (otros usuarios cambian estados). */
export const REFRESCO_MS = 30_000

/** Estados que se cuentan en el tablero (mismo orden que la API). */
export const ESTADOS_TABLERO = ['PROGRAMADO', 'EN_RUTA', 'EN_SERVICIO', 'COMPLETADO', 'CANCELADO', 'NO_SHOW'] as const
export type EstadoTablero = (typeof ESTADOS_TABLERO)[number]

export const TIPOS_INCIDENCIA = ['RETRASO', 'FALLA_MECANICA', 'PASAJERO_NO_SE_PRESENTO', 'CAMBIO_DE_HORA', 'OTRO'] as const
export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number]
export const NOMBRE_INCIDENCIA: Record<TipoIncidencia, string> = {
  RETRASO: 'Retraso',
  FALLA_MECANICA: 'Falla mecánica',
  PASAJERO_NO_SE_PRESENTO: 'Pasajero no se presentó',
  CAMBIO_DE_HORA: 'Cambio de hora',
  OTRO: 'Otro',
}

export interface Totales {
  total: number
  retrasados: number
  porEstado: Record<EstadoTablero, number>
}

/** Servicio del tablero con su unidad, operador y si va retrasado. */
export interface FilaMonitoreo {
  asignacionId: number
  orden: number
  inicioEfectivo: string
  liberacion: string
  vehiculo: { id: number; numeroEconomico: string; tipo: string }
  operador: { id: number; nombre: string }
  servicio: Servicio & { inicioReal: string | null; terminoReal: string | null }
  incidencias: number
  retrasado: boolean
}

/** GET /monitoreo/:fecha */
export interface Tablero {
  fecha: string
  rol: { id: number; estado: 'AUTORIZADO'; autorizadoEn: string | null }
  totales: Totales
  servicios: FilaMonitoreo[]
}

/** GET /monitoreo/:fecha/mis-servicios */
export interface MisServicios {
  fecha: string
  operador: { id: number; nombre: string; horaCita: string | null }
  vehiculo: { id: number; numeroEconomico: string; tipo: string } | null
  totales: Totales
  servicios: FilaMonitoreo[]
}

/** GET /monitoreo/:fecha/incidencias */
export interface Incidencia {
  id: number
  tipo: TipoIncidencia
  descripcion: string
  fecha: string
  usuario: { id: number; nombre: string }
  servicio: { id: number; folio: string }
  vehiculo: { id: number; numeroEconomico: string } | null
}

/** null si no hay rol autorizado de la fecha (404); cualquier otro error se lanza. */
async function o404<T>(peticion: Promise<T>): Promise<T | null> {
  try {
    return await peticion
  } catch (error) {
    if (error instanceof ErrorApi && error.status === 404) return null
    throw error
  }
}

export function useTablero(fecha: string) {
  return useQuery({
    queryKey: ['monitoreo', fecha],
    enabled: fecha !== '',
    refetchInterval: REFRESCO_MS,
    queryFn: () => o404(pedir<Tablero>(`/monitoreo/${fecha}`)),
  })
}

export function useIncidencias(fecha: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['monitoreo', fecha, 'incidencias'],
    enabled: habilitado,
    refetchInterval: REFRESCO_MS,
    queryFn: () => pedir<Incidencia[]>(`/monitoreo/${fecha}/incidencias`),
  })
}

/**
 * Mis servicios (OPERADOR). Un 404 puede ser "no hay rol autorizado" o "tu
 * usuario no está ligado a un operador": se devuelve el mensaje para mostrarlo.
 */
export function useMisServicios(fecha: string) {
  return useQuery({
    queryKey: ['monitoreo', fecha, 'mis-servicios'],
    enabled: fecha !== '',
    refetchInterval: REFRESCO_MS,
    queryFn: async () => {
      try {
        return { datos: await pedir<MisServicios>(`/monitoreo/${fecha}/mis-servicios`), aviso: null }
      } catch (error) {
        if (error instanceof ErrorApi && error.status === 404) return { datos: null, aviso: error.message }
        throw error
      }
    },
  })
}

/** Al terminar (bien o mal) se vuelve a pedir todo lo del día. */
function useCambioMonitoreo<V, R>(fecha: string, peticion: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: peticion,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['monitoreo', fecha] }),
  })
}

/** PATCH /monitoreo/servicios/:id/estado */
export const useCambiarEstado = (fecha: string) =>
  useCambioMonitoreo(fecha, ({ servicioId, estado, nota }: { servicioId: number; estado: EstadoServicio; nota?: string }) =>
    pedir<Servicio>(`/monitoreo/servicios/${servicioId}/estado`, { metodo: 'PATCH', cuerpo: { estado, nota } }),
  )

/** POST /monitoreo/servicios/:id/incidencias */
export const useRegistrarIncidencia = (fecha: string) =>
  useCambioMonitoreo(
    fecha,
    ({ servicioId, tipo, descripcion }: { servicioId: number; tipo: TipoIncidencia; descripcion: string }) =>
      pedir<Incidencia>(`/monitoreo/servicios/${servicioId}/incidencias`, {
        metodo: 'POST',
        cuerpo: { tipo, descripcion },
      }),
  )
