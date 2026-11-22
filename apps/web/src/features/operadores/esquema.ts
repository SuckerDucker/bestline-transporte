import { z } from 'zod'

/** Valor del selector cuando el operador no tiene vehículo. */
export const SIN_VEHICULO = 'ninguno'
/** Valor del selector cuando el operador no tiene cuenta de usuario. */
export const SIN_USUARIO = 'ninguno'

/** Validación del formulario de operador (mismas reglas que la API). */
export const esquemaOperador = z.object({
  nombre: z.string().trim().min(1, 'Ingresa el nombre').max(150, 'Máximo 150 caracteres'),
  licencia: z.string().trim().min(1, 'Ingresa la licencia').max(30, 'Máximo 30 caracteres'),
  telefono: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Solo dígitos, espacios, +, - y paréntesis (7 a 20)'),
  disponible: z.boolean(),
  /** Id del vehículo como texto (lo usa el Select) o SIN_VEHICULO. */
  vehiculo: z.string(),
  /** Id de la cuenta con rol OPERADOR como texto o SIN_USUARIO. */
  usuario: z.string(),
  /** Vacía = sin hora de cita: el operador no participa en el rol. La API revisa que caiga en un bloque. */
  horaCita: z
    .string()
    .trim()
    .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, 'Usa el formato HH:mm de 24 horas o déjala vacía'),
})
export type ValoresOperador = z.infer<typeof esquemaOperador>

/** Valores del formulario → cuerpo de la API (vehiculoId, usuarioId y horaCita pueden ser null). */
export const aDatosOperador = ({ vehiculo, usuario, horaCita, ...resto }: ValoresOperador) => ({
  ...resto,
  vehiculoId: vehiculo === SIN_VEHICULO ? null : Number(vehiculo),
  usuarioId: usuario === SIN_USUARIO ? null : Number(usuario),
  horaCita: horaCita === '' ? null : horaCita,
})
