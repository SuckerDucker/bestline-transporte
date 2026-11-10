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

/** GET /roles/:fecha */
export interface Rol {
  id: number
  fecha: string
  estado: 'PROPUESTO' | 'AUTORIZADO'
  generadoEn: string
  resumen: ResumenRol
}

/** POST /roles/generar */
export interface RolGenerado {
  rol: Omit<Rol, 'resumen'>
  reemplazado: boolean
  resumen: ResumenRol & {
    unidadesDisponibles: number
    tiempoMs: number
    porMotivo: Record<Motivo, number>
  }
}

export interface NoCubierto {
  id: number
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
