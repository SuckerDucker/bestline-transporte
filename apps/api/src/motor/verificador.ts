// Verificador independiente del motor. Revisa un rol ya generado contra TODAS
// las restricciones sin usar el código del motor (no importa algoritmo.ts):
// recalcula las horas desde la matriz y comprueba cada regla por su cuenta.
import type { Modalidad, ServicioMotor, UnidadMotor } from './tipos.js';

export interface DatosVerificacion {
  servicios: ServicioMotor[];
  unidades: UnidadMotor[];
  anticipacion: Record<Modalidad, number>;
  jornadaMaxima: number;
  zonasTermino: ReadonlySet<number>;
  /** Matriz "origen-destino" → minutos. */
  matriz: ReadonlyMap<string, number>;
}

export interface RolAVerificar {
  /** Secuencia de cada unidad, en orden. */
  asignaciones: {
    vehiculoId: number;
    servicios: { id: number; inicio?: number; liberacion?: number }[];
  }[];
  noCubiertos: number[];
}

/** Devuelve la lista de violaciones encontradas (vacía si el rol es válido). */
export function verificarRol(
  datos: DatosVerificacion,
  rol: RolAVerificar,
): string[] {
  const violaciones: string[] = [];
  const servicio = new Map(datos.servicios.map((s) => [s.id, s]));
  const unidad = new Map(datos.unidades.map((u) => [u.vehiculoId, u]));
  const minutos = (o: number, d: number) => {
    const t = datos.matriz.get(`${o}-${d}`);
    if (t === undefined) violaciones.push(`Falta el tiempo ${o}-${d}`);
    return t ?? Number.POSITIVE_INFINITY;
  };

  // Cada servicio aparece exactamente una vez: asignado o no cubierto.
  const vistos = [
    ...rol.asignaciones.flatMap((a) => a.servicios.map((s) => s.id)),
    ...rol.noCubiertos,
  ];
  for (const s of datos.servicios) {
    const veces = vistos.filter((id) => id === s.id).length;
    if (veces !== 1)
      violaciones.push(`El servicio ${s.folio} aparece ${veces} veces`);
  }
  if (vistos.length !== datos.servicios.length) {
    violaciones.push('Hay servicios en el rol que no son del día');
  }

  for (const a of rol.asignaciones) {
    const u = unidad.get(a.vehiculoId);
    if (!u) {
      violaciones.push(`La unidad ${a.vehiculoId} no existe`);
      continue;
    }
    if (!u.disponible && a.servicios.length > 0) {
      violaciones.push(
        `${u.numeroEconomico} no está disponible y tiene servicios`,
      );
    }
    let zona = u.encierro;
    let libre = u.cita;
    for (const asignado of a.servicios) {
      const s = servicio.get(asignado.id);
      if (!s) continue;
      const inicio = s.hora - datos.anticipacion[s.modalidad];
      const liberacion = s.hora + minutos(s.origen, s.destino);
      const etiqueta = `${u.numeroEconomico} / ${s.folio}`;
      if (asignado.inicio !== undefined && asignado.inicio !== inicio) {
        violaciones.push(
          `${etiqueta}: inicio guardado ${asignado.inicio}, esperado ${inicio}`,
        );
      }
      if (
        asignado.liberacion !== undefined &&
        asignado.liberacion !== liberacion
      ) {
        violaciones.push(
          `${etiqueta}: liberación guardada ${asignado.liberacion}, esperada ${liberacion}`,
        );
      }
      if (s.pasajeros > u.capacidad) violaciones.push(`${etiqueta}: CAPACIDAD`);
      if (libre + minutos(zona, s.origen) > inicio)
        violaciones.push(`${etiqueta}: EMPALME`);
      if (liberacion - u.cita > datos.jornadaMaxima)
        violaciones.push(`${etiqueta}: JORNADA`);
      zona = s.destino;
      libre = liberacion;
    }
    // REGLA CONFIRMADA CON LA EMPRESA (zona de término): fuera de zona de
    // término solo es válido si la unidad alcanza a regresar en vacío a su
    // encierro dentro de la jornada.
    if (
      a.servicios.length > 0 &&
      !datos.zonasTermino.has(zona) &&
      libre + minutos(zona, u.encierro) - u.cita > datos.jornadaMaxima
    ) {
      violaciones.push(
        `${u.numeroEconomico}: termina fuera de zona de término y no alcanza a regresar al encierro (ZONA_TERMINO)`,
      );
    }
  }
  return violaciones;
}
