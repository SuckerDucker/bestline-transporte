import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorApi, pedir } from '@/api/cliente'
import type { Tono } from '../catalogos/EstadoBadge'
import type { Servicio } from '../servicios/tipos'

export const MOTIVOS = ['CAPACIDAD', 'EMPALME', 'JORNADA', 'ZONA_TERMINO', 'SIN_UNIDAD'] as const
export type Motivo = (typeof MOTIVOS)[number]

/** Etiqueta, color y explicación de cada motivo de no cubierto (CU-14). */
export const MOTIVO: Record<Motivo, { etiqueta: string; tono: Tono; explicacion: string; nota?: string }> = {
  // REGLA CONFIRMADA CON LA EMPRESA: un grupo que no cabe en ninguna unidad
  // disponible se reporta para que Monitoreo contrate una unidad externa.
  CAPACIDAD: {
    etiqueta: 'Capacidad',
    tono: 'aviso',
    explicacion: 'Más pasajeros que la capacidad de las unidades disponibles.',
    nota: 'Requiere unidad externa (Monitoreo)',
  },
  EMPALME: { etiqueta: 'Empalme', tono: 'info', explicacion: 'Ninguna unidad llega a tiempo al origen.' },
  JORNADA: { etiqueta: 'Jornada', tono: 'neutro', explicacion: 'Excede la jornada máxima desde la hora de cita.' },
  ZONA_TERMINO: {
    etiqueta: 'Zona de término',
    tono: 'error',
    explicacion: 'Dejaría a la unidad terminando fuera de una zona de término y sin jornada para regresar a su encierro.',
  },
  SIN_UNIDAD: { etiqueta: 'Sin unidad', tono: 'error', explicacion: 'No hay unidades disponibles ese día.' },
}

export interface ResumenRol {
  servicios: number
  asignados: number
  noCubiertos: number
  unidadesUsadas: number
}

/** Traslado en vacío antes de un servicio (del encierro o del destino anterior). */
export interface Vacio {
  minutos: number
  desde: string
  hasta: string
}

/** Servicio asignado a una unidad, en orden de inicio efectivo. */
export interface AsignacionRol {
  id: number
  servicioId: number
  vehiculoId: number
  orden: number
  inicioEfectivo: string
  liberacion: string
  servicio: Servicio
  vacio: Vacio | null
}

/** Unidad del rol: vehículo con su operador (también las que no tienen servicios). */
export interface UnidadRol {
  vehiculo: { id: number; numeroEconomico: string; tipo: string; capacidad: number }
  operador: { id: number; nombre: string; horaCita: string | null } | null
  disponible: boolean
  encierro: { id: number; nombre: string } | null
  cita: string | null
  finJornada: string | null
  asignaciones: AsignacionRol[]
}

/** GET /roles/:fecha */
export interface Rol {
  id: number
  fecha: string
  estado: 'PROPUESTO' | 'AUTORIZADO'
  generadoEn: string
  autorizadoEn: string | null
  autorizador: { id: number; nombre: string } | null
  resumen: ResumenRol
  unidades: UnidadRol[]
  noCubiertos: NoCubierto[]
}

/** POST /roles/generar */
export interface RolGenerado {
  rol: Pick<Rol, 'id' | 'fecha' | 'estado' | 'generadoEn'>
  reemplazado: boolean
  resumen: ResumenRol & {
    unidadesDisponibles: number
    tiempoMs: number
    porMotivo: Record<Motivo, number>
  }
}

export interface NoCubierto {
  id: number
  servicioId: number
  motivo: Motivo
  servicio: Servicio
}

/** El rol de una fecha, o null si todavía no se ha generado (404). */
export function useRol(fecha: string) {
  return useQuery({
    queryKey: ['roles', fecha],
    enabled: fecha !== '',
    queryFn: async () => {
      try {
        return await pedir<Rol>(`/roles/${fecha}`)
      } catch (error) {
        if (error instanceof ErrorApi && error.status === 404) return null
        throw error
      }
    },
  })
}

export function useNoCubiertos(fecha: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['roles', fecha, 'no-cubiertos'],
    enabled: habilitado,
    queryFn: () => pedir<NoCubierto[]>(`/roles/${fecha}/no-cubiertos`),
  })
}

export function useGenerarRol() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fecha: string) => pedir<RolGenerado>('/roles/generar', { metodo: 'POST', cuerpo: { fecha } }),
    onSuccess: (_, fecha) => queryClient.invalidateQueries({ queryKey: ['roles', fecha] }),
  })
}

/** Motivos por los que una unidad no acepta un servicio (revalidación). */
export type MotivoRevision = 'CAPACIDAD' | 'EMPALME' | 'JORNADA' | 'ZONA_TERMINO' | 'DISPONIBILIDAD'

export const MOTIVO_REVISION: Record<MotivoRevision, { etiqueta: string; tono: Tono }> = {
  CAPACIDAD: { etiqueta: 'Capacidad', tono: 'aviso' },
  EMPALME: { etiqueta: 'Empalme', tono: 'info' },
  JORNADA: { etiqueta: 'Jornada', tono: 'neutro' },
  ZONA_TERMINO: { etiqueta: 'Zona de término', tono: 'error' },
  DISPONIBILIDAD: { etiqueta: 'No disponible', tono: 'neutro' },
}

/** GET /roles/:fecha/servicios/:servicioId/opciones */
export interface OpcionUnidad {
  vehiculoId: number
  numeroEconomico: string
  capacidad: number
  actual: boolean
  valido: boolean
  motivo?: MotivoRevision
  detalle?: string
  posicion?: number
}

/** Unidades que aceptarían el servicio (null = selector cerrado). */
export function useOpciones(fecha: string, servicioId: number | null) {
  return useQuery({
    queryKey: ['roles', fecha, 'opciones', servicioId],
    enabled: servicioId !== null,
    // Siempre con el estado actual del rol: otro coordinador pudo cambiarlo.
    staleTime: 0,
    queryFn: () => pedir<OpcionUnidad[]>(`/roles/${fecha}/servicios/${servicioId}/opciones`),
  })
}

/**
 * Mutación que cambia el rol de una fecha. Al terminar (bien o mal) se
 * invalida ['roles', fecha]: rol, no cubiertos y opciones se vuelven a pedir.
 */
function useCambioRol<V, R>(fecha: string, peticion: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: peticion,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['roles', fecha] }),
  })
}

/** PATCH /roles/:fecha/asignaciones/:id: mueve un servicio a otra unidad. */
export const useMoverServicio = (fecha: string) =>
  useCambioRol(fecha, ({ asignacionId, vehiculoId }: { asignacionId: number; vehiculoId: number }) =>
    pedir<{ de: string; a: string }>(`/roles/${fecha}/asignaciones/${asignacionId}`, {
      metodo: 'PATCH',
      cuerpo: { vehiculoId },
    }),
  )

/** POST /roles/:fecha/no-cubiertos/:servicioId/asignar */
export const useAsignarNoCubierto = (fecha: string) =>
  useCambioRol(fecha, ({ servicioId, vehiculoId }: { servicioId: number; vehiculoId: number }) =>
    pedir<{ a: string }>(`/roles/${fecha}/no-cubiertos/${servicioId}/asignar`, {
      metodo: 'POST',
      cuerpo: { vehiculoId },
    }),
  )

/** POST /roles/:fecha/autorizar */
export const useAutorizarRol = (fecha: string) =>
  useCambioRol(fecha, () =>
    pedir<{ programados: number; noCubiertos: number }>(`/roles/${fecha}/autorizar`, { metodo: 'POST' }),
  )
