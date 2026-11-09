import { z } from 'zod'

/** Parámetro de operación como lo devuelve la API. */
export interface Parametro {
  id: number
  clave: string
  valor: string
  descripcion: string
}

// Mismas reglas que la API (apps/api/src/parametros/reglas.ts).
const hora = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:mm de 24 horas (00:00 a 23:59)')
const horasJornada = z
  .string()
  .trim()
  .regex(/^\d{1,2}(\.\d{1,2})?$/, 'Ingresa un número de horas (por ejemplo 9.5)')
  .refine((v) => Number(v) >= 1 && Number(v) <= 12, 'Debe estar entre 1 y 12 horas')
const minutos = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/, 'Ingresa minutos enteros')
  .refine((v) => Number(v) <= 120, 'Debe estar entre 0 y 120 minutos')

/**
 * Los nombres de los campos son las claves de la API: React Hook Form lee
 * "hora_cita.turno_1" como el campo turno_1 dentro de hora_cita.
 */
export const esquemaParametros = z.object({
  hora_cita: z.object({ turno_1: hora, turno_2: hora }),
  jornada_maxima_horas: horasJornada,
  anticipacion: z.object({ PRIVADO: minutos, COMPARTIDO: minutos, GRUPO: minutos }),
  motor: z.object({ penalizacion_carga_min: minutos }),
})
export type ValoresParametros = z.infer<typeof esquemaParametros>

/** Claves que muestra el formulario, en orden. */
export const CLAVES = [
  'hora_cita.turno_1',
  'hora_cita.turno_2',
  'jornada_maxima_horas',
  'anticipacion.PRIVADO',
  'anticipacion.COMPARTIDO',
  'anticipacion.GRUPO',
  'motor.penalizacion_carga_min',
] as const
export type ClaveParametro = (typeof CLAVES)[number]

/** Lista de la API → valores del formulario. */
export function aValores(parametros: Parametro[]): ValoresParametros {
  const valor = (clave: ClaveParametro) => parametros.find((p) => p.clave === clave)?.valor ?? ''
  return {
    hora_cita: { turno_1: valor('hora_cita.turno_1'), turno_2: valor('hora_cita.turno_2') },
    jornada_maxima_horas: valor('jornada_maxima_horas'),
    anticipacion: {
      PRIVADO: valor('anticipacion.PRIVADO'),
      COMPARTIDO: valor('anticipacion.COMPARTIDO'),
      GRUPO: valor('anticipacion.GRUPO'),
    },
    motor: { penalizacion_carga_min: valor('motor.penalizacion_carga_min') },
  }
}

/** Valores del formulario → cuerpo de PUT /parametros (solo las claves que existen en la base). */
export function aLista(valores: ValoresParametros, existentes: Parametro[]): { clave: string; valor: string }[] {
  const plano: Record<ClaveParametro, string> = {
    'hora_cita.turno_1': valores.hora_cita.turno_1,
    'hora_cita.turno_2': valores.hora_cita.turno_2,
    jornada_maxima_horas: valores.jornada_maxima_horas,
    'anticipacion.PRIVADO': valores.anticipacion.PRIVADO,
    'anticipacion.COMPARTIDO': valores.anticipacion.COMPARTIDO,
    'anticipacion.GRUPO': valores.anticipacion.GRUPO,
    'motor.penalizacion_carga_min': valores.motor.penalizacion_carga_min,
  }
  return CLAVES.filter((clave) => existentes.some((p) => p.clave === clave)).map((clave) => ({
    clave,
    valor: plano[clave],
  }))
}
