import { Bus } from 'lucide-react'
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
import { Encabezado } from '../catalogos/Encabezado'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { ESTADOS_VEHICULO, NOMBRE_ESTADO_VEHICULO, TIPOS_VEHICULO, type Vehiculo, type Zona } from '../catalogos/tipos'
import type { ValoresVehiculo } from './esquema'
import { FormularioVehiculo } from './FormularioVehiculo'

const LIMITE = 10
const TONO_ESTADO = { DISPONIBLE: 'exito', MANTENIMIENTO: 'aviso', BAJA: 'neutro' } as const
const FILTRO_TIPO = [{ valor: TODOS, etiqueta: 'Todos los tipos' }, ...TIPOS_VEHICULO.map((t) => ({ valor: t, etiqueta: t }))]
const FILTRO_ESTADO = [
  { valor: TODOS, etiqueta: 'Todos los estados' },
  ...ESTADOS_VEHICULO.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO_VEHICULO[e] })),
]

export function VehiculosPage() {
  const puedeEscribir = usePuedeEscribir()
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo] = useState(TODOS)
  const [estado, setEstado] = useState(TODOS)
  const [pagina, setPagina] = useState(1)
  // null = modal cerrado; 'nuevo' = alta; un vehículo = edición
  const [enEdicion, setEnEdicion] = useState<Vehiculo | 'nuevo' | null>(null)
  const [porDesactivar, setPorDesactivar] = useState<Vehiculo | null>(null)

  const listado = useListado<Vehiculo>('vehiculos', {
    buscar: useRetrasado(buscar),
    tipo,
    estado,
    pagina,
    limite: LIMITE,
  })
  // Zonas del catálogo para el encierro base.
  const zonas = useListado<Zona>('zonas', { limite: 100 })
  const nombresZona = (zonas.data?.datos ?? []).map((z) => z.nombre)
  const guardar = useGuardar<Vehiculo>('vehiculos')
  const desactivar = useQuitar('vehiculos', 'desactivar')

  // Al cambiar un filtro se regresa a la primera página.
  const filtrar = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const alGuardar = (valores: ValoresVehiculo) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: valores },
      {
        onSuccess: () => {
          setEnEdicion(null)
          toast.success(`Vehículo ${valores.numeroEconomico} ${id ? 'actualizado' : 'dado de alta'}`)
        },
        onError: (error) => toast.error('No se pudo guardar el vehículo', { description: error.message }),
      },
    )
  }
  const confirmarDesactivar = () => {
    if (!porDesactivar) return
    desactivar.mutate(porDesactivar.id, {
      onSuccess: () => toast.success(`Vehículo ${porDesactivar.numeroEconomico} dado de baja`),
      onError: (error) => toast.error('No se pudo dar de baja el vehículo', { description: error.message }),
      onSettled: () => setPorDesactivar(null),
    })
  }

  const columnas: Columna<Vehiculo>[] = [
    { encabezado: 'No. económico', celda: (v) => <span className="font-semibold text-foreground">{v.numeroEconomico}</span> },
    { encabezado: 'Tipo', celda: (v) => v.tipo },
    { encabezado: 'Capacidad', celda: (v) => `${v.capacidad} pax`, alineacion: 'derecha' },
    { encabezado: 'Encierro base', celda: (v) => <span className="text-muted-foreground">{v.encierroBase}</span> },
    { encabezado: 'Estado', celda: (v) => <EstadoBadge texto={NOMBRE_ESTADO_VEHICULO[v.estado]} tono={TONO_ESTADO[v.estado]} /> },
  ]
  if (puedeEscribir) {
    columnas.push({
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (v) => (
        <AccionesFila
          descripcion={v.numeroEconomico}
          modo="desactivar"
          quitarDeshabilitado={v.estado === 'BAJA'}
          alEditar={() => {
            guardar.reset()
            setEnEdicion(v)
          }}
          alQuitar={() => setPorDesactivar(v)}
        />
      ),
    })
  }

  return (
    <section>
      <Encabezado
        descripcion="Flota disponible para los servicios."
        textoNuevo="Nuevo vehículo"
        alNuevo={() => {
          guardar.reset()
          setEnEdicion('nuevo')
        }}
      />

      <BarraFiltros
        buscar={buscar}
        alBuscar={(v) => filtrar(() => setBuscar(v))}
        placeholder="Buscar por número económico o encierro…"
        ariaLabel="Buscar vehículos"
      >
        <SelectSimple
          ariaLabel="Filtrar por tipo"
          valor={tipo}
          alCambiar={(v) => filtrar(() => setTipo(v))}
          opciones={FILTRO_TIPO}
          className="h-9 bg-card sm:w-44"
        />
        <SelectSimple
          ariaLabel="Filtrar por estado"
          valor={estado}
          alCambiar={(v) => filtrar(() => setEstado(v))}
          opciones={FILTRO_ESTADO}
          className="h-9 bg-card sm:w-48"
        />
      </BarraFiltros>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(v) => v.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay vehículos con esos filtros."
        iconoVacio={Bus}
      />
      {listado.data && <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />}

      <DialogoFormulario
        titulo={enEdicion === 'nuevo' ? 'Nuevo vehículo' : 'Editar vehículo'}
        descripcion="La capacidad debe corresponder al tipo: Van/Urvan 14, Sprinter 20, Autobús 45."
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        <FormularioVehiculo
          zonas={nombresZona}
          key={enEdicion === 'nuevo' ? 'nuevo' : enEdicion?.id}
          inicial={enEdicion === 'nuevo' ? null : enEdicion}
          guardando={guardar.isPending}
          alGuardar={alGuardar}
          alCancelar={() => setEnEdicion(null)}
        />
      </DialogoFormulario>

      <Confirmacion
        titulo="¿Dar de baja este vehículo?"
        mensaje={`El vehículo ${porDesactivar?.numeroEconomico ?? ''} pasará a estado BAJA y ya no se asignará a servicios. No se borra del sistema.`}
        textoConfirmar="Dar de baja"
        abierto={porDesactivar !== null}
        procesando={desactivar.isPending}
        alConfirmar={confirmarDesactivar}
        alCancelar={() => setPorDesactivar(null)}
      />
    </section>
  )
}
