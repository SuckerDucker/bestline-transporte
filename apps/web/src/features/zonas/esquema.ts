import { z } from 'zod'
import { latitud, longitud } from '../catalogos/coordenadas'

/** Validación del formulario de zona (mismas reglas que la API). */
export const esquemaZona = z.object({
  nombre: z.string().trim().min(1, 'Ingresa el nombre').max(100, 'Máximo 100 caracteres'),
  latitud,
  longitud,
  esZonaTermino: z.boolean(),
})
export type ValoresZona = z.infer<typeof esquemaZona>
