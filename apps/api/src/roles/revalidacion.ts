// Revalidación de un cambio manual al rol (mover un servicio o asignar un no
// cubierto). No tiene reglas propias: usa las mismas funciones del motor
// (revisarSecuencia = VerificarRestricciones + CierreVálido) y solo arma el
// motivo y un detalle legible en español.
import { posicionCronologica, revisarSecuencia } from '../motor/algoritmo.js';
import type {
  ParametrosMotor,
  Restriccion,
  ServicioCalculado,
  UnidadEnRol,
} from '../motor/tipos.js';
import { minutosAHora } from './conversion.js';

/** Motivos del 400 de una revalidación. */
export type MotivoRevision = Restriccion | 'ZONA_TERMINO' | 'DISPONIBILIDAD';

export type Revision =
  | { valido: true; posicion: number }
  | { valido: false; motivo: MotivoRevision; detalle: string };

/**
 * ¿Se puede poner s en `destino`? Inserta s en su posición cronológica,
 * revisa la secuencia COMPLETA del destino y, si s viene de otra unidad, la
 * secuencia que le queda al `origen` (su nuevo último servicio puede no cerrar
 * bien el día).
 */
export function revisarMovimiento(
  s: ServicioCalculado,
  destino: UnidadEnRol,
  origen: UnidadEnRol | null,
  p: ParametrosMotor,
  nombreZona: ReadonlyMap<number, string>,
): Revision {
  if (!destino.disponible) {
    return {
      valido: false,
      motivo: 'DISPONIBILIDAD',
      detalle: `${destino.numeroEconomico} no está disponible: el vehículo o su operador no están disponibles, o el operador no tiene hora de cita`,
    };
  }
  const base = destino.secuencia.filter((x) => x.id !== s.id);
  const posicion = posicionCronologica(base, s);
  const nueva = [...base.slice(0, posicion), s, ...base.slice(posicion)];
  const enDestino = revisarSecuencia(destino, nueva, p);
  if (enDestino) {
    return {
      valido: false,
      motivo: enDestino.motivo,
      detalle: describir(destino, nueva, enDestino, s, p, nombreZona),
    };
  }
  if (origen) {
    const restante = origen.secuencia.filter((x) => x.id !== s.id);
    const enOrigen = revisarSecuencia(origen, restante, p);
    if (enOrigen) {
      return {
        valido: false,
        motivo: enOrigen.motivo,
        detalle: `Al quitarlo de ${origen.numeroEconomico}: ${describir(origen, restante, enOrigen, null, p, nombreZona)}`,
      };
    }
  }
  return { valido: true, posicion };
}

/** Texto del problema que encontró revisarSecuencia en el servicio `indice`. */
function describir(
  u: UnidadEnRol,
  secuencia: ServicioCalculado[],
  falla: { motivo: Restriccion | 'ZONA_TERMINO'; indice: number },
  movido: ServicioCalculado | null,
  p: ParametrosMotor,
  nombreZona: ReadonlyMap<number, string>,
): string {
  const actual = secuencia[falla.indice];
  const anterior = secuencia[falla.indice - 1];
  const zona = (id: number) => nombreZona.get(id) ?? `zona ${id}`;
  const servicio = (x: ServicioCalculado) =>
    `el servicio ${x.folio} de ${minutosAHora(x.hora)}`;
  switch (falla.motivo) {
    case 'CAPACIDAD':
      return `${actual.folio} lleva ${actual.pasajeros} pasajeros y ${u.numeroEconomico} tiene capacidad para ${u.capacidad}`;
    case 'EMPALME':
      if (!anterior) {
        return `${u.numeroEconomico} no alcanza a llegar desde su encierro (${zona(u.encierro)}, cita a las ${minutosAHora(u.cita)}) al servicio ${actual.folio} de ${minutosAHora(actual.hora)}`;
      }
      // El otro servicio del par que se empalma, visto desde el que se mueve.
      if (movido && actual.id === movido.id)
        return `Empalma con ${servicio(anterior)} en ${u.numeroEconomico}`;
      if (movido && anterior.id === movido.id)
        return `Empalma con ${servicio(actual)} en ${u.numeroEconomico}`;
      return `${servicio(anterior)} y ${servicio(actual)} se empalmarían en ${u.numeroEconomico}`;
    case 'JORNADA':
      return `${actual.folio} libera a las ${minutosAHora(actual.liberacion)}, después del fin de la jornada de ${u.numeroEconomico} (${minutosAHora(u.cita + p.jornadaMaxima)})`;
    case 'ZONA_TERMINO':
      return `${u.numeroEconomico} terminaría el día en ${zona(actual.destino)} a las ${minutosAHora(actual.liberacion)} y no alcanza a regresar a su encierro (${zona(u.encierro)}) antes de las ${minutosAHora(u.cita + p.jornadaMaxima)}`;
  }
}
