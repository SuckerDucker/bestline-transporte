import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Campo } from '@/components/comunes/Campo'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { horaCancun, mananaCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { useRol } from '../roles/api'
import { type Parada, type Ruta, useRuta } from './api'
import { COLOR_RUTA, formatoDistancia, formatoDuracion } from './formato'
import { ListaParadas } from './ListaParadas'
import { type Enfoque, MapaRuta } from './MapaRuta'

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/
const SIN_COMPARAR = 'ninguna'

/** /rutas sin fecha: el rol de mañana (el mismo que se revisa). */
export function RedirigirRutasDeManana() {
  return <Navigate to={`/rutas/${mananaCancun()}`} replace />
}

/**
 * Rutas sugeridas (CU-17): recorrido de una unidad en el rol del día sobre el
 * mapa (Leaflet + OpenStreetMap). El trazado por carretera lo pide la API a
 * OSRM; las horas son las del rol. Se puede comparar con otra unidad.
 * La unidad elegida va en la URL (?unidad=3&comparar=5) para poder compartirla
 * y para el enlace "Ver ruta" de Revisar rol.
 */
export function RutasPage() {
  const { fecha = '' } = useParams()
  const navigate = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const valida = FORMATO_FECHA.test(fecha)
  const rol = useRol(valida ? fecha : '')
  const [enfoque, setEnfoque] = useState<Enfoque | null>(null)

  const conServicios = (rol.data?.unidades ?? []).filter((u) => u.asignaciones.length > 0)
  const pedida = Number(parametros.get('unidad'))
  const unidadId = conServicios.find((u) => u.vehiculo.id === pedida)?.vehiculo.id ?? conServicios[0]?.vehiculo.id ?? null
  const pedidaComparar = Number(parametros.get('comparar'))
  const compararId =
    conServicios.find((u) => u.vehiculo.id === pedidaComparar && u.vehiculo.id !== unidadId)?.vehiculo.id ?? null

  const ruta = useRuta(valida ? fecha : '', unidadId)
  const comparada = useRuta(valida ? fecha : '', compararId)

  const opciones = conServicios.map((u) => ({
    valor: String(u.vehiculo.id),
    etiqueta: `${u.vehiculo.numeroEconomico} · ${u.vehiculo.tipo} · ${u.asignaciones.length} servicios`,
  }))
  const cambiar = (clave: 'unidad' | 'comparar', valor: string | null) => {
    const nuevos = new URLSearchParams(parametros)
    if (valor === null) nuevos.delete(clave)
    else nuevos.set(clave, valor)
    setParametros(nuevos, { replace: true })
    setEnfoque(null)
  }
  const elegirParada = (p: Parada) =>
    unidadId !== null &&
    setEnfoque((e) => ({ vehiculoId: unidadId, latitud: p.latitud, longitud: p.longitud, vez: (e?.vez ?? 0) + 1 }))

  return (
    <section className="space-y-6">
      <Card className="py-0 shadow-sm">
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-[12rem_1fr_1fr]">
          <Campo etiqueta="Día de operación" htmlFor="fecha-ruta">
            <Input
              id="fecha-ruta"
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && navigate(`/rutas/${e.target.value}?${parametros.toString()}`)}
            />
          </Campo>
          <Campo etiqueta="Unidad" htmlFor="unidad-ruta">
            <SelectSimple
              id="unidad-ruta"
              ariaLabel="Unidad"
              valor={unidadId === null ? '' : String(unidadId)}
              alCambiar={(v) => cambiar('unidad', v)}
              opciones={opciones}
              placeholder="Sin unidades con servicios"
              deshabilitado={opciones.length === 0}
            />
          </Campo>
          <Campo etiqueta="Comparar con" htmlFor="comparar-ruta">
            <SelectSimple
              id="comparar-ruta"
              ariaLabel="Comparar con"
              valor={compararId === null ? SIN_COMPARAR : String(compararId)}
              alCambiar={(v) => cambiar('comparar', v === SIN_COMPARAR ? null : v)}
              opciones={[
                { valor: SIN_COMPARAR, etiqueta: 'Sin comparar' },
                ...opciones.filter((o) => o.valor !== String(unidadId)),
              ]}
              deshabilitado={opciones.length < 2}
            />
          </Campo>
        </CardContent>
      </Card>

      {!valida ? (
        <Aviso tono="error">La fecha debe tener el formato AAAA-MM-DD.</Aviso>
      ) : rol.isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : rol.error ? (
        <Aviso tono="error">{rol.error.message}</Aviso>
      ) : !rol.data ? (
        <Aviso tono="aviso">Todavía no se ha generado el rol de este día.</Aviso>
      ) : conServicios.length === 0 ? (
        <Aviso tono="aviso">Ninguna unidad tiene servicios en el rol de este día.</Aviso>
      ) : (
        <>
          {ruta.error && <Aviso tono="error">{ruta.error.message}</Aviso>}
          {ruta.data && <Totales ruta={ruta.data} comparada={comparada.data} />}
          {(ruta.data?.trazado === 'aproximado' || comparada.data?.trazado === 'aproximado') && (
            <Aviso tono="aviso">
              Trazado aproximado: no se pudo consultar el servidor de rutas (OSRM). Se muestran líneas rectas entre
              paradas y la distancia es en línea recta; las horas siguen siendo las del rol.
            </Aviso>
          )}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
            <MapaRuta ruta={ruta.data} comparada={comparada.data} enfoque={enfoque} />
            <div className="rounded-xl border bg-card shadow-sm md:max-h-[620px] md:overflow-y-auto">
              <div className="border-b px-4 py-3">
                <h2 className="text-base font-semibold">Paradas</h2>
                {ruta.data && (
                  <p className="text-xs text-muted-foreground">
                    {ruta.data.operador.nombre} · cita {ruta.data.operador.horaCita ?? '—'}
                  </p>
                )}
              </div>
              {ruta.isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                ruta.data && <ListaParadas paradas={ruta.data.paradas} alElegir={elegirParada} />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/** Distancia y duración de manejo (OSRM) de la unidad y de la comparada. */
function Totales({ ruta, comparada }: { ruta: Ruta; comparada?: Ruta }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totales de la ruta">
      <Tarjeta etiqueta="Unidad" valor={ruta.vehiculo.numeroEconomico} color={COLOR_RUTA.principal} />
      <Tarjeta etiqueta="Distancia" valor={formatoDistancia(ruta.distanciaKm)} />
      <Tarjeta etiqueta="Duración de manejo" valor={formatoDuracion(ruta.duracionMin)} />
      <Tarjeta
        etiqueta="Servicios"
        valor={`${ruta.servicios} · ${ruta.paradas[0].salida ? horaCancun(ruta.paradas[0].salida) : '—'} a ${horaFinal(ruta)}`}
      />
      {comparada && (
        <p className="col-span-2 flex items-center gap-2 text-sm md:col-span-4">
          <span className="size-3 rounded-full" style={{ background: COLOR_RUTA.comparada }} aria-hidden />
          <span>
            Comparando con <span className="font-semibold">{comparada.vehiculo.numeroEconomico}</span>:{' '}
            {formatoDistancia(comparada.distanciaKm)} · {formatoDuracion(comparada.duracionMin)} de manejo ·{' '}
            {comparada.servicios} servicios
          </span>
        </p>
      )}
    </div>
  )
}

/** Hora de la última parada con hora (regreso al encierro o último destino). */
function horaFinal(ruta: Ruta) {
  const ultima = [...ruta.paradas].reverse().find((p) => p.llegada)
  return ultima?.llegada ? horaCancun(ultima.llegada) : '—'
}

function Tarjeta({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <p className="flex items-center gap-2 text-xl font-semibold tabular-nums">
        {color && <span className="size-3 rounded-full" style={{ background: color }} aria-hidden />}
        {valor}
      </p>
    </div>
  )
}

const TONO_AVISO = {
  aviso: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
}

function Aviso({ tono, children }: { tono: keyof typeof TONO_AVISO; children: string | string[] }) {
  const Icono = tono === 'aviso' ? TriangleAlert : CircleAlert
  return (
    <p role="status" className={cn('flex items-start gap-2 rounded-lg border px-4 py-3 text-sm', TONO_AVISO[tono])}>
      <Icono className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}
