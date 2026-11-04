import { z } from 'zod'

/** Reglas de validación del formulario de inicio de sesión. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa tu correo')
    .email('Ingresa un correo válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
