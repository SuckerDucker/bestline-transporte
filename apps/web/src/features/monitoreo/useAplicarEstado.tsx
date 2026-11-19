import { useState } from 'react'
import { toast } from 'sonner'
import { Confirmacion } from '@/components/comunes/Confirmacion'
import { ESTADO_SERVICIO, type EstadoServicio } from '../servicios/tipos'
import { type FilaMonitoreo, useCambiarEstado } from './api'
import { ACCION_ESTADO, PIDE_CONFIRMACION } from './transiciones'

interface Pendiente {
  fila: FilaMonitoreo
  estado: EstadoServicio
}

/**
 * Cambia el estado de un servicio con aviso de éxito o de error. CANCELADO y
 * NO_SHOW piden confirmación primero. Devuelve la función y el diálogo que la
 * página debe pintar.
 */
export function useAplicarEstado(fecha: string) {
  const cambiar = useCambiarEstado(fecha)
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)

  const ejecutar = ({ fila, estado }: Pendiente) =>
    cambiar.mutate(
      { servicioId: fila.servicio.id, estado },
      {
        onSuccess: () => {
          toast.success(`${fila.servicio.folio}: ${ESTADO_SERVICIO[estado].etiqueta}`)
          setPendiente(null)
        },
        onError: (error) => {
          toast.error(`No se cambió ${fila.servicio.folio}`, { description: error.message })
          setPendiente(null)
        },
      },
    )

  const aplicar = (fila: FilaMonitoreo, estado: EstadoServicio) =>
    PIDE_CONFIRMACION.includes(estado) ? setPendiente({ fila, estado }) : ejecutar({ fila, estado })

  const confirmacion = (
    <Confirmacion
      titulo={pendiente ? `${ACCION_ESTADO[pendiente.estado]} ${pendiente.fila.servicio.folio}` : ''}
      mensaje={
        pendiente
          ? `El servicio quedará como "${ESTADO_SERVICIO[pendiente.estado].etiqueta}" y ya no podrá cambiar de estado.`
          : ''
      }
      textoConfirmar={pendiente ? (ACCION_ESTADO[pendiente.estado] ?? 'Confirmar') : 'Confirmar'}
      abierto={pendiente !== null}
      procesando={cambiar.isPending}
      alConfirmar={() => pendiente && ejecutar(pendiente)}
      alCancelar={() => setPendiente(null)}
    />
  )

  /** Servicio que se está cambiando ahora (para deshabilitar sus botones). */
  const enCurso = cambiar.isPending ? cambiar.variables?.servicioId : undefined
  return { aplicar, confirmacion, enCurso }
}
