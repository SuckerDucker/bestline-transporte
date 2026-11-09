import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pedir } from '@/api/cliente'

export const ESTADOS_FILA = ['VALIDA', 'ADVERTENCIA', 'DUPLICADA', 'ERROR'] as const
export type EstadoFila = (typeof ESTADOS_FILA)[number]

export interface Mayorista {
  id: number
  nombre: string
}

export interface FilaVistaPrevia {
  /** Número de fila en el archivo. */
  fila: number
  estado: EstadoFila
  mensajes: string[]
  /** Valores tal como vienen en el archivo, por encabezado. */
  valores: Record<string, string>
  /** Cómo se guardará (solo VALIDA o ADVERTENCIA). */
  servicio: {
    tipo: string
    modalidad: string
    fechaHora: string
    zonaOrigen: string
    zonaDestino: string
  } | null
}

export interface Totales {
  total: number
  validas: number
  advertencias: number
  duplicadas: number
  errores: number
  importables: number
  rechazadas: number
}

export interface VistaPrevia {
  archivo: string
  mayorista: Mayorista
  totales: Totales
  avisos: string[]
  filas: FilaVistaPrevia[]
}

export interface Importacion {
  id: number
  archivo: string
  fecha: string
  filasValidas: number
  filasRechazadas: number
  mayorista: Mayorista
  usuario: { id: number; nombre: string }
}

/** Mayoristas para el selector. */
export function useMayoristas() {
  return useQuery({ queryKey: ['mayoristas'], queryFn: () => pedir<Mayorista[]>('/mayoristas') })
}

/** Archivo + mayorista como formulario multipart (igual para vista previa y confirmación). */
function formulario(archivo: File, mayoristaId: number) {
  const datos = new FormData()
  datos.append('mayoristaId', String(mayoristaId))
  datos.append('archivo', archivo)
  return datos
}

export interface DatosArchivo {
  archivo: File
  mayoristaId: number
}

/** POST /importaciones/vista-previa: no guarda nada. */
export function useVistaPrevia() {
  return useMutation({
    mutationFn: ({ archivo, mayoristaId }: DatosArchivo) =>
      pedir<VistaPrevia>('/importaciones/vista-previa', { metodo: 'POST', cuerpo: formulario(archivo, mayoristaId) }),
  })
}

/** POST /importaciones/confirmar: vuelve a validar y guarda. */
export function useConfirmar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ archivo, mayoristaId }: DatosArchivo) =>
      pedir<{ importacion: Importacion; totales: Totales }>('/importaciones/confirmar', {
        metodo: 'POST',
        cuerpo: formulario(archivo, mayoristaId),
      }),
    onSuccess: () =>
      Promise.all(
        ['importaciones', 'servicios', 'resumen'].map((clave) => queryClient.invalidateQueries({ queryKey: [clave] })),
      ),
  })
}
