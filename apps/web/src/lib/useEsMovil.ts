import { useSyncExternalStore } from 'react'

// Mismo corte que el breakpoint md de Tailwind (768 px).
const CONSULTA = '(max-width: 767px)'

const medios = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(CONSULTA) : null)

function suscribir(avisar: () => void) {
  const medio = medios()
  medio?.addEventListener('change', avisar)
  return () => medio?.removeEventListener('change', avisar)
}

/**
 * ¿La pantalla es de celular (< md)? Se actualiza al girar o cambiar el
 * tamaño de la ventana. Sin matchMedia (pruebas con jsdom) es escritorio.
 */
export function useEsMovil(): boolean {
  return useSyncExternalStore(suscribir, () => medios()?.matches ?? false)
}
