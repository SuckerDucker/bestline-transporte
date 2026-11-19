import type { FilaMonitoreo } from './api'

/** Valores de los filtros que no son un estado ni una unidad. */
export const TODOS = 'todos'
export const RETRASADOS = 'retrasados'

/** Filtro por estado o por retrasados y por unidad. */
export function filtrar(servicios: FilaMonitoreo[], estado: string, unidad: string) {
  return servicios.filter(
    (f) =>
      (estado === TODOS || (estado === RETRASADOS ? f.retrasado : f.servicio.estado === estado)) &&
      (unidad === TODOS || String(f.vehiculo.id) === unidad),
  )
}
