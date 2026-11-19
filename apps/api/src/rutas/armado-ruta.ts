// Armado de la ruta sugerida de una unidad: lista ordenada de paradas
// a partir de las asignaciones del rol. Es una función pura (sin base de datos
// ni OSRM) para poder probarla sola. Las horas salen del rol, no de OSRM.

const MINUTO = 60_000;

export interface Punto {
  latitud: number;
  longitud: number;
}

export interface ZonaRuta extends Punto {
  id: number;
  nombre: string;
  esZonaTermino: boolean;
}

export interface HotelRuta extends Punto {
  id: number;
  nombre: string;
  zonaId: number;
}

/** Asignación del rol con su servicio, ya en el orden en que la unidad lo hace. */
export interface AsignacionRuta {
  inicioEfectivo: Date;
  liberacion: Date;
  servicio: {
    id: number;
    folio: string;
    tipo: string;
    modalidad: string;
    fechaHora: Date;
    pasajeros: number;
    zonaOrigen: ZonaRuta;
    zonaDestino: ZonaRuta;
    hotel: HotelRuta | null;
  };
}

export type TipoParada =
  'ENCIERRO_SALIDA' | 'ORIGEN' | 'DESTINO' | 'ENCIERRO_REGRESO';

export interface Parada extends Punto {
  orden: number;
  tipo: TipoParada;
  /** Hotel si la parada es en el hotel del servicio; si no, la zona. */
  nombre: string;
  zona: string;
  llegada: Date | null;
  salida: Date | null;
  /** Solo en la salida del encierro: hora en que firma el operador. */
  horaCita?: Date;
  servicio?: {
    id: number;
    folio: string;
    tipo: string;
    modalidad: string;
    pasajeros: number;
    origen: string;
    destino: string;
  };
}

export interface DatosRuta {
  encierro: ZonaRuta;
  /** Hora de cita del operador como instante. */
  cita: Date;
  asignaciones: AsignacionRuta[];
  /** Minutos de la matriz (por sentido) entre dos zonas, si existen. */
  tiempo: (origenId: number, destinoId: number) => number | undefined;
}

const mas = (instante: Date, minutos: number) =>
  new Date(instante.getTime() + minutos * MINUTO);

/**
 * Punto de una parada: el hotel si pertenece a esa zona y al lado del servicio
 * que le toca (en una LLEGADA el hotel es el destino; en SALIDA y TRASLADO, el
 * origen); si no, las coordenadas de la zona.
 */
function lugar(a: AsignacionRuta, lado: 'origen' | 'destino') {
  const s = a.servicio;
  const zona = lado === 'origen' ? s.zonaOrigen : s.zonaDestino;
  const ladoHotel = s.tipo === 'LLEGADA' ? 'destino' : 'origen';
  const hotel =
    s.hotel && s.hotel.zonaId === zona.id && lado === ladoHotel
      ? s.hotel
      : null;
  const punto = hotel ?? zona;
  return {
    nombre: punto.nombre,
    zona: zona.nombre,
    latitud: punto.latitud,
    longitud: punto.longitud,
  };
}

/**
 * Hora en que la unidad sale del encierro: la mayor entre la hora de cita y
 * lo justo para llegar al primer origen en su inicio efectivo. Si falta en la
 * matriz el traslado encierro → primer origen, sale a la hora de cita.
 */
export function salidaDelEncierro(
  cita: Date,
  inicioPrimero: Date,
  traslado: number | undefined,
): Date {
  if (traslado === undefined) return cita;
  const justoATiempo = mas(inicioPrimero, -traslado);
  return justoATiempo > cita ? justoATiempo : cita;
}

/**
 * Origen y destino de un servicio. Origen: llega en el inicio efectivo y sale
 * a la hora del servicio. Destino: llega y queda libre en la liberación.
 */
function paradasDelServicio(a: AsignacionRuta): Omit<Parada, 'orden'>[] {
  const s = a.servicio;
  const [origen, destino] = [lugar(a, 'origen'), lugar(a, 'destino')];
  const servicio = {
    id: s.id,
    folio: s.folio,
    tipo: s.tipo,
    modalidad: s.modalidad,
    pasajeros: s.pasajeros,
    origen: origen.nombre,
    destino: destino.nombre,
  };
  return [
    {
      ...origen,
      tipo: 'ORIGEN',
      llegada: a.inicioEfectivo,
      salida: s.fechaHora,
      servicio,
    },
    {
      ...destino,
      tipo: 'DESTINO',
      llegada: a.liberacion,
      salida: a.liberacion,
      servicio,
    },
  ];
}

/** El encierro como parada: nombre y coordenadas de su zona. */
const puntoEncierro = (e: ZonaRuta) => ({
  nombre: e.nombre,
  zona: e.nombre,
  latitud: e.latitud,
  longitud: e.longitud,
});

/**
 * Paradas en orden: salida del encierro, origen y destino de cada servicio y,
 * si el último destino no es zona de término, regreso al encierro (liberación
 * del último + traslado destino → encierro). Las horas son las del rol.
 */
export function armarParadas(datos: DatosRuta): Parada[] {
  const { encierro: e, cita, asignaciones, tiempo } = datos;
  const [primera, ultima] = [asignaciones[0], asignaciones.at(-1)!];
  const enc = puntoEncierro(e);
  const traslado = tiempo(e.id, primera.servicio.zonaOrigen.id);
  const salida = salidaDelEncierro(cita, primera.inicioEfectivo, traslado);
  const paradas: Omit<Parada, 'orden'>[] = [
    { ...enc, tipo: 'ENCIERRO_SALIDA', llegada: null, salida, horaCita: cita },
    ...asignaciones.flatMap(paradasDelServicio),
  ];
  if (!ultima.servicio.zonaDestino.esZonaTermino) {
    const regreso = tiempo(ultima.servicio.zonaDestino.id, e.id);
    const llegada =
      regreso === undefined ? null : mas(ultima.liberacion, regreso);
    paradas.push({ ...enc, tipo: 'ENCIERRO_REGRESO', llegada, salida: null });
  }
  return paradas.map((p, i) => ({ ...p, orden: i + 1 }));
}
