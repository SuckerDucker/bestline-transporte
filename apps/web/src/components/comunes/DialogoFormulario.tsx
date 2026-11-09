import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  titulo: string
  descripcion: string
  abierto: boolean
  alCerrar: () => void
  children: ReactNode
}

/** Ventana modal (Dialog de shadcn/ui) para los formularios de alta y edición. */
export function DialogoFormulario({ titulo, descripcion, abierto, alCerrar, children }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(valor) => !valor && alCerrar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
