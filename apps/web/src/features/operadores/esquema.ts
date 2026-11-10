import { z } from 'zod'

/** Valor del selector cuando el operador no tiene vehículo. */
export const SIN_VEHICULO = 'ninguno'

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
  /** Vacía = sin hora de cita: el operador no participa en el rol. La API revisa que caiga en un bloque. */
  horaCita: z
    .string()
    .trim()
    .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, 'Usa el formato HH:mm de 24 horas o déjala vacía'),
})
export type ValoresOperador = z.infer<typeof esquemaOperador>

/** Valores del formulario → cuerpo de la API (vehiculoId y horaCita pueden ser null). */
export const aDatosOperador = ({ vehiculo, horaCita, ...resto }: ValoresOperador) => ({
  ...resto,
  vehiculoId: vehiculo === SIN_VEHICULO ? null : Number(vehiculo),
  horaCita: horaCita === '' ? null : horaCita,
})
