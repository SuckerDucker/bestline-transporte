import { Eye, Plus } from 'lucide-react'
import { usePuedeEscribir } from '@/auth/contexto'
import { Button } from '@/components/ui/button'

interface Props {
  descripcion: string
  textoNuevo: string
  alNuevo: () => void
}

/**
 * Descripción de la pantalla y botón de alta (solo ADMINISTRADOR). El título
 * de la pantalla ya aparece en el encabezado del layout.
 */
export function Encabezado({ descripcion, textoNuevo, alNuevo }: Props) {
  const puedeEscribir = usePuedeEscribir()
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{descripcion}</p>
        {!puedeEscribir && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Eye className="size-3.5" />
            Solo consulta: los cambios los hace el administrador.
          </p>
        )}
      </div>
      {puedeEscribir && (
        <Button onClick={alNuevo} className="shrink-0">
          <Plus />
          {textoNuevo}
        </Button>
      )}
    </div>
  )
}
