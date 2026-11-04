interface Props {
  texto: string
  color: 'verde' | 'ambar' | 'gris' | 'azul'
}

const COLORES: Record<Props['color'], string> = {
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ambar: 'bg-amber-50 text-amber-700 ring-amber-200',
  gris: 'bg-slate-100 text-slate-600 ring-slate-200',
  azul: 'bg-sky-50 text-sky-700 ring-sky-200',
}

/** Etiqueta pequeña de estado (Disponible, Baja, Zona de término…). */
export function Insignia({ texto, color }: Props) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${COLORES[color]}`}>
      {texto}
    </span>
  )
}
