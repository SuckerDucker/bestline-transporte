import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'

interface Props {
  buscar: string
  alBuscar: (valor: string) => void
  placeholder: string
  ariaLabel: string
  /** Filtros adicionales (selects). */
  children?: ReactNode
}

/** Búsqueda con ícono y filtros de un catálogo. */
export function BarraFiltros({ buscar, alBuscar, placeholder, ariaLabel, children }: Props) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={buscar}
          onChange={(e) => alBuscar(e.target.value)}
          className="h-9 bg-card pl-9"
        />
      </div>
      {children && <div className="flex flex-col gap-3 sm:flex-row md:w-auto">{children}</div>}
    </div>
  )
}
