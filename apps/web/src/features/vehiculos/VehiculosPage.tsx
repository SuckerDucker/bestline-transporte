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
import {
  ESTADOS_VEHICULO,
  NOMBRE_ESTADO_VEHICULO,
  TIPOS_VEHICULO,
  type Vehiculo,
} from '../catalogos/tipos'
import type { ValoresVehiculo } from './esquema'
import { FormularioVehiculo } from './FormularioVehiculo'

const LIMITE = 10
const COLOR_ESTADO = { DISPONIBLE: 'verde', MANTENIMIENTO: 'ambar', BAJA: 'gris' } as const

export function VehiculosPage() {
  const puedeEscribir = usePuedeEscribir()
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  // null = modal cerrado; 'nuevo' = alta; un vehículo = edición
  const [enEdicion, setEnEdicion] = useState<Vehiculo | 'nuevo' | null>(null)
  const [porDesactivar, setPorDesactivar] = useState<Vehiculo | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const buscarRetrasado = useRetrasado(buscar)
  const listado = useListado<Vehiculo>('vehiculos', {
    buscar: buscarRetrasado,
    tipo,
    estado,
    pagina,
    limite: LIMITE,
  })
  const guardar = useGuardar<Vehiculo>('vehiculos')
  const desactivar = useQuitar('vehiculos', 'desactivar')

  const cambiarFiltro = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const abrirFormulario = (valor: Vehiculo | 'nuevo') => {
    guardar.reset()
    setExito(null)
    setEnEdicion(valor)
  }
  const alGuardar = (valores: ValoresVehiculo) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: valores },
      {
        onSuccess: () => {
          setEnEdicion(null)
          setExito(`Vehículo ${valores.numeroEconomico} ${id ? 'actualizado' : 'dado de alta'}.`)
        },
      },
    )
  }
  const confirmarDesactivar = () => {
    if (!porDesactivar) return
    desactivar.mutate(porDesactivar.id, {
      onSuccess: () => {
        setExito(`Vehículo ${porDesactivar.numeroEconomico} dado de baja.`)
        setPorDesactivar(null)
      },
    })
  }

  const columnas: Columna<Vehiculo>[] = [
    { encabezado: 'No. económico', celda: (v) => <span className="font-medium">{v.numeroEconomico}</span> },
    { encabezado: 'Tipo', celda: (v) => v.tipo },
    { encabezado: 'Capacidad', celda: (v) => `${v.capacidad} pax`, alineacion: 'derecha' },
    { encabezado: 'Encierro base', celda: (v) => v.encierroBase },
    {
      encabezado: 'Estado',
      celda: (v) => <Insignia texto={NOMBRE_ESTADO_VEHICULO[v.estado]} color={COLOR_ESTADO[v.estado]} />,
    },
  ]
  if (puedeEscribir) {
    columnas.push({
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (v) => (
        <div className="flex justify-end gap-3">
          <button type="button" className="boton-enlace" onClick={() => abrirFormulario(v)}>
            Editar
          </button>
          <button
            type="button"
            className="boton-enlace text-red-600 disabled:text-slate-300 disabled:no-underline"
            disabled={v.estado === 'BAJA'}
            onClick={() => {
              desactivar.reset()
              setPorDesactivar(v)
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
        titulo="Vehículos"
        descripcion="Flota disponible para los servicios."
        textoNuevo="Nuevo vehículo"
        alNuevo={() => abrirFormulario('nuevo')}
      />

      <div className="mb-4 space-y-3">
        <Aviso tipo="exito" mensaje={exito} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="search"
            aria-label="Buscar vehículos"
            placeholder="Buscar por número económico o encierro…"
            value={buscar}
            onChange={(e) => cambiarFiltro(() => setBuscar(e.target.value))}
            className={claseEntrada(false)}
          />
          <select
            aria-label="Filtrar por tipo"
            value={tipo}
            onChange={(e) => cambiarFiltro(() => setTipo(e.target.value))}
            className={claseEntrada(false)}
          >
            <option value="">Todos los tipos</option>
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por estado"
            value={estado}
            onChange={(e) => cambiarFiltro(() => setEstado(e.target.value))}
            className={claseEntrada(false)}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_VEHICULO.map((e) => (
              <option key={e} value={e}>
                {NOMBRE_ESTADO_VEHICULO[e]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(v) => v.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay vehículos con esos filtros."
      />
      {listado.data && (
        <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />
      )}

      <Modal
        titulo={enEdicion === 'nuevo' ? 'Nuevo vehículo' : 'Editar vehículo'}
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        <FormularioVehiculo
          key={enEdicion === 'nuevo' ? 'nuevo' : enEdicion?.id}
          inicial={enEdicion === 'nuevo' ? null : enEdicion}
          guardando={guardar.isPending}
          error={guardar.error?.message ?? null}
          alGuardar={alGuardar}
          alCancelar={() => setEnEdicion(null)}
        />
      </Modal>

      <Confirmacion
        titulo="Desactivar vehículo"
        mensaje={`¿Dar de baja el vehículo ${porDesactivar?.numeroEconomico ?? ''}? Pasará a estado BAJA y no se asignará a servicios. No se borra.`}
        textoConfirmar="Dar de baja"
        abierto={porDesactivar !== null}
        procesando={desactivar.isPending}
        error={desactivar.error?.message}
        alConfirmar={confirmarDesactivar}
        alCancelar={() => setPorDesactivar(null)}
      />
    </section>
  )
}
