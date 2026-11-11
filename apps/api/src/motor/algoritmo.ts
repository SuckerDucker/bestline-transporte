// Motor de asignación: implementa el Código 1 y la Figura 23 de la memoria
// (GenerarRol). Son funciones puras: no leen ni escriben en la base de datos.
import {
  type NoCubierto,
  type ParametrosMotor,
  type Restriccion,
  RESTRICCIONES,
  type ResultadoRol,
  type ServicioCalculado,
  type ServicioMotor,
  type UnidadEnRol,
  type UnidadMotor,
} from './tipos.js';

/**
 * PARA CADA s EN servicios:
 *   s.inicio ← s.hora − anticipación(s.modalidad)
 *   s.liberación ← s.hora + tiempo(s.origen, s.destino)
 */
export function calcularHoras(
  servicios: ServicioMotor[],
  p: ParametrosMotor,
): ServicioCalculado[] {
  return servicios.map((s) => ({
    ...s,
    inicio: s.hora - p.anticipacion[s.modalidad],
    liberacion: s.hora + p.tiempo(s.origen, s.destino),
  }));
}

/**
 * Dónde está la unidad y desde cuándo está libre: después de su último
 * servicio o, si todavía no tiene, en su encierro a la hora de cita.
 */
export function posicion(u: UnidadEnRol): { zona: number; libre: number } {
  const anterior = u.secuencia.at(-1);
  return anterior
    ? { zona: anterior.destino, libre: anterior.liberacion }
    : { zona: u.encierro, libre: u.cita };
}

/**
 * VerificarRestricciones(u, s): devuelve la primera restricción que falla, en
 * el orden CAPACIDAD, EMPALME, JORNADA, o null si la unidad puede tomar s.
 * (La disponibilidad se revisa antes: una unidad no disponible no participa.)
 */
export function verificarRestricciones(
  u: UnidadEnRol,
  s: ServicioCalculado,
  p: ParametrosMotor,
): Restriccion | null {
  if (s.pasajeros > u.capacidad) return 'CAPACIDAD';
  // Primer servicio: sale del encierro a la hora de cita del operador.
  const { zona, libre } = posicion(u);
  if (libre + p.tiempo(zona, s.origen) > s.inicio) return 'EMPALME';
  if (s.liberacion - u.cita > p.jornadaMaxima) return 'JORNADA';
  return null;
}

/**
 * Costo(u, s) = minutos de espera + minutos en vacío + penalización por cada
 * servicio que la unidad ya tiene asignado.
 */
export function costo(
  u: UnidadEnRol,
  s: ServicioCalculado,
  p: ParametrosMotor,
): number {
  const { zona, libre } = posicion(u);
  const vacio = p.tiempo(zona, s.origen);
  const espera = s.inicio - (libre + vacio);
  return espera + vacio + p.penalizacionCarga * u.secuencia.length;
}

/** Desempate reproducible: menor número económico (BL-2 antes que BL-10). */
export const porNumeroEconomico = (a: UnidadMotor, b: UnidadMotor) =>
  a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', { numeric: true });

/**
 * Motivo del no cubierto: la restricción que lo rechazó en más unidades. En
 * empate gana la que va primero en el orden de verificación (regla
 * confirmada con el alumno).
 */
export function motivoPorMayoria(rechazos: Restriccion[]): Restriccion {
  const cuenta = (r: Restriccion) => rechazos.filter((x) => x === r).length;
  return RESTRICCIONES.reduce((mejor, r) =>
    cuenta(r) > cuenta(mejor) ? r : mejor,
  );
}

/**
 * GenerarRol(servicios, unidades, parámetros). Devuelve las secuencias de
 * cada unidad y los no cubiertos con su motivo (no guarda nada). Después de
 * la etapa voraz y la de zona de término, la etapa de reinserción intenta
 * colocar los no cubiertos en cualquier posición de cualquier unidad.
 */
