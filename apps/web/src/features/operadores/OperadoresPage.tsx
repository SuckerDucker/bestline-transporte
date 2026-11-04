import { useState } from 'react'
import { usePuedeEscribir } from '../../auth/contexto'
import { Aviso } from '../../components/Aviso'
import { claseEntrada } from '../../components/estilos'
import { Confirmacion } from '../../components/Confirmacion'
import { Modal } from '../../components/Modal'
import { Paginacion } from '../../components/Paginacion'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useGuardar, useListado, useQuitar, useRetrasado } from '../catalogos/api'
import { Encabezado } from '../catalogos/Encabezado'
import { Insignia } from '../catalogos/Insignia'
import type { Operador } from '../catalogos/tipos'
import type { ValoresOperador } from './esquema'
import { FormularioOperador } from './FormularioOperador'

const LIMITE = 10

export function OperadoresPage() {
  const puedeEscribir = usePuedeEscribir()
  const [buscar, setBuscar] = useState('')
  const [disponible, setDisponible] = useState('')
  const [pagina, setPagina] = useState(1)
  const [enEdicion, setEnEdicion] = useState<Operador | 'nuevo' | null>(null)
  const [porDesactivar, setPorDesactivar] = useState<Operador | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const buscarRetrasado = useRetrasado(buscar)
  const listado = useListado<Operador>('operadores', {
    buscar: buscarRetrasado,
    disponible,
    pagina,
    limite: LIMITE,
  })
  const guardar = useGuardar<Operador>('operadores')
  const desactivar = useQuitar('operadores', 'desactivar')

  const cambiarFiltro = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const abrirFormulario = (valor: Operador | 'nuevo') => {
    guardar.reset()
    setExito(null)
    setEnEdicion(valor)
  }
  const alGuardar = (valores: ValoresOperador) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: valores },
      {
        onSuccess: () => {
          setEnEdicion(null)
          setExito(`Operador ${valores.nombre} ${id ? 'actualizado' : 'dado de alta'}.`)
        },
      },
    )
  }
  const confirmarDesactivar = () => {
    if (!porDesactivar) return
    desactivar.mutate(porDesactivar.id, {
      onSuccess: () => {
        setExito(`Operador ${porDesactivar.nombre} desactivado.`)
        setPorDesactivar(null)
      },
    })
  }

  const columnas: Columna<Operador>[] = [
    { encabezado: 'Nombre', celda: (o) => <span className="font-medium">{o.nombre}</span> },
    { encabezado: 'Licencia', celda: (o) => o.licencia },
    { encabezado: 'Teléfono', celda: (o) => o.telefono },
    {
      encabezado: 'Disponibilidad',
      celda: (o) =>
        o.disponible ? <Insignia texto="Disponible" color="verde" /> : <Insignia texto="No disponible" color="gris" />,
    },
  ]
  if (puedeEscribir) {
    columnas.push({
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (o) => (
        <div className="flex justify-end gap-3">
          <button type="button" className="boton-enlace" onClick={() => abrirFormulario(o)}>
            Editar
          </button>
          <button
            type="button"
            className="boton-enlace text-red-600 disabled:text-slate-300 disabled:no-underline"
            disabled={!o.disponible}
            onClick={() => {
              desactivar.reset()
              setPorDesactivar(o)
            }}
          >
            Desactivar
          </button>
        </div>
      ),
    })
  }

  return (
    <section>
      <Encabezado
        titulo="Operadores"
        descripcion="Choferes que pueden recibir servicios."
        textoNuevo="Nuevo operador"
        alNuevo={() => abrirFormulario('nuevo')}
      />

      <div className="mb-4 space-y-3">
        <Aviso tipo="exito" mensaje={exito} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="search"
            aria-label="Buscar operadores"
            placeholder="Buscar por nombre, licencia o teléfono…"
            value={buscar}
            onChange={(e) => cambiarFiltro(() => setBuscar(e.target.value))}
            className={`${claseEntrada(false)} sm:col-span-2`}
          />
          <select
            aria-label="Filtrar por disponibilidad"
            value={disponible}
            onChange={(e) => cambiarFiltro(() => setDisponible(e.target.value))}
            className={claseEntrada(false)}
          >
            <option value="">Todos</option>
            <option value="true">Disponibles</option>
            <option value="false">No disponibles</option>
          </select>
        </div>
      </div>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(o) => o.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay operadores con esos filtros."
      />
      {listado.data && (
        <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />
      )}

      <Modal
        titulo={enEdicion === 'nuevo' ? 'Nuevo operador' : 'Editar operador'}
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        <FormularioOperador
          key={enEdicion === 'nuevo' ? 'nuevo' : enEdicion?.id}
          inicial={enEdicion === 'nuevo' ? null : enEdicion}
          guardando={guardar.isPending}
          error={guardar.error?.message ?? null}
          alGuardar={alGuardar}
          alCancelar={() => setEnEdicion(null)}
        />
      </Modal>

      <Confirmacion
        titulo="Desactivar operador"
        mensaje={`¿Desactivar a ${porDesactivar?.nombre ?? ''}? Quedará como no disponible y no recibirá servicios. No se borra.`}
        textoConfirmar="Desactivar"
        abierto={porDesactivar !== null}
        procesando={desactivar.isPending}
        error={desactivar.error?.message}
        alConfirmar={confirmarDesactivar}
        alCancelar={() => setPorDesactivar(null)}
      />
    </section>
  )
}
