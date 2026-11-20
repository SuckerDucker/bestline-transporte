import { CheckCircle2, CircleAlert, TriangleAlert } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Campo } from '@/components/comunes/Campo'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { hoyCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { useEsMovil } from '@/lib/useEsMovil'
import { Aviso } from '../monitoreo/Aviso'
import { type Indicadores, useIndicadores } from './api'
import { datosGraficas, diaCorto, entero, porcentaje, restarDias } from './formato'
import { GraficaBarras, GraficaLinea, TarjetaGrafica } from './Graficas'

/** Rango por omisión: los últimos 30 días hasta hoy (la API acepta hasta 31). */
const DIAS_POR_OMISION = 29
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Indicadores (Fase 14): tarjetas KPI y gráficas de un rango de días con
 * Recharts. El rango va en la URL (?desde&hasta) para poder compartirlo.
 */
export function IndicadoresPage() {
  const [parametros, setParametros] = useSearchParams()
  const hoy = hoyCancun()
  const hasta = parametros.get('hasta') ?? hoy
  const desde = parametros.get('desde') ?? restarDias(hasta, DIAS_POR_OMISION)
  const validas = FORMATO_FECHA.test(desde) && FORMATO_FECHA.test(hasta)
  const consulta = useIndicadores(validas ? desde : '', validas ? hasta : '')

  const cambiar = (clave: 'desde' | 'hasta', valor: string) => {
    if (!valor) return
    setParametros({ desde, hasta, [clave]: valor }, { replace: true })
  }

  return (
    <section className="space-y-6">
      <Card className="py-0 shadow-sm">
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-[12rem_12rem_1fr] sm:items-end">
          <Campo etiqueta="Desde" htmlFor="desde">
            <Input id="desde" type="date" value={desde} max={hasta} onChange={(e) => cambiar('desde', e.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta" htmlFor="hasta">
            <Input id="hasta" type="date" value={hasta} min={desde} onChange={(e) => cambiar('hasta', e.target.value)} />
          </Campo>
          <p className="text-xs text-muted-foreground sm:pb-2">Máximo 31 días. Solo cuentan los días con rol generado.</p>
        </CardContent>
      </Card>

      {!validas ? (
        <Aviso tono="error">Las fechas deben tener el formato AAAA-MM-DD.</Aviso>
      ) : consulta.isLoading ? (
        <div className="space-y-4" aria-label="Cargando indicadores">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        </div>
      ) : consulta.error ? (
        <Aviso tono="error">{consulta.error.message}</Aviso>
      ) : consulta.data && consulta.data.resumen.diasConRol === 0 ? (
        <Aviso tono="aviso">No hay roles generados en este rango. Elige otras fechas.</Aviso>
      ) : (
        consulta.data && <Contenido datos={consulta.data} />
      )}
    </section>
  )
}

function Contenido({ datos }: { datos: Indicadores }) {
  const { resumen } = datos
  const g = datosGraficas(datos)
  const sinEmpalmes = resumen.empalmes === 0
  const esMovil = useEsMovil()
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores clave">
        <Kpi
          etiqueta="Cobertura"
          valor={resumen.cobertura === null ? '—' : porcentaje(resumen.cobertura)}
          detalle={`${entero(resumen.asignados)} de ${entero(resumen.asignados + resumen.noCubiertos)} servicios asignados`}
        />
        <Kpi
          etiqueta="Empalmes"
          valor={resumen.empalmes === null ? '—' : entero(resumen.empalmes)}
          detalle={resumen.empalmes === null ? 'Sin roles autorizados en el rango' : 'En roles autorizados (verificador)'}
          estado={resumen.empalmes === null ? undefined : sinEmpalmes ? 'bien' : 'mal'}
        />
        <Kpi
          etiqueta="Completados"
          valor={entero(resumen.completados)}
          detalle={`${entero(resumen.cancelados)} cancelados · ${entero(resumen.noShow)} no show`}
        />
        <Kpi
          etiqueta="Incidencias"
          valor={entero(resumen.incidencias)}
          detalle={`Ocupación promedio ${resumen.ocupacion === null ? '—' : porcentaje(resumen.ocupacion * 100)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafica
          titulo="Cobertura por día"
          descripcion="Porcentaje de servicios del rol que quedaron asignados (días con rol)."
          vacia={g.coberturaPorDia.length === 0}
          datos={g.coberturaPorDia}
          formato={porcentaje}
        >
          <GraficaLinea datos={g.coberturaPorDia} formato={porcentaje} />
        </TarjetaGrafica>
        <TarjetaGrafica
          titulo="No cubiertos por motivo"
          descripcion="Servicios que el motor no pudo asignar, sumados en el rango."
          vacia={resumen.noCubiertos === 0}
          datos={g.noCubiertosPorMotivo}
          formato={entero}
        >
          <GraficaBarras datos={g.noCubiertosPorMotivo} formato={entero} horizontal anchoEtiquetas={110} />
        </TarjetaGrafica>
        <TarjetaGrafica
          titulo="Ocupación por unidad"
          descripcion="Promedio de pasajeros / capacidad de los servicios de cada unidad."
          vacia={g.ocupacionPorUnidad.length === 0}
          datos={g.ocupacionPorUnidad}
          formato={porcentaje}
        >
          {/* En celular, 10 unidades no caben como columnas: barras horizontales. */}
          <GraficaBarras
            datos={g.ocupacionPorUnidad}
            formato={porcentaje}
            maximo={100}
            horizontal={esMovil}
            anchoEtiquetas={52}
          />
        </TarjetaGrafica>
        <TarjetaGrafica
          titulo="Incidencias por tipo"
          descripcion="Incidencias registradas en el monitoreo."
          vacia={resumen.incidencias === 0}
          datos={g.incidenciasPorTipo}
          formato={entero}
        >
          <GraficaBarras datos={g.incidenciasPorTipo} formato={entero} horizontal />
        </TarjetaGrafica>
      </div>

      <TablaDias datos={datos} />
    </>
  )
}

function Kpi({
  etiqueta,
  valor,
  detalle,
  estado,
}: {
  etiqueta: string
  valor: string
  detalle: string
  estado?: 'bien' | 'mal'
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
        {valor}
        {estado === 'bien' && <CheckCircle2 className="size-5 text-emerald-600" aria-label="Correcto" />}
        {estado === 'mal' && <TriangleAlert className="size-5 text-red-600" aria-label="Revisar" />}
      </p>
      <p className="text-xs text-muted-foreground">{detalle}</p>
    </div>
  )
}

/** Indicadores de cada día con rol (también sirve como vista en tabla). */
function TablaDias({ datos }: { datos: Indicadores }) {
  const dias = datos.dias.filter((d) => d.estadoRol !== null)
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Por día</h2>
      </div>
      <Table aria-label="Indicadores por día">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Día</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="text-right">Servicios</TableHead>
            <TableHead className="text-right">Asignados</TableHead>
            <TableHead className="text-right">No cubiertos</TableHead>
            <TableHead className="text-right">Cobertura</TableHead>
            <TableHead className="text-right">Empalmes</TableHead>
            <TableHead className="text-right">Completados</TableHead>
            <TableHead className="text-right">Incidencias</TableHead>
            <TableHead className="text-right">Ocupación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dias.map((d) => (
            <TableRow key={d.fecha} className="tabular-nums">
              <TableCell className="font-medium">{diaCorto(d.fecha)}</TableCell>
              <TableCell>{d.estadoRol === 'AUTORIZADO' ? 'Autorizado' : 'Propuesto'}</TableCell>
              <TableCell className="text-right">{d.servicios}</TableCell>
              <TableCell className="text-right">{d.asignados}</TableCell>
              <TableCell className="text-right">{d.noCubiertos}</TableCell>
              <TableCell className="text-right">{d.cobertura === null ? '—' : porcentaje(d.cobertura)}</TableCell>
              <TableCell className={cn('text-right', d.empalmes && 'font-semibold text-red-700')}>
                {d.empalmes === null ? '—' : d.empalmes}
              </TableCell>
              <TableCell className="text-right">{d.completados}</TableCell>
              <TableCell className="text-right">{d.incidencias}</TableCell>
              <TableCell className="text-right">{d.ocupacion === null ? '—' : porcentaje(d.ocupacion * 100)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="flex items-center gap-1.5 border-t px-4 py-2 text-xs text-muted-foreground">
        <CircleAlert className="size-3.5" />
        Empalmes "—": el rol del día sigue PROPUESTO; el verificador se corre sobre los roles autorizados.
      </p>
    </div>
  )
}
