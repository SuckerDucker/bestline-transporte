import { Ban, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  descripcion: string
  modo: 'desactivar' | 'eliminar'
  /** Si ya está desactivado, la opción aparece deshabilitada. */
  quitarDeshabilitado?: boolean
  alEditar: () => void
  alQuitar: () => void
}

/** Menú de acciones de una fila: Editar y Desactivar o Eliminar. */
export function AccionesFila({ descripcion, modo, quitarDeshabilitado, alEditar, alQuitar }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones de ${descripcion}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={alEditar}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={quitarDeshabilitado} onSelect={alQuitar}>
          {modo === 'desactivar' ? <Ban /> : <Trash2 />}
          {modo === 'desactivar' ? 'Desactivar' : 'Eliminar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
