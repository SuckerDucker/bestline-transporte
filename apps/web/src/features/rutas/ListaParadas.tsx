import { House } from 'lucide-react'
import { horaCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { Parada } from './api'
import { COLOR_RUTA, DESCRIPCION_PARADA, numerarParadas } from './formato'

interface Props {
  paradas: Parada[]
  alElegir: (parada: Parada) => void
}

/** Horas de la parada (las del rol): "Llega 05:50 · Sale 06:00". */
function horas(p: Parada) {
  const partes: string[] = []
  if (p.llegada) partes.push(`Llega ${horaCancun(p.llegada)}`)
  if (p.salida && p.salida !== p.llegada) partes.push(`Sale ${horaCancun(p.salida)}`)
  return partes.length ? partes.join(' · ') : 'Hora no disponible'
}

/** Paradas de la unidad en orden; al elegir una, el mapa la centra. */
export function ListaParadas({ paradas, alElegir }: Props) {
  return (
    <ol className="divide-y" aria-label="Paradas de la ruta">
      {numerarParadas(paradas).map((p) => (
        <li key={p.orden}>
          <button
            type="button"
            onClick={() => alElegir(p)}
            aria-label={[
              `${p.numero === null ? '' : `${p.numero}. `}${DESCRIPCION_PARADA[p.tipo]}${p.servicio ? ` ${p.servicio.folio}` : ''}`,
              p.nombre,
              horas(p),
            ].join(', ')}
            className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
          >
            <span
              className={cn(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center text-[11px] font-semibold text-white',
                p.numero === null ? 'rounded-md bg-slate-900' : 'rounded-full',
              )}
              style={p.numero === null ? undefined : { background: COLOR_RUTA.principal }}
              aria-hidden
            >
              {p.numero ?? <House className="size-3.5" />}
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block font-medium">
                {DESCRIPCION_PARADA[p.tipo]}
                {p.servicio && <span className="text-muted-foreground"> · {p.servicio.folio}</span>}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {p.nombre}
                {p.nombre !== p.zona && ` (${p.zona})`}
              </span>
              <span className="block text-xs tabular-nums">
                {horas(p)}
                {p.horaCita && <span className="text-muted-foreground"> · cita {horaCancun(p.horaCita)}</span>}
                {p.servicio && p.tipo === 'ORIGEN' && (
                  <span className="text-muted-foreground"> · {p.servicio.pasajeros} pax</span>
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