export function generarRol(
  servicios: ServicioMotor[],
  unidades: UnidadMotor[],
  p: ParametrosMotor,
): ResultadoRol {
  const base = generarRolBase(servicios, unidades, p);
  return {
    unidades: base.unidades,
    noCubiertos: reinsertar(base.unidades, base.noCubiertos, p),
  };
}

/**
 * Etapa voraz y etapa de zona de término (el Código 1 antes de la mejora de
 * reinserción). Se exporta para comparar la cobertura con y sin reinserción.
 */
export function generarRolBase(
  servicios: ServicioMotor[],
  unidades: UnidadMotor[],
  p: ParametrosMotor,
): ResultadoRol {
  // Ordenar servicios por s.inicio de menor a mayor (orden estable).
  const ordenados = calcularHoras(servicios, p).sort(
    (a, b) => a.inicio - b.inicio,
  );
  // Las unidades no disponibles no participan en el rol.
  const participantes: UnidadEnRol[] = unidades
    .filter((u) => u.disponible)
    .sort(porNumeroEconomico)
    .map((u) => ({ ...u, secuencia: [] }));
  const noCubiertos: NoCubierto[] = [];

  for (const s of ordenados) {
    if (participantes.length === 0) {
      noCubiertos.push({ servicio: s, motivo: 'SIN_UNIDAD' });
      continue;
    }
    // factibles ← { u EN unidades | VerificarRestricciones(u, s) }
    const revision = participantes.map((u) => ({
      u,
      rechazo: verificarRestricciones(u, s, p),
    }));
    const factibles = revision.filter((r) => r.rechazo === null);
    if (factibles.length === 0) {
      const rechazos = revision.map((r) => r.rechazo as Restriccion);
      noCubiertos.push({ servicio: s, motivo: motivoPorMayoria(rechazos) });
      continue;
    }
    // u ← unidad de factibles con menor Costo(u, s); empate: menor número económico.
    const elegida = factibles
      .map(({ u }) => ({ u, c: costo(u, s, p) }))
      .reduce((mejor, x) =>
        x.c < mejor.c ||
        (x.c === mejor.c && porNumeroEconomico(x.u, mejor.u) < 0)
          ? x
          : mejor,
      ).u;
    elegida.secuencia.push(s);
  }

  noCubiertos.push(...reubicarPorZonaTermino(participantes, p));
  return { unidades: participantes, noCubiertos };
}

/**
 * PARA CADA u EN unidades
 *   MIENTRAS u no cierra bien el día (CierreValido: termina en zona de
 *   término o alcanza a regresar a su encierro dentro de la jornada)
 *     s ← quitar el último servicio de u
 *     SI s no cabe entre dos servicios de otra unidad → (s, ZONA_TERMINO)
 *
 * Modifica las secuencias de `unidades` y devuelve los no cubiertos.
 * Reglas confirmadas con el alumno: las unidades se recorren por número
 * económico, solo se inserta en unidades que ya terminan en zona válida y,
 * si cabe en varios huecos, se elige el de menor costo.
 */
export function reubicarPorZonaTermino(
  unidades: UnidadEnRol[],
  p: ParametrosMotor,
): NoCubierto[] {
  const noCubiertos: NoCubierto[] = [];
  const terminaBien = (u: UnidadEnRol) => cierreValido(u, p);

  for (const u of [...unidades].sort(porNumeroEconomico)) {
    while (u.secuencia.length > 0 && !terminaBien(u)) {
      const s = u.secuencia.pop() as ServicioCalculado;
      const otras = unidades.filter(
        (v) => v !== u && v.secuencia.length > 1 && terminaBien(v),
      );
      const hueco = mejorHueco(otras, s, p);
      if (hueco) hueco.unidad.secuencia.splice(hueco.indice, 0, s);
      else noCubiertos.push({ servicio: s, motivo: 'ZONA_TERMINO' });
    }
  }
  return noCubiertos;
}

/**
 * "Cabe entre dos servicios de otra unidad": entre dos servicios consecutivos
 * cumpliendo CAPACIDAD, EMPALME con el anterior y con el siguiente, y JORNADA.
 * Devuelve el hueco de menor costo (empate: menor número económico y luego el
 * hueco más temprano), o null si no cabe en ninguno.
 */
