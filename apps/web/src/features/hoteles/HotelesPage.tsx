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
import type { Hotel, Zona } from '../catalogos/tipos'
import type { ValoresHotel } from './esquema'
import { FormularioHotel } from './FormularioHotel'

const LIMITE = 10

export function HotelesPage() {
  const puedeEscribir = usePuedeEscribir()
  const [buscar, setBuscar] = useState('')
  const [zonaId, setZonaId] = useState('')
  const [pagina, setPagina] = useState(1)
  const [enEdicion, setEnEdicion] = useState<Hotel | 'nuevo' | null>(null)
  const [porEliminar, setPorEliminar] = useState<Hotel | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const buscarRetrasado = useRetrasado(buscar)
  const listado = useListado<Hotel>('hoteles', {
    buscar: buscarRetrasado,
    zonaId,
    pagina,
    limite: LIMITE,
  })
  // Zonas para el filtro y el formulario (el máximo de la API es 100 por página).
  const zonas = useListado<Zona>('zonas', { limite: 100 })
  const guardar = useGuardar<Hotel>('hoteles')
  const eliminar = useQuitar('hoteles', 'eliminar')

  const cambiarFiltro = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const abrirFormulario = (valor: Hotel | 'nuevo') => {
    guardar.reset()
    setExito(null)
    setEnEdicion(valor)
  }
  const alGuardar = (valores: ValoresHotel) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: valores },
      {
        onSuccess: () => {
          setEnEdicion(null)
          setExito(`Hotel ${valores.nombre} ${id ? 'actualizado' : 'dado de alta'}.`)
        },
      },
    )
  }
  const confirmarEliminar = () => {
    if (!porEliminar) return
    // Si el hotel tiene servicios, la API responde 409 y el mensaje se muestra en el diálogo.
    eliminar.mutate(porEliminar.id, {
      onSuccess: () => {
        setExito(`Hotel ${porEliminar.nombre} eliminado.`)
        setPorEliminar(null)
      },
    })
  }

  const columnas: Columna<Hotel>[] = [
    { encabezado: 'Nombre', celda: (h) => <span className="font-medium">{h.nombre}</span> },
    { encabezado: 'Zona', celda: (h) => h.zona.nombre },
    { encabezado: 'Latitud', celda: (h) => formatoCoordenada(h.latitud), alineacion: 'derecha' },
    { encabezado: 'Longitud', celda: (h) => formatoCoordenada(h.longitud), alineacion: 'derecha' },
  ]
  if (puedeEscribir) {
    columnas.push({
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (h) => (
        <div className="flex justify-end gap-3">
          <button type="button" className="boton-enlace" onClick={() => abrirFormulario(h)}>
            Editar
          </button>
          <button
            type="button"
            className="boton-enlace text-red-600"
            onClick={() => {
              eliminar.reset()
              setPorEliminar(h)
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
        titulo="Hoteles"
        descripcion="Hoteles de recogida y entrega, con su zona."
        textoNuevo="Nuevo hotel"
        alNuevo={() => abrirFormulario('nuevo')}
      />

      <div className="mb-4 space-y-3">
        <Aviso tipo="exito" mensaje={exito} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="search"
            aria-label="Buscar hoteles"
            placeholder="Buscar por nombre…"
            value={buscar}
            onChange={(e) => cambiarFiltro(() => setBuscar(e.target.value))}
            className={`${claseEntrada(false)} sm:col-span-2`}
          />
          <select
            aria-label="Filtrar por zona"
            value={zonaId}
            onChange={(e) => cambiarFiltro(() => setZonaId(e.target.value))}
            className={claseEntrada(false)}
          >
            <option value="">Todas las zonas</option>
            {zonas.data?.datos.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(h) => h.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay hoteles con esos filtros."
      />
      {listado.data && (
        <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />
      )}

      <Modal
        titulo={enEdicion === 'nuevo' ? 'Nuevo hotel' : 'Editar hotel'}
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        <FormularioHotel
          key={enEdicion === 'nuevo' ? 'nuevo' : enEdicion?.id}
          inicial={enEdicion === 'nuevo' ? null : enEdicion}
          zonas={zonas.data?.datos ?? []}
          guardando={guardar.isPending}
          error={guardar.error?.message ?? null}
          alGuardar={alGuardar}
          alCancelar={() => setEnEdicion(null)}
        />
      </Modal>

      <Confirmacion
        titulo="Eliminar hotel"
        mensaje={`¿Eliminar el hotel ${porEliminar?.nombre ?? ''}? Solo se puede si ningún servicio lo usa.`}
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
