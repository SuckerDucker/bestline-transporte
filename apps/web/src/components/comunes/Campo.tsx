import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface Props {
  etiqueta: string
  htmlFor: string
  error?: string
  ayuda?: string
  children: ReactNode
}

/** Etiqueta + control + mensaje de error (o de ayuda) de un campo de formulario. */
export function Campo({ etiqueta, htmlFor, error, ayuda, children }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{etiqueta}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>
      )}
    </div>
  )
}
