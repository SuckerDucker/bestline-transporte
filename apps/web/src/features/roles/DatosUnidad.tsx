import { Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { horaCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { UnidadRol } from './api'

interface Props {
  unidad: UnidadRol
  className?: string
  /** Con la fecha del rol se muestra el enlace "Ver ruta" (si la unidad tiene servicios). */
  fecha?: string
}

/** Número económico, tipo, capacidad, operador y jornada (cita → fin). */
export function DatosUnidad({ unidad, className, fecha }: Props) {
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
      <p className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
        <span>
          {cita && finJornada ? `${horaCancun(cita)} – ${horaCancun(finJornada)}` : 'Sin hora de cita'}
          {!unidad.disponible && <span className="ml-1 font-medium text-amber-800">· No disponible</span>}
        </span>
        {fecha && unidad.asignaciones.length > 0 && (
          // Rutas sugeridas de esta unidad.
          <Link
            to={`/rutas/${fecha}?unidad=${vehiculo.id}`}
            className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-sky-700 hover:underline"
            aria-label={`Ver ruta de ${vehiculo.numeroEconomico}`}
          >
            <Route className="size-3.5" />
            Ver ruta
          </Link>
        )}
      </p>
    </div>
  )
}
