import { z } from 'zod'

/** Validación del formulario de operador (mismas reglas que la API). */
export const esquemaOperador = z.object({
  nombre: z.string().trim().min(1, 'Ingresa el nombre').max(150, 'Máximo 150 caracteres'),
  licencia: z.string().trim().min(1, 'Ingresa la licencia').max(30, 'Máximo 30 caracteres'),
  telefono: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Solo dígitos, espacios, +, - y paréntesis (7 a 20)'),
  disponible: z.boolean(),
})
export type ValoresOperador = z.infer<typeof esquemaOperador>