export function mejorHueco(
  unidades: UnidadEnRol[],
  s: ServicioCalculado,
  p: ParametrosMotor,
): { unidad: UnidadEnRol; indice: number } | null {
  let mejor: { unidad: UnidadEnRol; indice: number; c: number } | null = null;
  for (const v of [...unidades].sort(porNumeroEconomico)) {
    for (let i = 1; i < v.secuencia.length; i++) {
      const anterior = v.secuencia[i - 1];
      const siguiente = v.secuencia[i];
      const llegada =
        anterior.liberacion + p.tiempo(anterior.destino, s.origen);
      const cabe =
        s.pasajeros <= v.capacidad &&
        llegada <= s.inicio &&
        s.liberacion + p.tiempo(s.destino, siguiente.origen) <=
          siguiente.inicio &&
        s.liberacion - v.cita <= p.jornadaMaxima;
      if (!cabe) continue;
      // Mismo Costo(u, s) del motor, visto desde el servicio anterior del hueco.
      const vacio = p.tiempo(anterior.destino, s.origen);
      const c =
        s.inicio - llegada + vacio + p.penalizacionCarga * v.secuencia.length;
      if (!mejor || c < mejor.c) mejor = { unidad: v, indice: i, c };
    }
  }
  return mejor && { unidad: mejor.unidad, indice: mejor.indice };
}

/**
 * Zona de término (REGLA CONFIRMADA CON LA EMPRESA): el último servicio de la
 * unidad termina en una zona de término (Zona Hotelera o Aeropuerto CUN) o, si
 * termina en otra zona, a la unidad le alcanza la jornada para regresar en
 * vacío a su encierro:
 *   liberación del último + tiempo(destino, encierro) − cita <= jornada máxima
 * Una unidad sin servicios no tiene que cerrar nada.
 */
export function cierreValido(u: UnidadEnRol, p: ParametrosMotor): boolean {
  const ultimo = u.secuencia.at(-1);
  if (!ultimo || p.zonasTermino.has(ultimo.destino)) return true;
  const regreso = ultimo.liberacion + p.tiempo(ultimo.destino, u.encierro);
  return regreso - u.cita <= p.jornadaMaxima;
}

/**
 * La secuencia completa cumple todas las reglas: cada servicio pasa
 * VerificarRestricciones contra los servicios que lo preceden (CAPACIDAD,
 * EMPALME con el anterior o con el encierro y la cita, JORNADA) y la unidad
 * cierra bien el día (zona de término).
 */
export function secuenciaValida(
  u: UnidadEnRol,
  secuencia: ServicioCalculado[],
  p: ParametrosMotor,
): boolean {
  return revisarSecuencia(u, secuencia, p) === null;
}

/**
 * Igual que secuenciaValida, pero dice qué regla falla y en qué servicio: el
 * primero (en orden) que no pasa VerificarRestricciones contra los anteriores
 * o, si todos pasan y la unidad no cierra bien, ZONA_TERMINO en el último.
 * Devuelve null si la secuencia es válida. La usa también la revisión manual
 * del rol (una sola fuente de verdad).
 */
export function revisarSecuencia(
  u: UnidadEnRol,
  secuencia: ServicioCalculado[],
  p: ParametrosMotor,
): { motivo: Restriccion | 'ZONA_TERMINO'; indice: number } | null {
  for (let k = 0; k < secuencia.length; k++) {
    const motivo = verificarRestricciones(
      { ...u, secuencia: secuencia.slice(0, k) },
      secuencia[k],
      p,
    );
    if (motivo) return { motivo, indice: k };
  }
  return cierreValido({ ...u, secuencia }, p)
    ? null
    : { motivo: 'ZONA_TERMINO', indice: secuencia.length - 1 };
}

/**
 * Posición cronológica de s en una secuencia: antes del primer servicio que
 * empieza después (por inicio efectivo); con el mismo inicio, va después.
 */
