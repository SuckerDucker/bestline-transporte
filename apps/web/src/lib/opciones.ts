/** Opción de una lista desplegable. */
export interface Opcion {
  valor: string
  etiqueta: string
}

/**
 * Valor de los filtros para "sin filtro". Radix Select no admite opciones con
 * valor vacío, por eso se usa esta palabra y no se envía a la API.
 */
export const TODOS = 'todos'
