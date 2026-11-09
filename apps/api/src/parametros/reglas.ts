/**
 * Reglas de validación de los parámetros de operación, según su clave.
 * Devuelve el mensaje de error, o null si el valor es válido.
 * - hora_cita.*: HH:mm de 24 horas (00:00 a 23:59).
 * - jornada_maxima_horas: horas con hasta 2 decimales (9.5 = nueve y media).
 * - anticipacion.* y motor.penalizacion_carga_min: minutos enteros.
 */
/** Claves que se capturan en minutos enteros de 0 a 120. */
const esMinutos = (clave: string) =>
  clave.startsWith('anticipacion.') || clave === 'motor.penalizacion_carga_min';

export function validarParametro(clave: string, valor: string): string | null {
  if (clave.startsWith('hora_cita.')) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor)
      ? null
      : 'debe tener el formato HH:mm (00:00 a 23:59)';
  }
  if (clave === 'jornada_maxima_horas') {
    const horas = Number(valor);
    return /^\d{1,2}(\.\d{1,2})?$/.test(valor) && horas >= 1 && horas <= 12
      ? null
      : 'debe ser un número de horas entre 1 y 12';
  }
  if (esMinutos(clave)) {
    return /^\d{1,3}$/.test(valor) && Number(valor) <= 120
      ? null
      : 'debe ser un número entero de minutos entre 0 y 120';
  }
  return 'no tiene una regla de validación definida';
}
