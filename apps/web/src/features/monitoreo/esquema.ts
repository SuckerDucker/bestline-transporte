import { z } from 'zod'
import { TIPOS_INCIDENCIA } from './api'

/** Mismas reglas que IncidenciaDto de la API. */
export const esquemaIncidencia = z.object({
  tipo: z.enum(TIPOS_INCIDENCIA, { message: 'Elige el tipo de incidencia' }),
  descripcion: z.string().trim().min(1, 'Describe lo que pasó').max(500, 'Máximo 500 caracteres'),
})
export type ValoresIncidencia = z.infer<typeof esquemaIncidencia>
