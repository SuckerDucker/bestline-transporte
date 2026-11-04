interface Props {
  tipo: 'error' | 'exito'
  mensaje: string | null | undefined
}

/** Mensaje destacado de error o de éxito. No muestra nada si no hay mensaje. */
export function Aviso({ tipo, mensaje }: Props) {
  if (!mensaje) return null
  const clases =
    tipo === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${clases}`}>
      {mensaje}
    </p>
  )
}
