import { Route } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Logotipo y nombre del sistema, como en los prototipos de la memoria. */
export function Marca({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-acento text-acento-foreground shadow-sm">
        <Route className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">Best Line · Operaciones</p>
        <p className="text-xs opacity-70">Asignación asistida y monitoreo</p>
      </div>
    </div>
  )
}
