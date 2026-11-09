import { Aviso } from './Aviso'
import { Modal } from './Modal'

interface Props {
  titulo: string
  mensaje: string
  textoConfirmar: string
  abierto: boolean
  procesando: boolean
  error?: string | null
  alConfirmar: () => void
  alCancelar: () => void
}

/** Pide confirmación antes de una acción como desactivar o eliminar. */
export function Confirmacion(props: Props) {
  return (
    <Modal titulo={props.titulo} abierto={props.abierto} alCerrar={props.alCancelar}>
      <p className="text-sm text-slate-600">{props.mensaje}</p>
      <div className="mt-4">
        <Aviso tipo="error" mensaje={props.error} />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={props.alCancelar} className="boton-secundario">
          Cancelar
        </button>
        <button
          type="button"
          onClick={props.alConfirmar}
          disabled={props.procesando}
          className="boton-peligro"
        >
          {props.procesando ? 'Procesando…' : props.textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}
