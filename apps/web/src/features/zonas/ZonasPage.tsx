import { MapPinned } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { usePuedeEscribir } from '@/auth/contexto'
import { Confirmacion } from '@/components/comunes/Confirmacion'
import { DialogoFormulario } from '@/components/comunes/DialogoFormulario'
import { Paginacion } from '@/components/comunes/Paginacion'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { TablaDatos, type Columna } from '@/components/comunes/TablaDatos'
import { TODOS } from '@/lib/opciones'
import { AccionesFila } from '../catalogos/AccionesFila'
import { useGuardar, useListado, useQuitar, useRetrasado } from '../catalogos/api'
import { BarraFiltros } from '../catalogos/BarraFiltros'
import { formatoCoordenada } from '../catalogos/coordenadas'
import { Encabezado } from '../catalogos/Encabezado'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import type { Zona } from '../catalogos/tipos'
import type { ValoresZona } from './esquema'
import { FormularioZona } from './FormularioZona'

const LIMITE = 10
const FILTRO_TERMINO = [
  { valor: TODOS, etiqueta: 'Todas las zonas' },
  { valor: 'true', etiqueta: 'Solo zonas de término' },
  { valor: 'false', etiqueta: 'Sin zona de término' },
]

export function ZonasPage() {
  const puedeEscribir = usePuedeEscribir()
  const [buscar, setBuscar] = useState('')
  const [termino, setTermino] = useState(TODOS)
  const [pagina, setPagina] = useState(1)
  const [enEdicion, setEnEdicion] = useState<Zona | 'nuevo' | null>(null)
  const [porEliminar, setPorEliminar] = useState<Zona | null>(null)

  const listado = useListado<Zona>('zonas', {
    buscar: useRetrasado(buscar),
    esZonaTermino: termino,
    pagina,
    limite: LIMITE,
  })
  const guardar = useGuardar<Zona>('zonas')
  const eliminar = useQuitar('zonas', 'eliminar')

  const filtrar = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const alGuardar = (valores: ValoresZona) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: valores },
      {
        onSuccess: () => {
          setEnEdicion(null)
          toast.success(`Zona ${valores.nombre} ${id ? 'actualizada' : 'dada de alta'}`)
        },
        onError: (error) => toast.error('No se pudo guardar la zona', { description: error.message }),
      },
    )
  }
  const confirmarEliminar = () => {
    if (!porEliminar) return
    // Si la zona está en uso, la API responde 409 y su mensaje aparece en el aviso.
    eliminar.mutate(porEliminar.id, {
      onSuccess: () => toast.success(`Zona ${porEliminar.nombre} eliminada`),
      onError: (error) => toast.error('No se pudo eliminar la zona', { description: error.message }),
      onSettled: () => setPorEliminar(null),
    })
  }

  const columnas: Columna<Zona>[] = [
    { encabezado: 'Nombre', celda: (z) => <span className="font-semibold text-foreground">{z.nombre}</span> },
    { encabezado: 'Latitud', celda: (z) => <span className="tabular-nums">{formatoCoordenada(z.latitud)}</span>, alineacion: 'derecha' },
    { encabezado: 'Longitud', celda: (z) => <span className="tabular-nums">{formatoCoordenada(z.longitud)}</span>, alineacion: 'derecha' },
    {
      encabezado: 'Zona de término',
      celda: (z) => (z.esZonaTermino ? <EstadoBadge texto="Zona de término" tono="info" /> : <EstadoBadge texto="No" tono="neutro" />),
    },
  ]
  if (puedeEscribir) {
    columnas.push({
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (z) => (
        <AccionesFila
          descripcion={z.nombre}
          modo="eliminar"
          alEditar={() => {
            guardar.reset()
            setEnEdicion(z)
          }}
          alQuitar={() => setPorEliminar(z)}
        />
      ),
    })
  }

  return (
    <section>
      <Encabezado
        descripcion="Zonas de origen y destino de los servicios."
        textoNuevo="Nueva zona"
        alNuevo={() => {
          guardar.reset()
          setEnEdicion('nuevo')
        }}
      />

      <BarraFiltros
        buscar={buscar}
        alBuscar={(v) => filtrar(() => setBuscar(v))}
        placeholder="Buscar por nombre…"
        ariaLabel="Buscar zonas"
      >
        <SelectSimple
          ariaLabel="Filtrar zonas de término"
          valor={termino}
          alCambiar={(v) => filtrar(() => setTermino(v))}
          opciones={FILTRO_TERMINO}
          className="h-9 bg-card sm:w-52"
        />
      </BarraFiltros>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(z) => z.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay zonas con esos filtros."
        iconoVacio={MapPinned}
      />
      {listado.data && <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />}

      <DialogoFormulario
        titulo={enEdicion === 'nuevo' ? 'Nueva zona' : 'Editar zona'}
        descripcion="Coordenadas en grados decimales (máximo 6 decimales)."
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        <FormularioZona
          key={enEdicion === 'nuevo' ? 'nuevo' : enEdicion?.id}
          inicial={enEdicion === 'nuevo' ? null : enEdicion}
          guardando={guardar.isPending}
          alGuardar={alGuardar}
          alCancelar={() => setEnEdicion(null)}
        />
      </DialogoFormulario>

      <Confirmacion
        titulo="¿Eliminar esta zona?"
        mensaje={`La zona ${porEliminar?.nombre ?? ''} se eliminará definitivamente. Solo es posible si ningún hotel, tiempo de traslado ni servicio la usa.`}
        textoConfirmar="Eliminar"
        abierto={porEliminar !== null}
        procesando={eliminar.isPending}
        alConfirmar={confirmarEliminar}
        alCancelar={() => setPorEliminar(null)}
      />
    </section>
  )
}
