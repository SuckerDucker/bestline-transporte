import { describe, expect, it } from 'vitest'
import type { Parada } from './api'
import { agruparParadas, formatoDistancia, formatoDuracion, numerarParadas } from './formato'

const parada = (orden: number, tipo: Parada['tipo'], latitud: number, longitud: number): Parada => ({
  orden,
  tipo,
  nombre: `P${orden}`,
  zona: 'Z',
  latitud,
  longitud,
  llegada: null,
  salida: null,
})
// Encierro en Centro, hotel a ~450 m, CUN dos veces y regreso al encierro.
const PARADAS = [
  parada(1, 'ENCIERRO_SALIDA', 21.1619, -86.8515),
  parada(2, 'ORIGEN', 21.1605, -86.8475),
  parada(3, 'DESTINO', 21.0365, -86.8771),
  parada(4, 'ORIGEN', 21.0365, -86.8771),
  parada(5, 'DESTINO', 21.1335, -86.7465),
  parada(6, 'ENCIERRO_REGRESO', 21.1619, -86.8515),
]

describe('formato de la ruta', () => {
  it('numera solo las paradas de servicio; el encierro no lleva número', () => {
    expect(numerarParadas(PARADAS).map((p) => p.numero)).toEqual([null, 1, 2, 3, 4, null])
  })

  it('junta en un marcador las paradas con las mismas coordenadas', () => {
    const grupos = agruparParadas(numerarParadas(PARADAS))
    expect(grupos.map((g) => [g.etiqueta, g.encierro, g.paradas.length])).toEqual([
      ['', true, 2], // salida y regreso al encierro
      ['1', false, 1],
      ['2·3', false, 2], // deja y recoge en CUN
      ['4', false, 1],
    ])
  })

  it('con un criterio de cercanía junta también las paradas que se encimarían', () => {
    // Menos de 0.01° (≈ 1 km): el hotel se junta con el encierro.
    type Punto = { latitud: number; longitud: number }
    const cerca = (a: Punto, b: Punto) =>
      Math.hypot(a.latitud - b.latitud, a.longitud - b.longitud) < 0.01
    const grupos = agruparParadas(numerarParadas(PARADAS), cerca)
    expect(grupos[0]).toMatchObject({ etiqueta: '1', encierro: true, latitud: 21.1619 })
    expect(grupos[0].paradas.map((p) => p.orden)).toEqual([1, 2, 6])
    expect(grupos).toHaveLength(3)
  })

  it('formatea duración y distancia', () => {
    expect(formatoDuracion(134)).toBe('2 h 14 min')
    expect(formatoDuracion(45)).toBe('45 min')
    expect(formatoDuracion(null)).toBe('—')
    expect(formatoDistancia(52.48)).toBe('52.5 km')
  })
})
