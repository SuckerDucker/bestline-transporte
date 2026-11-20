import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// Una sola serie por gráfica: un solo color (validado contra el fondo claro),
// sin leyenda; el título nombra la serie. Rejilla y ejes discretos.
const COLOR = '#0369a1'
const TINTA = '#64748b'
const REJILLA = '#e2e8f0'
const EJE = { fontSize: 12, fill: TINTA }
const ALTO = 240
/** El valor del tooltip va en color de texto, no en el de la serie. */
const TEXTO_TOOLTIP = { color: '#0f172a' }

export interface Punto {
  etiqueta: string
  valor: number
}

/** Tarjeta con título, la gráfica y, debajo, los mismos datos en tabla. */
export function TarjetaGrafica({
  titulo,
  descripcion,
  vacia,
  datos,
  formato,
  children,
}: {
  titulo: string
  descripcion: string
  vacia: boolean
  datos: Punto[]
  formato: (v: number) => string
  children: ReactNode
}) {
  return (
    <figure className="min-w-0 rounded-xl border bg-card p-4 shadow-sm" aria-label={titulo}>
      <figcaption className="mb-3">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{descripcion}</span>
      </figcaption>
      {vacia ? (
        <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">Sin datos en el rango.</p>
      ) : (
        <>
          {children}
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Ver datos en tabla</summary>
            <table className="mt-2 w-full tabular-nums">
              <tbody>
                {datos.map((d) => (
                  <tr key={d.etiqueta} className="border-t">
                    <td className="py-1">{d.etiqueta}</td>
                    <td className="py-1 text-right">{formato(d.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </figure>
  )
}

/** Barras verticales (o horizontales con etiquetas largas). */
export function GraficaBarras({
  datos,
  formato,
  horizontal = false,
  maximo,
  anchoEtiquetas = 150,
}: {
  datos: Punto[]
  formato: (v: number) => string
  horizontal?: boolean
  maximo?: number
  /** Ancho del eje de etiquetas cuando las barras son horizontales. */
  anchoEtiquetas?: number
}) {
  const dominio: [number, number | 'auto'] = [0, maximo ?? 'auto']
  // Horizontal: al menos 28 px por barra para que se lea cada etiqueta.
  const alto = horizontal ? Math.max(ALTO, datos.length * 28 + 32) : ALTO
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart
        data={datos}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 8 : -12 }}
        barCategoryGap={horizontal ? 6 : '20%'}
      >
        <CartesianGrid stroke={REJILLA} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" domain={dominio} tick={EJE} tickFormatter={formato} allowDecimals={false} />
            <YAxis type="category" dataKey="etiqueta" tick={EJE} width={anchoEtiquetas} interval={0} />
          </>
        ) : (
          <>
            <XAxis dataKey="etiqueta" tick={EJE} interval={0} />
            <YAxis domain={dominio} tick={EJE} tickFormatter={formato} allowDecimals={false} />
          </>
        )}
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,.15)' }}
          formatter={(v) => [formato(Number(v)), '']}
          separator=""
          itemStyle={TEXTO_TOOLTIP}
        />
        <Bar
          dataKey="valor"
          fill={COLOR}
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          maxBarSize={36}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Línea de un valor por día, con puntos visibles (puede haber pocos días con rol). */
export function GraficaLinea({ datos, formato }: { datos: Punto[]; formato: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={ALTO}>
      <LineChart data={datos} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={REJILLA} vertical={false} />
        <XAxis dataKey="etiqueta" tick={EJE} />
        <YAxis domain={[0, 100]} tick={EJE} tickFormatter={formato} />
        <Tooltip formatter={(v) => [formato(Number(v)), 'Cobertura']} itemStyle={TEXTO_TOOLTIP} />
        <Line
          type="monotone"
          dataKey="valor"
          stroke={COLOR}
          strokeWidth={2}
          dot={{ r: 4, fill: COLOR, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
