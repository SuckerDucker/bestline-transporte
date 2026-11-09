import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type Tono = 'exito' | 'aviso' | 'neutro' | 'info' | 'error'

// Colores suaves con un punto de color, legibles en filas alternadas.
const TONOS: Record<Tono, { fondo: string; punto: string }> = {
  exito: { fondo: 'bg-emerald-50 text-emerald-700 border-emerald-200', punto: 'bg-emerald-500' },
  aviso: { fondo: 'bg-amber-50 text-amber-800 border-amber-200', punto: 'bg-amber-500' },
  neutro: { fondo: 'bg-slate-100 text-slate-600 border-slate-200', punto: 'bg-slate-400' },
  info: { fondo: 'bg-sky-50 text-sky-700 border-sky-200', punto: 'bg-sky-500' },
  error: { fondo: 'bg-red-50 text-red-700 border-red-200', punto: 'bg-red-500' },
}

/** Badge de estado (Disponible, Mantenimiento, Baja, Zona de término…). */
export function EstadoBadge({ texto, tono }: { texto: string; tono: Tono }) {
  return (
    <Badge variant="outline" className={cn('h-6 gap-1.5 px-2.5', TONOS[tono].fondo)}>
      <span className={cn('size-1.5 rounded-full', TONOS[tono].punto)} aria-hidden />
      {texto}
    </Badge>
  )
}
