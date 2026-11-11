import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { horaCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import type { Servicio } from '../servicios/tipos'
import { MOTIVO_REVISION, type OpcionUnidad, useAsignarNoCubierto, useMoverServicio, useOpciones } from './api'

/** Servicio a mover (asignacionId) o no cubierto a asignar (asignacionId = null). */
export interface Objetivo {
  servicio: Servicio
  asignacionId: number | null
}

interface Props {
  fecha: string
  objetivo: Objetivo | null
  alCerrar: () => void
}

/**
 * Selector de unidad: pide a la API qué unidades aceptarían el servicio (la
 * API revalida con las funciones del motor) y solo deja elegir las válidas;
 * las demás aparecen deshabilitadas con su motivo y el detalle.
 */
export function SelectorUnidad({ fecha, objetivo, alCerrar }: Props) {
  const opciones = useOpciones(fecha, objetivo?.servicio.id ?? null)
  const mover = useMoverServicio(fecha)
  const asignar = useAsignarNoCubierto(fecha)
  const procesando = mover.isPending || asignar.isPending
  const esMover = objetivo?.asignacionId != null

  const elegir = (opcion: OpcionUnidad) => {
    if (!objetivo) return
    const folio = objetivo.servicio.folio
    const alTerminar = {
      onSuccess: () => {
        toast.success(esMover ? `${folio} movido a ${opcion.numeroEconomico}` : `${folio} asignado a ${opcion.numeroEconomico}`)
        alCerrar()
      },
      // Otro coordinador pudo cambiar el rol: la lista se vuelve a pedir.
      onError: (error: Error) =>
        toast.error(esMover ? 'No se movió el servicio' : 'No se asignó el servicio', { description: error.message }),
    }
    if (objetivo.asignacionId != null) {
      mover.mutate({ asignacionId: objetivo.asignacionId, vehiculoId: opcion.vehiculoId }, alTerminar)
    } else {
      asignar.mutate({ servicioId: objetivo.servicio.id, vehiculoId: opcion.vehiculoId }, alTerminar)
    }
  }

  return (
    <Dialog
      open={objetivo !== null}
      onOpenChange={(abierto) => {
        if (!abierto && !procesando) alCerrar()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{esMover ? 'Mover a…' : 'Asignar a…'}</DialogTitle>
          {objetivo && (
            <DialogDescription>
              {objetivo.servicio.folio} · {horaCancun(objetivo.servicio.fechaHora)} · {objetivo.servicio.zonaOrigen.nombre} →{' '}
              {objetivo.servicio.zonaDestino.nombre} · {objetivo.servicio.pasajeros} pax
            </DialogDescription>
          )}
        </DialogHeader>

        {opciones.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : opciones.error ? (
          <p className="text-sm text-destructive">{opciones.error.message}</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto" aria-label="Unidades">
            {(opciones.data ?? []).map((o) => (
              <li key={o.vehiculoId}>
                <button
                  type="button"
                  disabled={!o.valido || procesando}
                  onClick={() => elegir(o)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    o.valido
                      ? 'hover:border-primary hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
                      : 'cursor-not-allowed bg-muted/40 opacity-80',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.numeroEconomico}</span>
                      <span className="text-xs text-muted-foreground">{o.capacidad} pax</span>
                      {o.actual && <span className="text-xs text-muted-foreground">(actual)</span>}
                      {o.motivo && <EstadoBadge texto={MOTIVO_REVISION[o.motivo].etiqueta} tono={MOTIVO_REVISION[o.motivo].tono} />}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {o.valido ? `Quedaría como el servicio ${o.posicion} de la unidad` : o.detalle}
                    </span>
                  </span>
                  {o.valido &&
                    (procesando ? (
                      <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Check className="mt-1 size-4 text-primary" />
                    ))}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
