import { usePuedeEscribir } from '../../auth/contexto'

interface Props {
  titulo: string
  descripcion: string
  textoNuevo: string
  alNuevo: () => void
}

/** Título de la pantalla y botón de alta (solo para el ADMINISTRADOR). */
export function Encabezado({ titulo, descripcion, textoNuevo, alNuevo }: Props) {
  const puedeEscribir = usePuedeEscribir()
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">{titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {descripcion}
          {!puedeEscribir && ' Solo consulta: los cambios los hace el administrador.'}
        </p>
      </div>
      {puedeEscribir && (
        <button type="button" onClick={alNuevo} className="boton-primario">
          {textoNuevo}
        </button>
      )}
    </div>
  )
}
