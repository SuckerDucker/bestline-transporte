// Conversión entre las fechas de la base (UTC) y los minutos que usa el motor
// (contados desde las 00:00 de Cancún del día del rol).

const MINUTO = 60_000;

/** "04:30" → 270 */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Minutos desde el inicio del día (en Cancún) de un instante. */
export const aMinutos = (inicioDia: Date, instante: Date) =>
  Math.round((instante.getTime() - inicioDia.getTime()) / MINUTO);

/** Instante de un número de minutos desde el inicio del día. */
export const aInstante = (inicioDia: Date, minutos: number) =>
  new Date(inicioDia.getTime() + minutos * MINUTO);

/** Fecha del rol para la columna rol_diario.fecha (tipo DATE). */
export const fechaDelRol = (fecha: string) =>
  new Date(`${fecha}T00:00:00.000Z`);
