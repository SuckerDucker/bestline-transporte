import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Opcion } from '@/lib/opciones'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  valor: string
  alCambiar: (valor: string) => void
  opciones: readonly Opcion[]
  placeholder?: string
  invalido?: boolean
  deshabilitado?: boolean
  ariaLabel?: string
  className?: string
}

/** Select de shadcn/ui con una lista de opciones. */
export function SelectSimple({
  id,
  valor,
  alCambiar,
  opciones,
  placeholder,
  invalido,
  deshabilitado,
  ariaLabel,
  className,
}: Props) {
  return (
    <Select value={valor} onValueChange={alCambiar} disabled={deshabilitado}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        className={cn('w-full', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
