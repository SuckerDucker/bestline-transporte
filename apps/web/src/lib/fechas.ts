// Fechas y horas en la zona horaria de operación (America/Cancun, UTC−5).

const ZONA = 'America/Cancun'
const HORA = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const DIA = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' })
const DIA_Y_HORA = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, dateStyle: 'medium', timeStyle: 'short' })

/** "06:15" */
export const horaCancun = (iso: string) => HORA.format(new Date(iso))
/** "5 nov 2026" */
export const diaCancun = (iso: string) => DIA.format(new Date(iso))
/** "5 nov 2026, 6:15 a.m." */
export const diaYHoraCancun = (iso: string) => DIA_Y_HORA.format(new Date(iso))

const DIA_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
/** Fecha de mañana en Cancún, AAAA-MM-DD (el rol se genera el día anterior). */
export const mananaCancun = (ahora = new Date()) => DIA_ISO.format(new Date(ahora.getTime() + 24 * 60 * 60 * 1000))
