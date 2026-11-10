import { IdCard } from 'lucide-react'
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
import type { Operador, Vehiculo } from '../catalogos/tipos'
import { aDatosOperador, type ValoresOperador } from './esquema'
import { FormularioOperador } from './FormularioOperador'

const LIMITE = 10
const FILTRO_DISPONIBLE = [
  { valor: TODOS, etiqueta: 'Todos' },
  { valor: 'true', etiqueta: 'Disponibles' },
  { valor: 'false', etiqueta: 'No disponibles' },
]

export function OperadoresPage() {
  const puedeEscribir = usePuedeEscribir()
  const [buscar, setBuscar] = useState('')
  const [disponible, setDisponible] = useState(TODOS)
  const [pagina, setPagina] = useState(1)
  const [enEdicion, setEnEdicion] = useState<Operador | 'nuevo' | null>(null)
  const [porDesactivar, setPorDesactivar] = useState<Operador | null>(null)

  const listado = useListado<Operador>('operadores', {
    buscar: useRetrasado(buscar),
    disponible,
    pagina,
    limite: LIMITE,
  })
  // Vehículos para el selector de unidad (sin los dados de baja).
  const vehiculos = useListado<Vehiculo>('vehiculos', { limite: 100 })
  const opcionesVehiculo = (vehiculos.data?.datos ?? []).filter((v) => v.estado !== 'BAJA')
  const guardar = useGuardar<Operador>('operadores')
  const desactivar = useQuitar('operadores', 'desactivar')

  const filtrar = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const alGuardar = (valores: ValoresOperador) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: aDatosOperador(valores) },
      {
        onSuccess: () => {
          setEnEdicion(null)
          toast.success(`Operador ${valores.nombre} ${id ? 'actualizado' : 'dado de alta'}`)
        },
        onError: (error) => toast.error('No se pudo guardar el operador', { description: error.message }),
      },
    )
  }
  const confirmarDesactivar = () => {
    if (!porDesactivar) return
    desactivar.mutate(porDesactivar.id, {
      onSuccess: () => toast.success(`Operador ${porDesactivar.nombre} desactivado`),
      onError: (error) => toast.error('No se pudo desactivar el operador', { description: error.message }),
      onSettled: () => setPorDesactivar(null),
    })
  }

  const columnas: Columna<Operador>[] = [
    { encabezado: 'Nombre', celda: (o) => <span className="font-semibold text-foreground">{o.nombre}</span> },
    { encabezado: 'Licencia', celda: (o) => o.licencia },
    { encabezado: 'Teléfono', celda: (o) => <span className="text-muted-foreground tabular-nums">{o.telefono}</span> },
    {
      encabezado: 'Unidad',
      celda: (o) =>
        o.vehiculo ? (
          <div className="flex flex-col">
            <span className="font-medium">{o.vehiculo.numeroEconomico}</span>
            <span className="text-xs text-muted-foreground">
              {o.vehiculo.tipo} · {o.vehiculo.capacidad} pax
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">Sin unidad</span>
        ),
    },
    {
      encabezado: 'Hora de cita',
      celda: (o) =>
        o.horaCita ? (
          <span className="tabular-nums">{o.horaCita}</span>
        ) : (
          <span className="text-muted-foreground">Sin cita (no participa)</span>
        ),
    },
    {
      encabezado: 'Disponibilidad',
      celda: (o) =>
        o.disponible ? <EstadoBadge texto="Disponible" tono="exito" /> : <EstadoBadge texto="No disponible" tono="neutro" />,
    },
  ]
  if (puedeEscribir) {
    columnas.push({
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (o) => (
        <AccionesFila
          descripcion={o.nombre}
          modo="desactivar"
          quitarDeshabilitado={!o.disponible}
          alEditar={() => {
            guardar.reset()
            setEnEdicion(o)
          }}
          alQuitar={() => setPorDesactivar(o)}
        />
      ),
    })
  }

  return (
    <section>
      <Encabezado
        descripcion="Choferes que pueden recibir servicios."
        textoNuevo="Nuevo operador"
        alNuevo={() => {
          guardar.reset()
          setEnEdicion('nuevo')
        }}
      />

      <BarraFiltros
        buscar={buscar}
        alBuscar={(v) => filtrar(() => setBuscar(v))}
        placeholder="Buscar por nombre, licencia o teléfono…"
        ariaLabel="Buscar operadores"
      >
        <SelectSimple
          ariaLabel="Filtrar por disponibilidad"
          valor={disponible}
          alCambiar={(v) => filtrar(() => setDisponible(v))}
          opciones={FILTRO_DISPONIBLE}
          className="h-9 bg-card sm:w-48"
        />
      </BarraFiltros>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(o) => o.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay operadores con esos filtros."
        iconoVacio={IdCard}
      />
      {listado.data && <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />}

      <DialogoFormulario
        titulo={enEdicion === 'nuevo' ? 'Nuevo operador' : 'Editar operador'}
        descripcion="Datos del chofer y su disponibilidad para el motor de asignación."
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        <FormularioOperador
          key={enEdicion === 'nuevo' ? 'nuevo' : enEdicion?.id}
          inicial={enEdicion === 'nuevo' ? null : enEdicion}
          vehiculos={opcionesVehiculo}
          guardando={guardar.isPending}
          alGuardar={alGuardar}
          alCancelar={() => setEnEdicion(null)}
        />
      </DialogoFormulario>

      <Confirmacion
        titulo="¿Desactivar este operador?"
        mensaje={`${porDesactivar?.nombre ?? ''} quedará como no disponible y no recibirá servicios. No se borra del sistema.`}
        textoConfirmar="Desactivar"
        abierto={porDesactivar !== null}
        procesando={desactivar.isPending}
        alConfirmar={confirmarDesactivar}
        alCancelar={() => setPorDesactivar(null)}
      />
    </section>
  )
}
