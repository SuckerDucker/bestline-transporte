import { z } from 'zod'
import { CAPACIDAD_MAXIMA, ESTADOS_VEHICULO, TIPOS_VEHICULO } from '../catalogos/tipos'

/** Validación del formulario de vehículo (mismas reglas que la API). */
export const esquemaVehiculo = z
  .object({
    numeroEconomico: z
      .string()
      .trim()
      .min(1, 'Ingresa el número económico')
      .max(20, 'Máximo 20 caracteres'),
    tipo: z.enum(TIPOS_VEHICULO, { error: 'Elige un tipo de vehículo' }),
    capacidad: z
      .number({ error: 'Ingresa la capacidad' })
      .int('La capacidad debe ser un número entero')
      .positive('La capacidad debe ser mayor que 0'),
    encierroBase: z
      .string()
      .trim()
      .min(1, 'Elige el encierro base')
      .max(100, 'Máximo 100 caracteres'),
    estado: z.enum(ESTADOS_VEHICULO),
  })
  // Regla de capacidad por tipo: Van/Urvan 14, Sprinter 20, Autobús 45.
  .superRefine((valores, ctx) => {
    const maxima = CAPACIDAD_MAXIMA[valores.tipo]
    if (valores.capacidad > maxima) {
      ctx.addIssue({
        code: 'custom',
        path: ['capacidad'],
        message: `Un vehículo ${valores.tipo} admite máximo ${maxima} pasajeros`,
      })
    }
  })

export type ValoresVehiculo = z.infer<typeof esquemaVehiculo>
