import { horaCancun } from '@/lib/fechas'
import type { AsignacionRol } from './api'

/** Color de la barra de un servicio según su modalidad (define la anticipación). */
export const COLOR_MODALIDAD: Record<string, string> = {
  PRIVADO: 'bg-sky-600 hover:bg-sky-700',
  COMPARTIDO: 'bg-violet-600 hover:bg-violet-700',
  GRUPO: 'bg-amber-500 hover:bg-amber-600',
}

/** "S-12 · 05:00 · Aeropuerto CUN → Zona Hotelera · 4 pax" */
export const describirServicio = (a: Pick<AsignacionRol, 'servicio'>) =>
  `${a.servicio.folio} · ${horaCancun(a.servicio.fechaHora)} · ${a.servicio.zonaOrigen.nombre} → ${a.servicio.zonaDestino.nombre} · ${a.servicio.pasajeros} pax`
