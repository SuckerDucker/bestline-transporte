import { horaCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { UnidadRol } from './api'

/** Número económico, tipo, capacidad, operador y jornada (cita → fin). */
export function DatosUnidad({ unidad, className }: { unidad: UnidadRol; className?: string }) {
  const { vehiculo, operador, cita, finJornada } = unidad
  return (
    <div className={cn('min-w-0', className)}>
      <p className="flex items-center gap-2 font-semibold">
        {vehiculo.numeroEconomico}
        <span className="text-xs font-normal text-muted-foreground">
          {vehiculo.tipo} · {vehiculo.capacidad} pax
        </span>
      </p>
      <p className="truncate text-xs text-muted-foreground">{operador?.nombre ?? 'Sin operador'}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {cita && finJornada ? `${horaCancun(cita)} – ${horaCancun(finJornada)}` : 'Sin hora de cita'}
        {!unidad.disponible && <span className="ml-1 font-medium text-amber-800">· No disponible</span>}
      </p>
    </div>
  )
}
