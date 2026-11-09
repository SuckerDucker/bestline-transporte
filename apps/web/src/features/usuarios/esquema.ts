import { z } from 'zod'
import { ROLES } from '@/auth/tipos'

// Mismas reglas que la API (apps/api/src/usuarios/dto/usuario.dto.ts).
const nombre = z.string().trim().min(1, 'Ingresa el nombre').max(100, 'Máximo 100 caracteres')
const rol = z.enum(ROLES, { error: 'Elige el rol' })
const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede tener más de 72 caracteres')

/** La confirmación debe coincidir con la contraseña. */
const conConfirmacion = <T extends { password: string; confirmacion: string }>(valores: T) =>
  valores.password === valores.confirmacion

export const esquemaAltaUsuario = z
  .object({
    nombre,
    email: z.string().trim().toLowerCase().min(1, 'Ingresa el correo').email('Ingresa un correo válido').max(150),
    rol,
    password,
    confirmacion: z.string(),
  })
  .refine(conConfirmacion, { message: 'Las contraseñas no coinciden', path: ['confirmacion'] })
export type ValoresAltaUsuario = z.infer<typeof esquemaAltaUsuario>

export const esquemaEdicionUsuario = z.object({ nombre, rol })
export type ValoresEdicionUsuario = z.infer<typeof esquemaEdicionUsuario>

export const esquemaPassword = z
  .object({ password, confirmacion: z.string() })
  .refine(conConfirmacion, { message: 'Las contraseñas no coinciden', path: ['confirmacion'] })
export type ValoresPassword = z.infer<typeof esquemaPassword>
