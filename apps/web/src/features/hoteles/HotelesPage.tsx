import { Hotel as IconoHotel } from 'lucide-react'
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
import type { Hotel, Zona } from '../catalogos/tipos'
import type { ValoresHotel } from './esquema'
import { FormularioHotel } from './FormularioHotel'

const LIMITE = 10

export function HotelesPage() {
  const puedeEscribir = usePuedeEscribir()
  const [buscar, setBuscar] = useState('')
  const [zonaId, setZonaId] = useState(TODOS)
  const [pagina, setPagina] = useState(1)
  const [enEdicion, setEnEdicion] = useState<Hotel | 'nuevo' | null>(null)
  const [porEliminar, setPorEliminar] = useState<Hotel | null>(null)

  const listado = useListado<Hotel>('hoteles', {
    buscar: useRetrasado(buscar),
    zonaId,
    pagina,
    limite: LIMITE,
  })
  // Zonas para el filtro y el formulario (el máximo de la API es 100 por página).
  const zonas = useListado<Zona>('zonas', { limite: 100 })
  const guardar = useGuardar<Hotel>('hoteles')
  const eliminar = useQuitar('hoteles', 'eliminar')

  const filtroZona = [
    { valor: TODOS, etiqueta: 'Todas las zonas' },
    ...(zonas.data?.datos ?? []).map((z) => ({ valor: String(z.id), etiqueta: z.nombre })),
  ]
  const filtrar = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const alGuardar = (valores: ValoresHotel) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: valores },
      {
        onSuccess: () => {
          setEnEdicion(null)
          toast.success(`Hotel ${valores.nombre} ${id ? 'actualizado' : 'dado de alta'}`)
        },
        onError: (error) => toast.error('No se pudo guardar el hotel', { description: error.message }),
      },
    )
  }
  const confirmarEliminar = () => {
    if (!porEliminar) return
    // Si el hotel tiene servicios, la API responde 409 y su mensaje aparece en el aviso.
    eliminar.mutate(porEliminar.id, {
      onSuccess: () => toast.success(`Hotel ${porEliminar.nombre} eliminado`),
      onError: (error) => toast.error('No se pudo eliminar el hotel', { description: error.message }),
      onSettled: () => setPorEliminar(null),
    })
  }

  const columnas: Columna<Hotel>[] = [
    { encabezado: 'Nombre', celda: (h) => <span className="font-semibold text-foreground">{h.nombre}</span> },
    { encabezado: 'Zona', celda: (h) => h.zona.nombre },
    { encabezado: 'Latitud', celda: (h) => <span className="tabular-nums">{formatoCoordenada(h.latitud)}</span>, alineacion: 'derecha' },
    { encabezado: 'Longitud', celda: (h) => <span className="tabular-nums">{formatoCoordenada(h.longitud)}</span>, alineacion: 'derecha' },
  ]
  if (puedeEscribir) {
    columnas.push({
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (h) => (
        <AccionesFila
          descripcion={h.nombre}
          modo="eliminar"
          alEditar={() => {
            guardar.reset()
            setEnEdicion(h)
          }}
          alQuitar={() => setPorEliminar(h)}
        />
      ),
    })
  }

  return (
    <section>
      <Encabezado
        descripcion="Hoteles de recogida y entrega, con su zona."
        textoNuevo="Nuevo hotel"
        alNuevo={() => {
          guardar.reset()
          setEnEdicion('nuevo')
        }}
      />

      <BarraFiltros
        buscar={buscar}
        alBuscar={(v) => filtrar(() => setBuscar(v))}
        placeholder="Buscar por nombre…"
        ariaLabel="Buscar hoteles"
      >
        <SelectSimple
          ariaLabel="Filtrar por zona"
          valor={zonaId}
          alCambiar={(v) => filtrar(() => setZonaId(v))}
          opciones={filtroZona}
          className="h-9 bg-card sm:w-52"
        />
      </BarraFiltros>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(h) => h.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay hoteles con esos filtros."
        iconoVacio={IconoHotel}
      />
      {listado.data && <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />}

      <DialogoFormulario
        titulo={enEdicion === 'nuevo' ? 'Nuevo hotel' : 'Editar hotel'}
        descripcion="La zona debe existir en el catálogo de zonas."
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        <FormularioHotel
          key={enEdicion === 'nuevo' ? 'nuevo' : enEdicion?.id}
          inicial={enEdicion === 'nuevo' ? null : enEdicion}
          zonas={zonas.data?.datos ?? []}
          guardando={guardar.isPending}
          alGuardar={alGuardar}
          alCancelar={() => setEnEdicion(null)}
        />
      </DialogoFormulario>

      <Confirmacion
        titulo="¿Eliminar este hotel?"
        mensaje={`El hotel ${porEliminar?.nombre ?? ''} se eliminará definitivamente. Solo es posible si ningún servicio lo usa.`}
        textoConfirmar="Eliminar"
        abierto={porEliminar !== null}
        procesando={eliminar.isPending}
        alConfirmar={confirmarEliminar}
        alCancelar={() => setPorEliminar(null)}
      />
    </section>
  )
}
