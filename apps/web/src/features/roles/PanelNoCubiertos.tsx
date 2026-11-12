import { CalendarCheck, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { horaCancun } from '@/lib/fechas'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { NOMBRE_MODALIDAD } from '../servicios/tipos'
import { MOTIVO, MOTIVOS, type NoCubierto } from './api'

interface Props {
  noCubiertos: NoCubierto[]
  editable: boolean
  alAsignar: (noCubierto: NoCubierto) => void
}

/** Servicios no cubiertos agrupados por motivo, con "Asignar a…" (CU-14 y CU-15). */
export function PanelNoCubiertos({ noCubiertos, editable, alAsignar }: Props) {
  if (noCubiertos.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground shadow-sm">
        <CalendarCheck className="size-4 text-emerald-600" />
        Todos los servicios del día quedaron asignados.
      </p>
    )
  }
  const grupos = MOTIVOS.map((motivo) => ({
    motivo,
    lista: noCubiertos.filter((n) => n.motivo === motivo),
  })).filter((g) => g.lista.length > 0)

  return (
    <div className="space-y-4">
      {grupos.map(({ motivo, lista }) => (
        <section
          key={motivo}
          aria-label={`No cubiertos por ${MOTIVO[motivo].etiqueta}`}
          className="rounded-xl border bg-card shadow-sm"
        >
          <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <EstadoBadge texto={MOTIVO[motivo].etiqueta} tono={MOTIVO[motivo].tono} />
            <span className="text-sm font-medium">{lista.length}</span>
            <span className="text-xs text-muted-foreground">{MOTIVO[motivo].explicacion}</span>
            {MOTIVO[motivo].nota && <span className="text-xs font-medium text-amber-800">{MOTIVO[motivo].nota}</span>}
          </header>
          <ul className="divide-y">
            {lista.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="w-12 font-semibold tabular-nums">{horaCancun(n.servicio.fechaHora)}</span>
                <span className="font-medium">{n.servicio.folio}</span>
                <span className="text-muted-foreground">
                  {n.servicio.zonaOrigen.nombre} → {n.servicio.zonaDestino.nombre}
                </span>
                <span className="text-muted-foreground">
                  {n.servicio.pasajeros} pax · {NOMBRE_MODALIDAD[n.servicio.modalidad] ?? n.servicio.modalidad}
                </span>
                {editable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    aria-label={`Asignar ${n.servicio.folio} a una unidad`}
                    onClick={() => alAsignar(n)}
                  >
                    <Plus />
                    Asignar a…
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
