import type { Tono } from '../catalogos/EstadoBadge'
import type { EstadoFila } from './api'

/** Etiqueta y color de cada estado de fila de la vista previa. */
export const ESTADO_FILA: Record<EstadoFila, { etiqueta: string; plural: string; tono: Tono }> = {
  VALIDA: { etiqueta: 'Válida', plural: 'Válidas', tono: 'exito' },
  ADVERTENCIA: { etiqueta: 'Advertencia', plural: 'Advertencias', tono: 'aviso' },
  DUPLICADA: { etiqueta: 'Duplicada', plural: 'Duplicadas', tono: 'info' },
  ERROR: { etiqueta: 'Error', plural: 'Errores', tono: 'error' },
}
