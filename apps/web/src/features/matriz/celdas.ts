// Lógica de la matriz de tiempos sin React (se puede probar por separado).

export interface ZonaMatriz {
  id: number
  nombre: string
  esZonaTermino: boolean
}

export interface Matriz {
  zonas: ZonaMatriz[]
  /** matriz[i][j] = minutos de zonas[i] a zonas[j], o null si falta. */
  matriz: (number | null)[][]
  faltantes: { zonaOrigenId: number; zonaDestinoId: number }[]
  completa: boolean
}

export interface CeldaGuardar {
  zonaOrigenId: number
  zonaDestinoId: number
  minutos: number
}

/** Igual que la API (apps/api/src/tiempos-traslado/tiempos-traslado.service.ts). */
export const MINUTOS_MINIMOS = 1
export const MINUTOS_MAXIMOS = 300

export const claveCelda = (origenId: number, destinoId: number) => `${origenId}-${destinoId}`

/** Error de una celda editada, o null si es válida. */
export function errorDeCelda(texto: string, original: number | null): string | null {
  const valor = texto.trim()
  if (valor === '') return original === null ? null : 'No se puede dejar vacío un tiempo que ya existe'
  if (!/^\d+$/.test(valor)) return 'Usa minutos enteros'
  const minutos = Number(valor)
  if (minutos < MINUTOS_MINIMOS || minutos > MINUTOS_MAXIMOS) {
    return `Debe estar entre ${MINUTOS_MINIMOS} y ${MINUTOS_MAXIMOS} minutos`
  }
  return null
}

/**
 * Celdas que cambiaron respecto a la matriz guardada y sus errores.
 * Una celda vacía que ya estaba vacía no cuenta como cambio.
 */
export function revisarEdiciones(matriz: Matriz, ediciones: Record<string, string>) {
  const cambios: CeldaGuardar[] = []
  const errores: Record<string, string> = {}
  matriz.zonas.forEach((origen, i) =>
    matriz.zonas.forEach((destino, j) => {
      const clave = claveCelda(origen.id, destino.id)
      const texto = ediciones[clave]
      const original = matriz.matriz[i][j]
      if (texto === undefined || texto.trim() === String(original ?? '')) return
      const error = errorDeCelda(texto, original)
      if (error) errores[clave] = error
      else cambios.push({ zonaOrigenId: origen.id, zonaDestinoId: destino.id, minutos: Number(texto) })
    }),
  )
  return { cambios, errores }
}
