import { X } from 'lucide-react'
import { useState } from 'react'
import { Campo } from '@/components/comunes/Campo'
import { Paginacion } from '@/components/comunes/Paginacion'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TODOS } from '@/lib/opciones'
import { useListado, useRetrasado } from '../catalogos/api'
import { BarraFiltros } from '../catalogos/BarraFiltros'
import type { Zona } from '../catalogos/tipos'
import { useMayoristas } from '../importacion/api'
import { TablaServicios } from './TablaServicios'
import {
  ESTADO_SERVICIO,
  ESTADOS_SERVICIO,
  MODALIDADES,
  NOMBRE_MODALIDAD,
  NOMBRE_TIPO,
  type Servicio,
  TIPOS_SERVICIO,
} from './tipos'

const LIMITE = 20
const FILTROS_VACIOS = {
  fecha: '',
  mayoristaId: TODOS,
  tipo: TODOS,
  modalidad: TODOS,
  zonaId: TODOS,
  estado: TODOS,
}
const opciones = (todos: string, valores: readonly string[], nombre: (v: string) => string) => [
  { valor: TODOS, etiqueta: todos },
  ...valores.map((v) => ({ valor: v, etiqueta: nombre(v) })),
]
const OPCIONES_TIPO = opciones('Todos los tipos', TIPOS_SERVICIO, (v) => NOMBRE_TIPO[v])
const OPCIONES_MODALIDAD = opciones('Todas', MODALIDADES, (v) => NOMBRE_MODALIDAD[v])
const OPCIONES_ESTADO = opciones('Todos los estados', ESTADOS_SERVICIO, (v) => ESTADO_SERVICIO[v as keyof typeof ESTADO_SERVICIO].etiqueta)

/** Servicios importados y de ejemplo, con filtros (solo consulta). */
export function ServiciosPage() {
  const [buscar, setBuscar] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const cambiar = (campo: keyof typeof FILTROS_VACIOS) => (valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  const mayoristas = useMayoristas()
  const zonas = useListado<Zona>('zonas', { limite: 100 })
  const listado = useListado<Servicio>('servicios', {
    ...filtros,
    buscar: useRetrasado(buscar),
    pagina,
    limite: LIMITE,
  })
  const hayFiltros = buscar !== '' || JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS)

  return (
    <section>
      <p className="mb-6 text-sm text-muted-foreground">
        Servicios por atender, ordenados por hora de Cancún. Se cargan desde la importación de los archivos de los
        mayoristas.
      </p>

      <BarraFiltros
        buscar={buscar}
        alBuscar={(v) => {
          setBuscar(v)
          setPagina(1)
        }}
        placeholder="Buscar por folio, localizador o vuelo…"
        ariaLabel="Buscar servicios"
      />

      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[10rem_repeat(5,minmax(0,1fr))_auto] xl:items-end">
        <Campo etiqueta="Fecha" htmlFor="filtro-fecha">
          <Input id="filtro-fecha" type="date" value={filtros.fecha} onChange={(e) => cambiar('fecha')(e.target.value)} />
        </Campo>
        <Campo etiqueta="Mayorista" htmlFor="filtro-mayorista">
          <SelectSimple
            id="filtro-mayorista"
            valor={filtros.mayoristaId}
            alCambiar={cambiar('mayoristaId')}
            opciones={[
              { valor: TODOS, etiqueta: 'Todos' },
              ...(mayoristas.data ?? []).map((m) => ({ valor: String(m.id), etiqueta: m.nombre })),
            ]}
            className="h-9"
          />
        </Campo>
        <Campo etiqueta="Tipo" htmlFor="filtro-tipo">
          <SelectSimple id="filtro-tipo" valor={filtros.tipo} alCambiar={cambiar('tipo')} opciones={OPCIONES_TIPO} className="h-9" />
        </Campo>
        <Campo etiqueta="Modalidad" htmlFor="filtro-modalidad">
          <SelectSimple
            id="filtro-modalidad"
            valor={filtros.modalidad}
            alCambiar={cambiar('modalidad')}
            opciones={OPCIONES_MODALIDAD}
            className="h-9"
          />
        </Campo>
        <Campo etiqueta="Zona (origen o destino)" htmlFor="filtro-zona">
          <SelectSimple
            id="filtro-zona"
            valor={filtros.zonaId}
            alCambiar={cambiar('zonaId')}
            opciones={[
              { valor: TODOS, etiqueta: 'Todas las zonas' },
              ...(zonas.data?.datos ?? []).map((z) => ({ valor: String(z.id), etiqueta: z.nombre })),
            ]}
            className="h-9"
          />
        </Campo>
        <Campo etiqueta="Estado" htmlFor="filtro-estado">
          <SelectSimple id="filtro-estado" valor={filtros.estado} alCambiar={cambiar('estado')} opciones={OPCIONES_ESTADO} className="h-9" />
        </Campo>
        <Button
          variant="ghost"
          disabled={!hayFiltros}
          onClick={() => {
            setFiltros(FILTROS_VACIOS)
            setBuscar('')
            setPagina(1)
          }}
        >
          <X />
          Limpiar
        </Button>
      </div>

      <TablaServicios
        servicios={listado.data?.datos}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay servicios con esos filtros."
      />
      {listado.data && <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />}
    </section>
  )
}
