import { minutosDelDia } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { AsignacionRol, UnidadRol } from './api'
import { DatosUnidad } from './DatosUnidad'
import { COLOR_MODALIDAD, describirServicio } from './formato'

interface Props {
  fecha: string
  unidades: UnidadRol[]
  /** Si se puede mover (COORDINADOR o ADMINISTRADOR con el rol PROPUESTO). */
  editable: boolean
  alElegir: (asignacion: AsignacionRol) => void
}

/**
 * Línea de tiempo del rol (escritorio): una fila por unidad y, en ella, cada
 * servicio como una barra del inicio efectivo a la liberación, precedida de su
 * traslado en vacío (tenue). Todo se ubica en minutos del día de Cancún como
 * porcentaje del rango visible; lo que queda fuera de la jornada va sombreado.
 */
export function LineaTiempo({ fecha, unidades, editable, alElegir }: Props) {
  const m = (iso: string) => minutosDelDia(iso, fecha)
  const { desde, hasta } = rango(unidades, m)
  const total = hasta - desde
  const pos = (inicio: number, fin: number) => ({
    left: `${((inicio - desde) / total) * 100}%`,
    width: `${(Math.max(fin - inicio, 0) / total) * 100}%`,
  })
  const horas = Array.from({ length: total / 60 + 1 }, (_, i) => desde + i * 60)

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <div className="min-w-[960px]">
        {/* Eje de horas */}
        <div className="grid grid-cols-[13rem_1fr] border-b text-xs text-muted-foreground">
          <div className="px-4 py-2 font-medium">Unidad</div>
          <div className="relative h-8">
            {horas.map((h) => (
              <span key={h} className="absolute top-2 -translate-x-1/2 tabular-nums" style={{ left: pos(h, h).left }}>
                {String(Math.floor(h / 60) % 24).padStart(2, '0')}:00
              </span>
            ))}
          </div>
        </div>

        <ul aria-label="Línea de tiempo por unidad">
          {unidades.map((u) => {
            const cita = u.cita ? m(u.cita) : desde
            const fin = u.finJornada ? m(u.finJornada) : hasta
            return (
              <li
                key={u.vehiculo.id}
                aria-label={u.vehiculo.numeroEconomico}
                className="grid grid-cols-[13rem_1fr] border-b last:border-b-0"
              >
                <DatosUnidad unidad={u} className="px-4 py-2" />
                <div className="relative my-2 h-12">
                  {horas.map((h) => (
                    <span key={h} className="absolute inset-y-0 w-px bg-border" style={{ left: pos(h, h).left }} aria-hidden />
                  ))}
                  {/* Fuera de la jornada (antes de la cita y después del fin) */}
                  <span className="absolute inset-y-0 bg-muted" style={pos(desde, cita)} aria-hidden />
                  <span className="absolute inset-y-0 bg-muted" style={pos(fin, hasta)} aria-hidden />
                  {u.asignaciones.map((a) => {
                    const inicio = m(a.inicioEfectivo)
                    const libera = m(a.liberacion)
                    const etiqueta = describirServicio(a)
                    const clase = cn(
                      'absolute inset-y-1 overflow-hidden rounded-md px-1 text-left text-[11px] leading-tight font-medium text-white shadow-sm',
                      COLOR_MODALIDAD[a.servicio.modalidad] ?? 'bg-slate-600',
                    )
                    return (
                      <div key={a.id}>
                        {a.vacio && (
                          <span
                            className="absolute inset-y-4 rounded-sm border border-dashed border-slate-400/70 bg-slate-300/40"
                            style={pos(m(a.vacio.desde), m(a.vacio.hasta))}
                            title={`${a.vacio.minutos} min en vacío`}
                            aria-hidden
                          />
                        )}
                        {editable ? (
                          <button
                            type="button"
                            className={cn(clase, 'cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none')}
                            style={pos(inicio, libera)}
                            title={`${etiqueta}. Clic para mover`}
                            aria-label={`Mover ${etiqueta}`}
                            onClick={() => alElegir(a)}
                          >
                            {a.servicio.folio}
                          </button>
                        ) : (
                          <span role="img" className={clase} style={pos(inicio, libera)} title={etiqueta} aria-label={etiqueta}>
                            {a.servicio.folio}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/** Leyenda de colores de la línea de tiempo. */
export function LeyendaLineaTiempo() {
  const elementos = [
    ['Privado', COLOR_MODALIDAD.PRIVADO],
    ['Compartido', COLOR_MODALIDAD.COMPARTIDO],
    ['Grupo', COLOR_MODALIDAD.GRUPO],
    ['Traslado en vacío', 'border border-dashed border-slate-400/70 bg-slate-300/40'],
    ['Fuera de jornada', 'bg-muted border'],
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {elementos.map(([texto, color]) => (
        <li key={texto} className="flex items-center gap-1.5">
          <span className={cn('size-3 rounded-sm', color)} aria-hidden />
          {texto}
        </li>
      ))}
    </ul>
  )
}

/** Rango visible en horas completas: de la primera cita o vacío al último fin. */
function rango(unidades: UnidadRol[], m: (iso: string) => number) {
  const minutos = unidades.flatMap((u) => [
    ...(u.cita ? [m(u.cita)] : []),
    ...(u.finJornada ? [m(u.finJornada)] : []),
    ...u.asignaciones.flatMap((a) => [m(a.inicioEfectivo), m(a.liberacion), ...(a.vacio ? [m(a.vacio.desde)] : [])]),
  ])
  if (minutos.length === 0) return { desde: 4 * 60, hasta: 22 * 60 }
  const desde = Math.floor(Math.min(...minutos) / 60) * 60
  const hasta = Math.max(Math.ceil(Math.max(...minutos) / 60) * 60, desde + 60)
  return { desde, hasta }
}
