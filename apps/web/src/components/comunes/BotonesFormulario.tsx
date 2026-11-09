import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

/** Botones "Cancelar" y "Guardar" al pie de los formularios en ventana modal. */
export function BotonesFormulario({
  guardando,
  alCancelar,
}: {
  guardando: boolean
  alCancelar: () => void
}) {
  return (
    <DialogFooter className="pt-2">
      <Button type="button" variant="outline" onClick={alCancelar}>
        Cancelar
      </Button>
      <Button type="submit" disabled={guardando}>
        {guardando && <Loader2 className="animate-spin" />}
        {guardando ? 'Guardando…' : 'Guardar'}
      </Button>
    </DialogFooter>
  )
}
