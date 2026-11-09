import { ChevronRight, FileUp, History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/contexto'
import { Paginacion } from '@/components/comunes/Paginacion'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { TablaDatos, type Columna } from '@/components/comunes/TablaDatos'
import { Button } from '@/components/ui/button'
import { ROLES_IMPORTAR } from '@/layout/menu'
import { diaYHoraCancun } from '@/lib/fechas'
import { TODOS } from '@/lib/opciones'
import { useListado, useRetrasado } from '../catalogos/api'
import { BarraFiltros } from '../catalogos/BarraFiltros'
import { type Importacion, useMayoristas } from './api'

const LIMITE = 10

const COLUMNAS: Columna<Importacion>[] = [
  { encabezado: 'Fecha', celda: (i) => <span className="whitespace-nowrap tabular-nums">{diaYHoraCancun(i.fecha)}</span> },
  { encabezado: 'Archivo', celda: (i) => <span className="font-medium text-foreground">{i.archivo}</span> },
  { encabezado: 'Mayorista', celda: (i) => i.mayorista.nombre },
  { encabezado: 'Importó', celda: (i) => i.usuario.nombre },
  {
    encabezado: 'Servicios',
    alineacion: 'derecha',
    celda: (i) => <span className="font-semibold text-emerald-700 tabular-nums">{i.filasValidas}</span>,
  },
  {
    encabezado: 'Rechazadas',
    alineacion: 'derecha',
    celda: (i) => <span className="text-muted-foreground tabular-nums">{i.filasRechazadas}</span>,
  },
  {
    encabezado: 'Detalle',
    alineacion: 'derecha',
    celda: (i) => (
      <Button asChild variant="ghost" size="sm">
        <Link to={`/importaciones/${i.id}`} aria-label={`Ver la importación ${i.archivo}`}>
          Ver
          <ChevronRight />
        </Link>
      </Button>
    ),
  },
]

/** Historial de importaciones, de la más reciente a la más antigua. */
export function HistorialPage() {
  const rol = useAuth().usuario?.rol
  const mayoristas = useMayoristas()
  const [buscar, setBuscar] = useState('')
  const [mayoristaId, setMayoristaId] = useState(TODOS)
  const [pagina, setPagina] = useState(1)
  const listado = useListado<Importacion>('importaciones', {
    buscar: useRetrasado(buscar),
    mayoristaId,
    pagina,
    limite: LIMITE,
  })

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Archivos importados, con cuántos servicios se guardaron y cuántas filas se rechazaron.</p>
        {rol && ROLES_IMPORTAR.includes(rol) && (
          <Button asChild className="shrink-0">
            <Link to="/importar">
              <FileUp />
              Importar servicios
            </Link>
          </Button>
        )}
      </div>

      <BarraFiltros
        buscar={buscar}
        alBuscar={(v) => {
          setBuscar(v)
          setPagina(1)
        }}
        placeholder="Buscar por nombre de archivo…"
        ariaLabel="Buscar importaciones"
      >
        <SelectSimple
          ariaLabel="Filtrar por mayorista"
          valor={mayoristaId}
          alCambiar={(v) => {
            setMayoristaId(v)
            setPagina(1)
          }}
          opciones={[
            { valor: TODOS, etiqueta: 'Todos los mayoristas' },
            ...(mayoristas.data ?? []).map((m) => ({ valor: String(m.id), etiqueta: m.nombre })),
          ]}
          className="h-9 bg-card sm:w-52"
        />
      </BarraFiltros>

      <TablaDatos
        columnas={COLUMNAS}
        filas={listado.data?.datos}
        clave={(i) => i.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="Todavía no hay importaciones."
        iconoVacio={History}
      />
      {listado.data && <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />}
    </section>
  )
}
