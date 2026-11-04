import { useState } from 'react'
import { usePuedeEscribir } from '../../auth/contexto'
import { Aviso } from '../../components/Aviso'
import { claseEntrada } from '../../components/estilos'
import { Confirmacion } from '../../components/Confirmacion'
import { Modal } from '../../components/Modal'
import { Paginacion } from '../../components/Paginacion'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useGuardar, useListado, useQuitar, useRetrasado } from '../catalogos/api'
import { formatoCoordenada } from '../catalogos/coordenadas'
import { Encabezado } from '../catalogos/Encabezado'
import { Insignia } from '../catalogos/Insignia'
import type { Zona } from '../catalogos/tipos'
import type { ValoresZona } from './esquema'
import { FormularioZona } from './FormularioZona'

const LIMITE = 10

export function ZonasPage() {
  const puedeEscribir = usePuedeEscribir()
  const [buscar, setBuscar] = useState('')
  const [termino, setTermino] = useState('')
  const [pagina, setPagina] = useState(1)
  const [enEdicion, setEnEdicion] = useState<Zona | 'nuevo' | null>(null)
  const [porEliminar, setPorEliminar] = useState<Zona | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const buscarRetrasado = useRetrasado(buscar)
  const listado = useListado<Zona>('zonas', {
    buscar: buscarRetrasado,
    esZonaTermino: termino,
    pagina,
    limite: LIMITE,
  })
  const guardar = useGuardar<Zona>('zonas')
  const eliminar = useQuitar('zonas', 'eliminar')

  const cambiarFiltro = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const abrirFormulario = (valor: Zona | 'nuevo') => {
    guardar.reset()
    setExito(null)
    setEnEdicion(valor)
  }
  const alGuardar = (valores: ValoresZona) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: valores },
      {
        onSuccess: () => {
          setEnEdicion(null)
          setExito(`Zona ${valores.nombre} ${id ? 'actualizada' : 'dada de alta'}.`)
        },
      },
    )
  }
  const confirmarEliminar = () => {
    if (!porEliminar) return
    // Si la zona está en uso, la API responde 409 y el mensaje se muestra en el diálogo.
    eliminar.mutate(porEliminar.id, {
      onSuccess: () => {
        setExito(`Zona ${porEliminar.nombre} eliminada.`)
        setPorEliminar(null)
      },
    })
  }

  const columnas: Columna<Zona>[] = [
    { encabezado: 'Nombre', celda: (z) => <span className="font-medium">{z.nombre}</span> },
    { encabezado: 'Latitud', celda: (z) => formatoCoordenada(z.latitud), alineacion: 'derecha' },
    { encabezado: 'Longitud', celda: (z) => formatoCoordenada(z.longitud), alineacion: 'derecha' },
    {
      encabezado: 'Zona de término',
      celda: (z) => (z.esZonaTermino ? <Insignia texto="Sí" color="azul" /> : <Insignia texto="No" color="gris" />),
    },
  ]
  if (puedeEscribir) {
    columnas.push({
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (z) => (
        <div className="flex justify-end gap-3">
          <button type="button" className="boton-enlace" onClick={() => abrirFormulario(z)}>
            Editar
          </button>
          <button
            type="button"
            className="boton-enlace text-red-600"
            onClick={() => {
              eliminar.reset()
              setPorEliminar(z)
            }}
          >
            Eliminar
          </button>
        </div>
      ),
    })
  }

  return (
    <section>
      <Encabezado
        titulo="Zonas"
        descripcion="Zonas de origen y destino de los servicios."
        textoNuevo="Nueva zona"
        alNuevo={() => abrirFormulario('nuevo')}
      />

      <div className="mb-4 space-y-3">
        <Aviso tipo="exito" mensaje={exito} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="search"
            aria-label="Buscar zonas"
            placeholder="Buscar por nombre…"
            value={buscar}
            onChange={(e) => cambiarFiltro(() => setBuscar(e.target.value))}
            className={`${claseEntrada(false)} sm:col-span-2`}
          />
          <select
            aria-label="Filtrar zonas de término"
            value={termino}
            onChange={(e) => cambiarFiltro(() => setTermino(e.target.value))}
            className={claseEntrada(false)}
          >
            <option value="">Todas</option>
            <option value="true">Solo zonas de término</option>
            <option value="false">Sin zona de término</option>
          </select>
        </div>
      </div>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(z) => z.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay zonas con esos filtros."
      />
      {listado.data && (
        <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />
      )}

      <Modal
        titulo={enEdicion === 'nuevo' ? 'Nueva zona' : 'Editar zona'}
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        <FormularioZona
          key={enEdicion === 'nuevo' ? 'nuevo' : enEdicion?.id}
          inicial={enEdicion === 'nuevo' ? null : enEdicion}
          guardando={guardar.isPending}
          error={guardar.error?.message ?? null}
          alGuardar={alGuardar}
          alCancelar={() => setEnEdicion(null)}
        />
      </Modal>

      <Confirmacion
        titulo="Eliminar zona"
        mensaje={`¿Eliminar la zona ${porEliminar?.nombre ?? ''}? Solo se puede si ningún hotel, tiempo de traslado ni servicio la usa.`}
        textoConfirmar="Eliminar"
        abierto={porEliminar !== null}
        procesando={eliminar.isPending}
        error={eliminar.error?.message}
        alConfirmar={confirmarEliminar}
        alCancelar={() => setPorEliminar(null)}
      />
    </section>
  )
}
