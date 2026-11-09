import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Props {
  titulo: string
  mensaje: string
  textoConfirmar: string
  abierto: boolean
  procesando: boolean
  /** Botón rojo (por omisión) para acciones como desactivar o eliminar. */
  destructiva?: boolean
  alConfirmar: () => void
  alCancelar: () => void
}

/**
 * Confirmación antes de una acción como desactivar o eliminar (AlertDialog de
 * shadcn/ui). El diálogo no se cierra solo al confirmar: espera a que la
 * página termine la petición y lo cierre.
 */
export function Confirmacion(props: Props) {
  // Al cerrar, la página limpia el registro elegido y el mensaje quedaría sin
  // nombre durante la animación de salida; por eso se conserva el último
  // mensaje mostrado mientras el diálogo estuvo abierto.
  const [mensajeVisible, setMensajeVisible] = useState(props.mensaje)
  if (props.abierto && props.mensaje !== mensajeVisible) {
    setMensajeVisible(props.mensaje)
  }

  return (
    <AlertDialog
      open={props.abierto}
      onOpenChange={(abierto) => {
        if (!abierto && !props.procesando) props.alCancelar()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{mensajeVisible}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={props.procesando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={props.destructiva === false ? 'default' : 'destructive'}
            disabled={props.procesando}
            onClick={(e) => {
              // Evita que Radix cierre el diálogo antes de que responda la API.
              e.preventDefault()
              props.alConfirmar()
            }}
          >
            {props.procesando && <Loader2 className="animate-spin" />}
            {props.textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
