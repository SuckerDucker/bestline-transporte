/**
 * Utilidades de fecha en la zona horaria de operación (America/Cancun).
 * Quintana Roo no tiene horario de verano desde 2015: siempre es UTC-05:00.
 */
export const ZONA_HORARIA = 'America/Cancun';
const DESFASE_CANCUN = '-05:00';
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Fecha calendario (YYYY-MM-DD) de un instante, vista desde Cancún. */
export function fechaEnCancun(instante: Date): string {
  // El formato en-CA produce exactamente AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/** Inicio (incluido) y fin (excluido) de un día de Cancún, como instantes UTC. */
export function rangoDelDia(fecha: string): { inicio: Date; fin: Date } {
  const inicio = new Date(`${fecha}T00:00:00${DESFASE_CANCUN}`);
  return { inicio, fin: new Date(inicio.getTime() + UN_DIA_MS) };
}

/** Instante UTC de una fecha (AAAA-MM-DD) y hora (HH:mm) de Cancún. */
export function instanteCancun(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00${DESFASE_CANCUN}`);
}
