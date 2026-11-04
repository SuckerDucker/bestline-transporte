import { z } from 'zod'

/** Latitud y longitud con las mismas reglas que la API (máximo 6 decimales). */
// Se multiplica por 10^6: si el resultado es (casi) entero, tiene máximo 6 decimales.
const conSeisDecimales = (n: number) => Math.abs(n * 1e6 - Math.round(n * 1e6)) < 1e-6

export const latitud = z
  .number({ error: 'Ingresa la latitud' })
  .min(-90, 'La latitud debe estar entre -90 y 90')
  .max(90, 'La latitud debe estar entre -90 y 90')
  .refine(conSeisDecimales, 'Máximo 6 decimales')

export const longitud = z
  .number({ error: 'Ingresa la longitud' })
  .min(-180, 'La longitud debe estar entre -180 y 180')
  .max(180, 'La longitud debe estar entre -180 y 180')
  .refine(conSeisDecimales, 'Máximo 6 decimales')

/** Formato corto de una coordenada para la tabla. */
export const formatoCoordenada = (n: number) => n.toFixed(4)
