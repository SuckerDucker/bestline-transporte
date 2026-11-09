import { describe, expect, it } from 'vitest'
import { errorDeCelda, type Matriz, revisarEdiciones } from './celdas'

const MATRIZ: Matriz = {
  zonas: [
    { id: 1, nombre: 'Aeropuerto CUN', esZonaTermino: true },
    { id: 7, nombre: 'Tulum', esZonaTermino: false },
  ],
  matriz: [
    [10, 100],
    [105, null],
  ],
  faltantes: [{ zonaOrigenId: 7, zonaDestinoId: 7 }],
  completa: false,
}

describe('errorDeCelda', () => {
  it('acepta minutos enteros de 1 a 300', () => {
    expect(errorDeCelda('1', null)).toBeNull()
    expect(errorDeCelda(' 300 ', 25)).toBeNull()
  })

  it.each([
    ['0', 'Debe estar entre 1 y 300 minutos'],
    ['301', 'Debe estar entre 1 y 300 minutos'],
    ['12.5', 'Usa minutos enteros'],
    ['abc', 'Usa minutos enteros'],
  ])('"%s" es inválido', (texto, mensaje) => {
    expect(errorDeCelda(texto, null)).toBe(mensaje)
  })

  it('no deja vaciar un tiempo que ya existe, pero una celda faltante puede quedar vacía', () => {
    expect(errorDeCelda('', 25)).toMatch(/No se puede dejar vacío/)
    expect(errorDeCelda('', null)).toBeNull()
  })
})

describe('revisarEdiciones', () => {
  it('devuelve solo las celdas que cambiaron, listas para PUT', () => {
    const { cambios, errores } = revisarEdiciones(MATRIZ, {
      '1-7': '95', // cambió
      '7-1': '105', // igual al guardado
      '7-7': '10', // faltaba
    })
    expect(errores).toEqual({})
    expect(cambios).toEqual([
      { zonaOrigenId: 1, zonaDestinoId: 7, minutos: 95 },
      { zonaOrigenId: 7, zonaDestinoId: 7, minutos: 10 },
    ])
  })

  it('separa las celdas con error por su clave', () => {
    const { cambios, errores } = revisarEdiciones(MATRIZ, { '1-1': '0', '1-7': '90' })
    expect(errores).toEqual({ '1-1': 'Debe estar entre 1 y 300 minutos' })
    expect(cambios).toHaveLength(1)
  })
})
