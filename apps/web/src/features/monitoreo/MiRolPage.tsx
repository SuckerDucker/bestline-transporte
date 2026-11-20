import { Bus, Clock, Loader2, MapPin, Plane, Users } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Campo } from '@/components/comunes/Campo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { horaCancun, hoyCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { ESTADO_SERVICIO, NOMBRE_TIPO } from '../servicios/tipos'
import { type FilaMonitoreo, type MisServicios, useMisServicios } from './api'
import { Aviso } from './Aviso'
import { ACCION_ESTADO, siguientes } from './transiciones'
import { useAplicarEstado } from './useAplicarEstado'

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** /mi-rol sin fecha: el día de hoy. */
export function RedirigirMiRolDeHoy() {
  return <Navigate to={`/mi-rol/${hoyCancun()}`} replace />
}

/**
 * Mi rol (OPERADOR): sus servicios del día en el orden en que los hace, con un
 * botón grande para el siguiente paso de cada uno: "Iniciar" (va hacia la
 * recogida), "Pasajeros a bordo" y "Completar". Pensada primero para celular.
 */
export function MiRolPage() {
  const { fecha = '' } = useParams()
  const navigate = useNavigate()
  const valida = FORMATO_FECHA.test(fecha)
  const consulta = useMisServicios(valida ? fecha : '')
  const datos = consulta.data?.datos

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <Campo etiqueta="Día" htmlFor="fecha-mi-rol">
        <Input
          id="fecha-mi-rol"
          type="date"
          value={fecha}
          onChange={(e) => e.target.value && navigate(`/mi-rol/${e.target.value}`)}
        />
      </Campo>

      {!valida ? (
        <Aviso tono="error">La fecha debe tener el formato AAAA-MM-DD.</Aviso>
      ) : consulta.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : consulta.error ? (
        <Aviso tono="error">{consulta.error.message}</Aviso>
      ) : !datos ? (
        <Aviso tono="aviso">{consulta.data?.aviso ?? 'No hay rol autorizado de este día.'}</Aviso>
      ) : (
        <>
          <Encabezado datos={datos} />
          {datos.servicios.length === 0 ? (
            <Aviso tono="aviso">No tienes servicios asignados este día.</Aviso>
          ) : (
            <ListaServicios fecha={fecha} servicios={datos.servicios} />
          )}
        </>
      )}
    </section>
  )
}

function Encabezado({ datos }: { datos: MisServicios }) {
  const terminados = datos.totales.porEstado.COMPLETADO + datos.totales.porEstado.CANCELADO + datos.totales.porEstado.NO_SHOW
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-lg font-semibold">{datos.operador.nombre}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {datos.vehiculo && (
          <span className="inline-flex items-center gap-1">
            <Bus className="size-4" />
            {datos.vehiculo.numeroEconomico} · {datos.vehiculo.tipo}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock className="size-4" />
          Cita {datos.operador.horaCita ?? '—'}
        </span>
      </p>
      <p className="mt-2 text-sm" role="status">
        {terminados} de {datos.totales.total} servicios terminados
      </p>
    </div>
  )
}

function ListaServicios({ fecha, servicios }: { fecha: string; servicios: FilaMonitoreo[] }) {
  const { aplicar, confirmacion, enCurso } = useAplicarEstado(fecha)
  return (
    <>
      <ol className="space-y-3" aria-label="Mis servicios">
        {servicios.map((f, i) => {
          const s = f.servicio
          const estado = ESTADO_SERVICIO[s.estado]
          const [siguiente] = siguientes(s.estado, 'OPERADOR')
          const ocupado = enCurso === s.id
          return (
            <li
              key={f.asignacionId}
              className={cn('rounded-xl border bg-card p-4 shadow-sm', f.retrasado && 'border-amber-300 bg-amber-50')}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xl font-semibold tabular-nums">
                  <span className="mr-2 text-sm font-normal text-muted-foreground">{i + 1}.</span>
                  {horaCancun(s.fechaHora)}
                </p>
                <EstadoBadge texto={estado.etiqueta} tono={estado.tono} />
              </div>
              <p className="text-sm text-muted-foreground">
                {s.folio} · {NOMBRE_TIPO[s.tipo]} · presentarse {horaCancun(f.inicioEfectivo)}
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {s.zonaOrigen.nombre} → {s.zonaDestino.nombre}
                  {s.hotel && <span className="block text-muted-foreground">{s.hotel.nombre}</span>}
                </span>
              </p>
              <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4" />
                  {s.pasajeros} pax
                </span>
                {s.vuelo && (
                  <span className="inline-flex items-center gap-1">
                    <Plane className="size-4" />
                    {s.vuelo}
                  </span>
                )}
              </p>
              {f.retrasado && <p className="mt-2 text-sm font-medium text-amber-900">Ya pasó la hora y no se ha iniciado.</p>}
              {siguiente && (
                <Button className="mt-3 h-11 w-full text-base" disabled={ocupado} onClick={() => aplicar(f, siguiente)}>
                  {ocupado && <Loader2 className="animate-spin" />}
                  {ACCION_ESTADO[siguiente]}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
      {confirmacion}
    </>
  )
}
