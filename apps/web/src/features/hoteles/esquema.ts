import { z } from 'zod'
import { latitud, longitud } from '../catalogos/coordenadas'

/** Validación del formulario de hotel (mismas reglas que la API). */
export const esquemaHotel = z.object({
  nombre: z.string().trim().min(1, 'Ingresa el nombre').max(150, 'Máximo 150 caracteres'),
  zonaId: z.number({ error: 'Elige la zona' }).int().positive('Elige la zona'),
  latitud,
  longitud,
})
export type ValoresHotel = z.infer<typeof esquemaHotel>
