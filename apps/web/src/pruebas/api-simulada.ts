import { waitFor } from '@testing-library/react'
import { expect, vi } from 'vitest'

/** Petición que recibió la API simulada. */
export interface Peticion {
  metodo: string
  /** Ruta sin el prefijo /api, por ejemplo "/vehiculos". */
  ruta: string
  query: URLSearchParams
  cuerpo: unknown
}

type Respuesta = { status?: number; cuerpo: unknown }

/**
 * Reemplaza fetch por una API simulada: cada petición se guarda en
 * `peticiones` y se contesta con lo que devuelva `responder`.
 * (Se restaura sola después de cada prueba, ver configuracion.ts.)
 */
export function simularApi(responder: (peticion: Peticion) => Respuesta | Promise<Respuesta>) {
  const peticiones: Peticion[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
      const url = new URL(String(entrada))
      const peticion: Peticion = {
        metodo: opciones?.method ?? 'GET',
        ruta: url.pathname.replace(/^\/api/, ''),
        query: url.searchParams,
        cuerpo: opciones?.body ? JSON.parse(String(opciones.body)) : undefined,
      }
      peticiones.push(peticion)
      const { status = 200, cuerpo } = await responder(peticion)
      return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
    }),
  )
  return { peticiones }
}

/** Respuesta paginada como la de la API. */
export const pagina = <T>(datos: T[], total = datos.length) => ({ datos, total, pagina: 1, limite: 10 })

/** Espera (hasta 2 s) a que la API reciba una petición que cumpla la condición. */
export const esperarPeticion = (peticiones: Peticion[], condicion: (p: Peticion) => boolean) =>
  waitFor(() => expect(peticiones.some(condicion)).toBe(true), { timeout: 2000 })
