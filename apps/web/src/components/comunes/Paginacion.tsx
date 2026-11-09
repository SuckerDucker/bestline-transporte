import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  pagina: number
  limite: number
  total: number
  alCambiar: (pagina: number) => void
}

/** Controles de "anterior / siguiente" con el total de registros. */
export function Paginacion({ pagina, limite, total, alCambiar }: Props) {
  const paginas = Math.max(1, Math.ceil(total / limite))
  const desde = total === 0 ? 0 : (pagina - 1) * limite + 1
  const hasta = Math.min(pagina * limite, total)

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        Mostrando <span className="font-medium text-foreground">{desde}–{hasta}</span> de{' '}
        <span className="font-medium text-foreground">{total}</span> registro{total === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        <span className="mr-1">
          Página {pagina} de {paginas}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => alCambiar(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => alCambiar(pagina + 1)}
          disabled={pagina >= paginas}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
