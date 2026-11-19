import { Clock, MoreHorizontal, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/contexto'
import { Campo } from '@/components/comunes/Campo'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { horaCancun, hoyCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { useEsMovil } from '@/lib/useEsMovil'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { ESTADO_SERVICIO, NOMBRE_MODALIDAD, NOMBRE_TIPO } from '../servicios/tipos'
import {
  ESTADOS_TABLERO,
  type FilaMonitoreo,
  type Incidencia,
  NOMBRE_INCIDENCIA,
  REFRESCO_MS,
  type Tablero,
  useIncidencias,
  useRegistrarIncidencia,
  useTablero,
} from './api'
import { Aviso } from './Aviso'
import { filtrar, RETRASADOS, TODOS } from './filtros'
import { DialogoIncidencia } from './DialogoIncidencia'
import type { ValoresIncidencia } from './esquema'
import { ACCION_ESTADO, siguientes } from './transiciones'
import { useAplicarEstado } from './useAplicarEstado'

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** /monitoreo sin fecha: el día de hoy. */
export function RedirigirMonitoreoDeHoy() {
  return <Navigate to={`/monitoreo/${hoyCancun()}`} replace />
}

/**
 * Monitoreo del día: servicios del rol AUTORIZADO con su estado, totales por
 * estado, filtros, cambio de estado según la tabla de transiciones e
 * incidencias. Se actualiza solo cada 30 s; los servicios retrasados (hora
 * pasada y siguen PROGRAMADO) se resaltan.
 */
export function MonitoreoPage() {
  const { fecha = '' } = useParams()
  const navigate = useNavigate()
  const valida = FORMATO_FECHA.test(fecha)
  const tablero = useTablero(valida ? fecha : '')
  const incidencias = useIncidencias(fecha, valida && !!tablero.data)
  const [estado, setEstado] = useState(TODOS)
  const [unidad, setUnidad] = useState(TODOS)

  const datos = tablero.data
  const unidades = [...new Map((datos?.servicios ?? []).map((f) => [f.vehiculo.id, f.vehiculo])).values()].sort((a, b) =>
    a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', { numeric: true }),
  )
  const filas = datos ? filtrar(datos.servicios, estado, unidad) : []

  return (
    <section className="space-y-6">
      <Card className="py-0 shadow-sm">
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-3 lg:grid-cols-[12rem_1fr_1fr]">
          <Campo etiqueta="Día de operación" htmlFor="fecha-monitoreo">
            <Input
              id="fecha-monitoreo"
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && navigate(`/monitoreo/${e.target.value}`)}
            />
          </Campo>
          <Campo etiqueta="Estado" htmlFor="filtro-estado">
            <SelectSimple
              id="filtro-estado"
              ariaLabel="Filtrar por estado"
              valor={estado}
              alCambiar={setEstado}
              opciones={[
                { valor: TODOS, etiqueta: 'Todos los estados' },
                { valor: RETRASADOS, etiqueta: 'Retrasados' },
                ...ESTADOS_TABLERO.map((e) => ({ valor: e, etiqueta: ESTADO_SERVICIO[e].etiqueta })),
              ]}
            />
          </Campo>
          <Campo etiqueta="Unidad" htmlFor="filtro-unidad">
            <SelectSimple
              id="filtro-unidad"
              ariaLabel="Filtrar por unidad"
              valor={unidad}
              alCambiar={setUnidad}
              opciones={[
                { valor: TODOS, etiqueta: 'Todas las unidades' },
                ...unidades.map((u) => ({ valor: String(u.id), etiqueta: `${u.numeroEconomico} · ${u.tipo}` })),
              ]}
            />
          </Campo>
        </CardContent>
      </Card>

      {!valida ? (
        <Aviso tono="error">La fecha debe tener el formato AAAA-MM-DD.</Aviso>
      ) : tablero.isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : tablero.error ? (
        <Aviso tono="error">{tablero.error.message}</Aviso>
      ) : !datos ? (
        <Aviso tono="aviso">No hay rol autorizado de este día. El monitoreo empieza cuando se autoriza el rol.</Aviso>
      ) : (
        <>
          <TarjetasTotales
            tablero={datos}
            seleccionado={estado}
            alElegir={(e) => setEstado((actual) => (actual === e ? TODOS : e))}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Clock className="size-3.5" />
            Actualizado a las {horaCancun(new Date(tablero.dataUpdatedAt).toISOString())} · se actualiza cada{' '}
            {REFRESCO_MS / 1000} s
          </p>
          <ServiciosDelDia fecha={fecha} filas={filas} />
          <ListaIncidencias incidencias={incidencias.data} cargando={incidencias.isLoading} />
        </>
      )}
    </section>
  )
}

const TONO_TARJETA = {
  PROGRAMADO: 'text-sky-700',
  EN_RUTA: 'text-amber-700',
  EN_SERVICIO: 'text-violet-700',
  COMPLETADO: 'text-emerald-700',
  CANCELADO: 'text-slate-600',
  NO_SHOW: 'text-red-700',
} as const

/** Una tarjeta por estado y una de retrasados; al pulsarla se filtra la tabla. */
function TarjetasTotales({
  tablero,
  seleccionado,
  alElegir,
}: {
  tablero: Tablero
  seleccionado: string
  alElegir: (estado: string) => void
}) {
  const tarjetas = [
    ...ESTADOS_TABLERO.map((e) => ({
      clave: e,
      etiqueta: ESTADO_SERVICIO[e].etiqueta,
      valor: tablero.totales.porEstado[e],
      color: TONO_TARJETA[e],
    })),
    { clave: RETRASADOS, etiqueta: 'Retrasados', valor: tablero.totales.retrasados, color: 'text-amber-700' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7" aria-label="Totales por estado">
      {tarjetas.map((t) => (
        <button
          key={t.clave}
          type="button"
          onClick={() => alElegir(t.clave)}
          aria-pressed={seleccionado === t.clave}
          className={cn(
            'rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition hover:shadow-md',
            seleccionado === t.clave && 'ring-2 ring-primary',
            t.clave === RETRASADOS && t.valor > 0 && 'border-amber-300 bg-amber-50',
          )}
        >
          <span className="block text-xs font-medium text-muted-foreground">{t.etiqueta}</span>
          <span className={cn('block text-2xl font-semibold tabular-nums', t.color)}>{t.valor}</span>
        </button>
      ))}
    </div>
  )
}

/** Tabla en escritorio y tarjetas en celular, con las acciones de cada servicio. */
function ServiciosDelDia({ fecha, filas }: { fecha: string; filas: FilaMonitoreo[] }) {
  const esMovil = useEsMovil()
  const { aplicar, confirmacion, enCurso } = useAplicarEstado(fecha)
  const registrar = useRegistrarIncidencia(fecha)
  const [conIncidencia, setConIncidencia] = useState<FilaMonitoreo | null>(null)

  const guardarIncidencia = (valores: ValoresIncidencia) =>
    conIncidencia &&
    registrar.mutate(
      { servicioId: conIncidencia.servicio.id, ...valores },
      {
        onSuccess: () => {
          toast.success('Incidencia registrada', { description: conIncidencia.servicio.folio })
          setConIncidencia(null)
        },
        onError: (error) => toast.error('No se registró la incidencia', { description: error.message }),
      },
    )

  const acciones = (f: FilaMonitoreo) => (
    <Acciones fila={f} ocupado={enCurso === f.servicio.id} alAplicar={aplicar} alIncidencia={setConIncidencia} />
  )

  return (
    <>
      {filas.length === 0 ? (
        <Aviso tono="aviso">No hay servicios con esos filtros.</Aviso>
      ) : esMovil ? (
        <ul className="space-y-3" aria-label="Servicios del día">
          {filas.map((f) => (
            <li
              key={f.asignacionId}
              className={cn('rounded-xl border bg-card p-4 shadow-sm', f.retrasado && 'border-amber-300 bg-amber-50')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums">
                    {horaCancun(f.servicio.fechaHora)} · {f.servicio.folio}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {f.vehiculo.numeroEconomico} · {f.operador.nombre}
                  </p>
                </div>
                {acciones(f)}
              </div>
              <p className="mt-2 text-sm">
                {f.servicio.zonaOrigen.nombre} → {f.servicio.hotel?.nombre ?? f.servicio.zonaDestino.nombre} ·{' '}
                {f.servicio.pasajeros} pax
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Estado fila={f} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table aria-label="Servicios del día">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Hora</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Origen → destino</TableHead>
                <TableHead className="text-right">Pax</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow
                  key={f.asignacionId}
                  data-retrasado={f.retrasado || undefined}
                  className={cn(f.retrasado && 'bg-amber-50 hover:bg-amber-100/70')}
                >
                  <TableCell className="tabular-nums">
                    <span className="font-medium">{horaCancun(f.servicio.fechaHora)}</span>
                    {f.servicio.inicioReal && (
                      <span className="block text-xs text-muted-foreground">
                        inició {horaCancun(f.servicio.inicioReal)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{f.servicio.folio}</span>
                    <span className="block text-xs text-muted-foreground">
                      {NOMBRE_TIPO[f.servicio.tipo]} · {NOMBRE_MODALIDAD[f.servicio.modalidad]}
                    </span>
                  </TableCell>
                  <TableCell>{f.vehiculo.numeroEconomico}</TableCell>
                  <TableCell className="max-w-40 truncate">{f.operador.nombre}</TableCell>
                  <TableCell className="max-w-64">
                    <span className="block truncate">
                      {f.servicio.zonaOrigen.nombre} → {f.servicio.zonaDestino.nombre}
                    </span>
                    {f.servicio.hotel && (
                      <span className="block truncate text-xs text-muted-foreground">{f.servicio.hotel.nombre}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{f.servicio.pasajeros}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Estado fila={f} />
                    </div>
                  </TableCell>
                  <TableCell>{acciones(f)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {confirmacion}
      <DialogoIncidencia
        folio={conIncidencia?.servicio.folio ?? null}
        guardando={registrar.isPending}
        alGuardar={guardarIncidencia}
        alCerrar={() => setConIncidencia(null)}
      />
    </>
  )
}

/** Badge del estado, "Retrasado" y número de incidencias. */
function Estado({ fila }: { fila: FilaMonitoreo }) {
  const e = ESTADO_SERVICIO[fila.servicio.estado]
  return (
    <>
      <EstadoBadge texto={e.etiqueta} tono={e.tono} />
      {fila.retrasado && (
        <Badge variant="outline" className="h-6 border-amber-300 bg-amber-100 text-amber-900">
          <TriangleAlert className="size-3" />
          Retrasado
        </Badge>
      )}
      {fila.incidencias > 0 && (
        <Badge variant="outline" className="h-6 border-red-200 bg-red-50 text-red-700">
          {fila.incidencias} {fila.incidencias === 1 ? 'incidencia' : 'incidencias'}
        </Badge>
      )}
    </>
  )
}

/** Menú con las transiciones posibles desde el estado actual e "Incidencia". */
function Acciones({
  fila,
  ocupado,
  alAplicar,
  alIncidencia,
}: {
  fila: FilaMonitoreo
  ocupado: boolean
  alAplicar: (fila: FilaMonitoreo, estado: FilaMonitoreo['servicio']['estado']) => void
  alIncidencia: (fila: FilaMonitoreo) => void
}) {
  const { usuario } = useAuth()
  const posibles = usuario ? siguientes(fila.servicio.estado, usuario.rol) : []
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={ocupado} aria-label={`Acciones de ${fila.servicio.folio}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {posibles.map((e) => (
          <DropdownMenuItem
            key={e}
            onSelect={() => alAplicar(fila, e)}
            variant={e === 'CANCELADO' || e === 'NO_SHOW' ? 'destructive' : 'default'}
          >
            {ACCION_ESTADO[e]}
          </DropdownMenuItem>
        ))}
        {posibles.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => alIncidencia(fila)}>Registrar incidencia</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Incidencias del día, las más nuevas primero. */
function ListaIncidencias({ incidencias, cargando }: { incidencias?: Incidencia[]; cargando: boolean }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Incidencias del día</h2>
      </div>
      {cargando ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !incidencias?.length ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Sin incidencias registradas.</p>
      ) : (
        <ul className="divide-y" aria-label="Incidencias del día">
          {incidencias.map((i) => (
            <li key={i.id} className="space-y-0.5 px-4 py-3 text-sm">
              <p className="flex flex-wrap items-center gap-x-2 font-medium">
                <span className="tabular-nums text-muted-foreground">{horaCancun(i.fecha)}</span>
                {NOMBRE_INCIDENCIA[i.tipo]} · {i.servicio.folio}
                {i.vehiculo && <span className="text-muted-foreground">· {i.vehiculo.numeroEconomico}</span>}
              </p>
              <p>{i.descripcion}</p>
              <p className="text-xs text-muted-foreground">Registró {i.usuario.nombre}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
