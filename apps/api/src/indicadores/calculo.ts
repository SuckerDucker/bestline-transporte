// Cálculo de los indicadores de un día y de un rango de días (Fase 14).
// Son funciones puras: el servicio lee la base y les pasa los datos ya
// preparados, así se prueban con datos conocidos.

export const MOTIVOS = [
  'CAPACIDAD',
  'EMPALME',
  'JORNADA',
  'ZONA_TERMINO',
  'SIN_UNIDAD',
] as const;
export type Motivo = (typeof MOTIVOS)[number];

export const TIPOS_INCIDENCIA = [
  'RETRASO',
  'FALLA_MECANICA',
  'PASAJERO_NO_SE_PRESENTO',
  'CAMBIO_DE_HORA',
  'OTRO',
] as const;

const MINUTO = 60_000;
const redondear = (n: number, decimales = 1) =>
  Math.round(n * 10 ** decimales) / 10 ** decimales;

/** Asignación del rol con lo que hace falta para ocupación y jornada. */
export interface AsignacionDia {
  vehiculoId: number;
  numeroEconomico: string;
  capacidad: number;
  pasajeros: number;
  /** Hora de cita del operador ese día (null si no tiene). */
  cita: Date | null;
  liberacion: Date;
  destinoId: number;
  /** Zona del encierro de la unidad (null si no se encontró). */
  encierroId: number | null;
}

export interface DatosDia {
  fecha: string;
  rol: { estado: 'PROPUESTO' | 'AUTORIZADO' } | null;
  /** Estado de cada servicio del día (todos, también los que no están en el rol). */
  estados: string[];
  asignaciones: AsignacionDia[];
  noCubiertos: Motivo[];
  /** Tipo de cada incidencia de los servicios del día. */
  incidencias: string[];
  /** Violaciones del verificador; null si el rol no está AUTORIZADO. */
  empalmes: number | null;
  zonasTermino: ReadonlySet<number>;
  tiempo: (origenId: number, destinoId: number) => number | undefined;
}

/** Cuenta cuántas veces aparece cada clave (las de la lista, en 0 si no aparece). */
function contar<T extends string>(claves: readonly T[], valores: string[]) {
  const cuenta = Object.fromEntries(claves.map((c) => [c, 0])) as Record<
    T,
    number
  >;
  for (const v of valores) if (v in cuenta) cuenta[v as T] += 1;
  return cuenta;
}

/** Porcentaje de servicios del rol que quedaron asignados (null sin rol). */
export function cobertura(asignados: number, noCubiertos: number) {
  const total = asignados + noCubiertos;
  return total === 0 ? null : redondear((asignados / total) * 100);
}

/** Promedio de pasajeros / capacidad de cada servicio asignado (0 a 1). */
export function ocupacionPromedio(
  a: Pick<AsignacionDia, 'pasajeros' | 'capacidad'>[],
) {
  if (a.length === 0) return null;
  const suma = a.reduce((s, x) => s + x.pasajeros / x.capacidad, 0);
  return redondear(suma / a.length, 3);
}

/**
 * Horas de jornada de una unidad: desde la cita del operador hasta que queda
 * libre. Si su último servicio no termina en zona de término, se suma el
 * regreso en vacío a su encierro (la misma regla del motor).
 */
export function horasJornada(
  servicios: AsignacionDia[],
  zonasTermino: ReadonlySet<number>,
  tiempo: DatosDia['tiempo'],
): number | null {
  const ultimo = servicios.reduce<AsignacionDia | undefined>(
    (u, s) => (!u || s.liberacion > u.liberacion ? s : u),
    undefined,
  );
  if (!ultimo?.cita) return null;
  const regreso =
    zonasTermino.has(ultimo.destinoId) || ultimo.encierroId === null
      ? 0
      : (tiempo(ultimo.destinoId, ultimo.encierroId) ?? 0);
  const fin = ultimo.liberacion.getTime() + regreso * MINUTO;
  return redondear((fin - ultimo.cita.getTime()) / (60 * MINUTO), 2);
}

/** Ocupación y horas de jornada de cada unidad con servicios. */
function porUnidad(d: DatosDia) {
  const grupos = new Map<number, AsignacionDia[]>();
  for (const a of d.asignaciones) {
    grupos.set(a.vehiculoId, [...(grupos.get(a.vehiculoId) ?? []), a]);
  }
  return [...grupos.values()]
    .map((servicios) => ({
      vehiculoId: servicios[0].vehiculoId,
      numeroEconomico: servicios[0].numeroEconomico,
      capacidad: servicios[0].capacidad,
      servicios: servicios.length,
      pasajeros: servicios.reduce((s, x) => s + x.pasajeros, 0),
      ocupacion: ocupacionPromedio(servicios),
      horasJornada: horasJornada(servicios, d.zonasTermino, d.tiempo),
    }))
    .sort((a, b) =>
      a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', {
        numeric: true,
      }),
    );
}

