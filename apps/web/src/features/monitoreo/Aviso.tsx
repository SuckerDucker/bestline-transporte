import { CircleAlert, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONO_AVISO = {
  aviso: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
}

/** Mensaje de aviso o de error dentro de la pantalla. */
export function Aviso({ tono, children }: { tono: keyof typeof TONO_AVISO; children: string }) {
  const Icono = tono === 'aviso' ? TriangleAlert : CircleAlert
  return (
    <p role="status" className={cn('flex items-start gap-2 rounded-lg border px-4 py-3 text-sm', TONO_AVISO[tono])}>
      <Icono className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}
