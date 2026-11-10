/** Claves que se capturan en minutos enteros de 0 a 120. */
const esMinutos = (clave: string) =>
  clave.startsWith('anticipacion.') || clave === 'motor.penalizacion_carga_min';

const HORA = '([01]\\d|2[0-3]):[0-5]\\d';
const BLOQUE = new RegExp(`^(${HORA})-(${HORA})$`);

/**
 * Bloque de horas de cita "HH:mm-HH:mm" (por ejemplo "04:00-05:00"), o null si
 * el formato no es válido o la hora de inicio no es anterior a la de fin.
 */
export function leerBloque(
  valor: string,
): { inicio: string; fin: string } | null {
  const partes = BLOQUE.exec(valor);
  if (!partes) return null;
  const [inicio, fin] = [partes[1], partes[3]];
  // En HH:mm el orden del texto es el orden de las horas.
  return inicio < fin ? { inicio, fin } : null;
}

/**
 * Reglas de validación de los parámetros de operación, según su clave.
 * Devuelve el mensaje de error, o null si el valor es válido.
 * - hora_cita.bloque_*: HH:mm-HH:mm, con el inicio antes que el fin.
 * - jornada_maxima_horas: horas con hasta 2 decimales (9.5 = nueve y media).
 * - anticipacion.* y motor.penalizacion_carga_min: minutos enteros.
 */
export function validarParametro(clave: string, valor: string): string | null {
  if (clave.startsWith('hora_cita.')) {
    return leerBloque(valor)
      ? null
      : 'debe tener el formato HH:mm-HH:mm con el inicio antes que el fin';
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