/** Indicadores de un día. */
export function indicadoresDelDia(d: DatosDia) {
  const asignados = d.asignaciones.length;
  const estados = contar(
    ['COMPLETADO', 'CANCELADO', 'NO_SHOW'] as const,
    d.estados,
  );
  return {
    fecha: d.fecha,
    estadoRol: d.rol?.estado ?? null,
    servicios: d.estados.length,
    asignados,
    noCubiertos: d.noCubiertos.length,
    noCubiertosPorMotivo: contar(MOTIVOS, d.noCubiertos),
    cobertura: d.rol ? cobertura(asignados, d.noCubiertos.length) : null,
    empalmes: d.empalmes,
    completados: estados.COMPLETADO,
    cancelados: estados.CANCELADO,
    noShow: estados.NO_SHOW,
    incidencias: d.incidencias.length,
    incidenciasPorTipo: contar(TIPOS_INCIDENCIA, d.incidencias),
    ocupacion: ocupacionPromedio(d.asignaciones),
    unidades: porUnidad(d),
  };
}
export type IndicadoresDia = ReturnType<typeof indicadoresDelDia>;

const sumar = <K extends string>(
  dias: Record<K, number>[],
  claves: readonly K[],
) =>
  Object.fromEntries(
    claves.map((c) => [c, dias.reduce((s, d) => s + d[c], 0)]),
  ) as Record<K, number>;

/**
 * Totales del rango. La cobertura y la ocupación se calculan con todos los
 * servicios del rango (no es el promedio de los porcentajes de cada día).
 * Por unidad: ocupación ponderada por servicios y horas de jornada promedio.
 */
export function resumenDelRango(dias: IndicadoresDia[]) {
  const conRol = dias.filter((d) => d.estadoRol !== null);
  const asignados = conRol.reduce((s, d) => s + d.asignados, 0);
  const noCubiertos = conRol.reduce((s, d) => s + d.noCubiertos, 0);
  const autorizados = dias.filter((d) => d.empalmes !== null);
  const unidades = new Map<
    number,
    {
      numeroEconomico: string;
      servicios: number;
      ocupacion: number;
      horas: number[];
    }
  >();
  for (const u of dias.flatMap((d) => d.unidades)) {
    const acumulado = unidades.get(u.vehiculoId) ?? {
      numeroEconomico: u.numeroEconomico,
      servicios: 0,
      ocupacion: 0,
      horas: [],
    };
    acumulado.servicios += u.servicios;
    acumulado.ocupacion += (u.ocupacion ?? 0) * u.servicios;
    if (u.horasJornada !== null) acumulado.horas.push(u.horasJornada);
    unidades.set(u.vehiculoId, acumulado);
  }
  const totalOcupacion = [...unidades.values()].reduce(
    (s, u) => s + u.ocupacion,
    0,
  );
  return {
    dias: dias.length,
    diasConRol: conRol.length,
    servicios: dias.reduce((s, d) => s + d.servicios, 0),
    asignados,
    noCubiertos,
    noCubiertosPorMotivo: sumar(
      dias.map((d) => d.noCubiertosPorMotivo),
      MOTIVOS,
    ),
    cobertura: conRol.length ? cobertura(asignados, noCubiertos) : null,
    empalmes: autorizados.length
      ? autorizados.reduce((s, d) => s + (d.empalmes ?? 0), 0)
      : null,
    completados: dias.reduce((s, d) => s + d.completados, 0),
    cancelados: dias.reduce((s, d) => s + d.cancelados, 0),
    noShow: dias.reduce((s, d) => s + d.noShow, 0),
    incidencias: dias.reduce((s, d) => s + d.incidencias, 0),
    incidenciasPorTipo: sumar(
      dias.map((d) => d.incidenciasPorTipo),
      TIPOS_INCIDENCIA,
    ),
    ocupacion: asignados ? redondear(totalOcupacion / asignados, 3) : null,
    unidades: [...unidades]
      .map(([vehiculoId, u]) => ({
        vehiculoId,
        numeroEconomico: u.numeroEconomico,
        servicios: u.servicios,
        ocupacion: u.servicios ? redondear(u.ocupacion / u.servicios, 3) : null,
        horasJornadaPromedio: u.horas.length
          ? redondear(u.horas.reduce((s, h) => s + h, 0) / u.horas.length, 2)
          : null,
      }))
      .sort((a, b) =>
        a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', {
          numeric: true,
        }),
      ),
  };
}