export function posicionCronologica(
  secuencia: ServicioCalculado[],
  s: ServicioCalculado,
): number {
  const i = secuencia.findIndex((x) => x.inicio > s.inicio);
  return i === -1 ? secuencia.length : i;
}

/**
 * Costo incremental de poner s en la posición `indice` de u: espera antes de s
 * + vacío añadido (anterior → s → siguiente, menos anterior → siguiente) +
 * penalización por cada servicio que la unidad ya tiene. En la última
 * posición es el mismo Costo(u, s) de la etapa voraz.
 */
export function costoInsercion(
  u: UnidadEnRol,
  indice: number,
  s: ServicioCalculado,
  p: ParametrosMotor,
): number {
  const antes = { ...u, secuencia: u.secuencia.slice(0, indice) };
  const { zona, libre } = posicion(antes);
  const siguiente = u.secuencia[indice];
  const vacio =
    p.tiempo(zona, s.origen) +
    (siguiente
      ? p.tiempo(s.destino, siguiente.origen) - p.tiempo(zona, siguiente.origen)
      : 0);
  const espera = s.inicio - (libre + p.tiempo(zona, s.origen));
  return espera + vacio + p.penalizacionCarga * u.secuencia.length;
}

/**
 * Mejor inserción de s en cualquier posición (incluida la final y las
 * unidades vacías) de cualquier unidad, con secuencia resultante válida.
 * Menor costo incremental; empate: menor número económico y luego la
 * posición más temprana. null si no cabe en ninguna.
 */
export function mejorInsercion(
  unidades: UnidadEnRol[],
  s: ServicioCalculado,
  p: ParametrosMotor,
): { unidad: UnidadEnRol; indice: number } | null {
  let mejor: { unidad: UnidadEnRol; indice: number; c: number } | null = null;
  for (const u of [...unidades].sort(porNumeroEconomico)) {
    for (let i = 0; i <= u.secuencia.length; i++) {
      const nueva = [...u.secuencia.slice(0, i), s, ...u.secuencia.slice(i)];
      if (!secuenciaValida(u, nueva, p)) continue;
      const c = costoInsercion(u, i, s, p);
      // Solo un costo estrictamente menor reemplaza: así gana el primero en
      // el orden (número económico, posición).
      if (!mejor || c < mejor.c) mejor = { unidad: u, indice: i, c };
    }
  }
  return mejor && { unidad: mejor.unidad, indice: mejor.indice };
}

/**
 * Etapa de reinserción (mejora al Código 1):
 *   REPETIR
 *     PARA CADA s EN noCubiertos, por inicio efectivo
 *       SI cabe en alguna posición de alguna unidad → insertarlo donde cueste menos
 *   HASTA que en una pasada no se inserte ninguno
 * Modifica las secuencias y devuelve los que siguen sin cubrir, con su motivo
 * original. No relaja ninguna regla.
 */
export function reinsertar(
  unidades: UnidadEnRol[],
  noCubiertos: NoCubierto[],
  p: ParametrosMotor,
): NoCubierto[] {
  let pendientes = [...noCubiertos].sort(
    (a, b) => a.servicio.inicio - b.servicio.inicio,
  );
  let insertoAlguno = true;
  while (insertoAlguno && pendientes.length > 0) {
    insertoAlguno = false;
    const siguen: NoCubierto[] = [];
    for (const n of pendientes) {
      const lugar = mejorInsercion(unidades, n.servicio, p);
      if (lugar) {
        lugar.unidad.secuencia.splice(lugar.indice, 0, n.servicio);
        insertoAlguno = true;
      } else siguen.push(n);
    }
    pendientes = siguen;
  }
  return pendientes;
}

/** Matriz de tiempos como función; si falta un par lanza un error. */
export function crearTiempo(
  matriz: Map<string, number>,
): (origen: number, destino: number) => number {
  return (origen, destino) => {
    const minutos = matriz.get(`${origen}-${destino}`);
    if (minutos === undefined) {
      throw new Error(
        `Falta el tiempo de la zona ${origen} a la zona ${destino}`,
      );
    }
    return minutos;
  };
}
