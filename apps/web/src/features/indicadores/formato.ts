import { MOTIVO, MOTIVOS } from '../roles/api'
import type { Indicadores, TipoIncidencia } from './api'
import type { Punto } from './Graficas'

export const NOMBRE_INCIDENCIA: Record<TipoIncidencia, string> = {
  RETRASO: 'Retraso',
  FALLA_MECANICA: 'Falla mecánica',
  PASAJERO_NO_SE_PRESENTO: 'Pasajero no se presentó',
  CAMBIO_DE_HORA: 'Cambio de hora',
  OTRO: 'Otro',
}

export const porcentaje = (v: number) => `${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`
export const entero = (v: number) => v.toLocaleString('es-MX')
/** "2026-11-10" → "10/11" */
export const diaCorto = (fecha: string) => fecha.slice(8, 10) + '/' + fecha.slice(5, 7)

/** Datos de las cuatro gráficas a partir de la respuesta de la API. */
export function datosGraficas({ resumen, dias }: Indicadores) {
  return {
    coberturaPorDia: dias
      .filter((d) => d.cobertura !== null)
      .map((d): Punto => ({ etiqueta: diaCorto(d.fecha), valor: d.cobertura! })),
    noCubiertosPorMotivo: MOTIVOS.map(
      (m): Punto => ({ etiqueta: MOTIVO[m].etiqueta, valor: resumen.noCubiertosPorMotivo[m] }),
    ),
    ocupacionPorUnidad: resumen.unidades
      .filter((u) => u.ocupacion !== null)
      .map((u): Punto => ({ etiqueta: u.numeroEconomico, valor: Math.round(u.ocupacion! * 1000) / 10 })),
    incidenciasPorTipo: (Object.keys(NOMBRE_INCIDENCIA) as TipoIncidencia[]).map(
      (t): Punto => ({ etiqueta: NOMBRE_INCIDENCIA[t], valor: resumen.incidenciasPorTipo[t] }),
    ),
  }
}

/** AAAA-MM-DD de hace n días (desde la fecha dada). */
export function restarDias(fecha: string, n: number) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
