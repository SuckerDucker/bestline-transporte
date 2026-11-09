import type { ReactNode } from 'react'

interface Props {
  etiqueta: string
  htmlFor: string
  error?: string
  ayuda?: string
  children: ReactNode
}

/** Etiqueta + control + mensaje de error de un campo de formulario. */
export function Campo({ etiqueta, htmlFor, error, ayuda, children }: Props) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : (
        ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>
      )}
    </div>
  )
}
