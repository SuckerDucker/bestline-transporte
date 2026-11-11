import { ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { horaCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { NOMBRE_MODALIDAD } from '../servicios/tipos'
import type { AsignacionRol, UnidadRol } from './api'
import { DatosUnidad } from './DatosUnidad'
import { COLOR_MODALIDAD } from './formato'

interface Props {
  unidades: UnidadRol[]
  editable: boolean
  alElegir: (asignacion: AsignacionRol) => void
}

/** El rol en celular (< md): una tarjeta por unidad con sus servicios en orden. */
export function ListaUnidades({ unidades, editable, alElegir }: Props) {
  return (
    <ul className="space-y-3" aria-label="Unidades del rol">
      {unidades.map((u) => (
        <li key={u.vehiculo.id} aria-label={u.vehiculo.numeroEconomico} className="rounded-xl border bg-card p-4 shadow-sm">
          <DatosUnidad unidad={u} />
          {u.asignaciones.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sin servicios asignados.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {u.asignaciones.map((a) => (
                <li key={a.id} className="space-y-1">
                  {a.vacio && (
                    <p className="pl-5 text-xs text-muted-foreground">↳ {a.vacio.minutos} min en vacío</p>
                  )}
                  <div className="flex items-start gap-2">
                    <span
                      className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', COLOR_MODALIDAD[a.servicio.modalidad])}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">
                        <span className="tabular-nums">{horaCancun(a.servicio.fechaHora)}</span> · {a.servicio.folio}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.servicio.zonaOrigen.nombre} → {a.servicio.zonaDestino.nombre} · {a.servicio.pasajeros} pax ·{' '}
                        {NOMBRE_MODALIDAD[a.servicio.modalidad] ?? a.servicio.modalidad}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Inicio {horaCancun(a.inicioEfectivo)} · libera {horaCancun(a.liberacion)}
                      </p>
                    </div>
                    {editable && (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Mover ${a.servicio.folio}`}
                        onClick={() => alElegir(a)}
                      >
                        <ArrowRightLeft />
                        Mover
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ul>
  )
}
