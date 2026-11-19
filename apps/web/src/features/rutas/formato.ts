import type { Parada } from './api'

export const esEncierro = (p: Parada) => p.tipo === 'ENCIERRO_SALIDA' || p.tipo === 'ENCIERRO_REGRESO'

/**
 * Número que se ve en el mapa y en la lista: las paradas de servicio se
 * numeran 1, 2, 3… en orden; el encierro no lleva número (tiene su icono).
 */
export function numerarParadas(paradas: Parada[]): (Parada & { numero: number | null })[] {
  let n = 0
  return paradas.map((p) => ({ ...p, numero: esEncierro(p) ? null : ++n }))
}

export type ParadaNumerada = ReturnType<typeof numerarParadas>[number]

/** Paradas que caen en el mismo punto del mapa (un solo marcador). */
export interface GrupoParadas {
  clave: string
  latitud: number
  longitud: number
  paradas: ParadaNumerada[]
  encierro: boolean
  /** "2·3": números de las paradas del grupo. */
  etiqueta: string
}

type Punto = Pick<Parada, 'latitud' | 'longitud'>
const mismoPunto = (a: Punto, b: Punto) => a.latitud === b.latitud && a.longitud === b.longitud

/**
 * Junta las paradas que quedan en el mismo lugar del mapa (por ejemplo, dejar
 * pasajeros en CUN y recoger otros ahí mismo, o salir y regresar al encierro)
 * para que sus números no se encimen: un marcador con "2·3" y un popup con las
 * dos. "cerca" decide si una parada va con el primer punto de un grupo; el
 * mapa la mide en píxeles de pantalla.
 */
export function agruparParadas(
  paradas: ParadaNumerada[],
  cerca: (a: Punto, b: Punto) => boolean = mismoPunto,
): GrupoParadas[] {
  const grupos: GrupoParadas[] = []
  for (const p of paradas) {
    let grupo = grupos.find((g) => cerca(g, p))
    if (!grupo) {
      grupo = { clave: `${p.latitud},${p.longitud}`, latitud: p.latitud, longitud: p.longitud, paradas: [], encierro: false, etiqueta: '' }
      grupos.push(grupo)
    }
    grupo.paradas.push(p)
    grupo.encierro ||= esEncierro(p)
  }
  return grupos.map((g) => ({
    ...g,
    etiqueta: g.paradas
      .map((p) => p.numero)
      .filter((n) => n !== null)
      .join('·'),
  }))
}

/** 135 → "2 h 15 min"; null → "—" (trazado aproximado). */
export function formatoDuracion(minutos: number | null): string {
  if (minutos === null) return '—'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

export const formatoDistancia = (km: number) =>
  `${km.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`

/** Qué pasa en la parada, para la lista y el popup. */
export const DESCRIPCION_PARADA: Record<Parada['tipo'], string> = {
  ENCIERRO_SALIDA: 'Sale del encierro',
  ORIGEN: 'Recoge',
  DESTINO: 'Deja',
  ENCIERRO_REGRESO: 'Regresa al encierro',
}

/** Colores de la ruta principal y de la que se compara. */
export const COLOR_RUTA = { principal: '#0369a1', comparada: '#c2410c' } as const
