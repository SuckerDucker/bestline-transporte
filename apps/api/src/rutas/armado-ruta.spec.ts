import { aInstante } from '../roles/conversion.js';
import {
  armarParadas,
  type AsignacionRuta,
  type ZonaRuta,
} from './armado-ruta.js';

// Horas en minutos desde las 00:00 de Cancún del 10/11 (UTC−5).
const INICIO_DIA = new Date('2026-11-10T05:00:00Z');
const a = (minutos: number) => aInstante(INICIO_DIA, minutos);

const CUN: ZonaRuta = {
  id: 1,
  nombre: 'Aeropuerto CUN',
  esZonaTermino: true,
  latitud: 21.0365,
  longitud: -86.8771,
};
const ZH: ZonaRuta = {
  id: 2,
  nombre: 'Zona Hotelera',
  esZonaTermino: true,
  latitud: 21.11,
  longitud: -86.763,
};
const CENTRO: ZonaRuta = {
  id: 3,
  nombre: 'Centro Cancún',
  esZonaTermino: false,
  latitud: 21.1619,
  longitud: -86.8515,
};
const PLAYA: ZonaRuta = {
  id: 4,
  nombre: 'Playa del Carmen',
  esZonaTermino: false,
  latitud: 20.6296,
  longitud: -87.0739,
};
const HOTEL_ZH = {
  id: 10,
  nombre: 'Hotel Ejemplo ZH 1',
  zonaId: ZH.id,
  latitud: 21.1335,
  longitud: -86.7465,
};

// Matriz de ejemplo por sentido (minutos).
const MATRIZ: Record<string, number> = {
  '3-2': 25, // Centro → Zona Hotelera
  '3-1': 30, // Centro → CUN
  '4-3': 60, // Playa → Centro
};
const tiempo = (o: number, d: number) => MATRIZ[`${o}-${d}`];

let id = 0;
function asignacion(
  tipo: string,
  origen: ZonaRuta,
  destino: ZonaRuta,
  hora: number,
  liberacion: number,
  hotel: typeof HOTEL_ZH | null = null,
): AsignacionRuta {
  id++;
  return {
    inicioEfectivo: a(hora - 10),
    liberacion: a(liberacion),
    servicio: {
      id,
      folio: `S-${id}`,
      tipo,
      modalidad: 'PRIVADO',
      fechaHora: a(hora),
      pasajeros: 4,
      zonaOrigen: origen,
      zonaDestino: destino,
      hotel,
    },
  };
}

describe('armarParadas', () => {
  beforeEach(() => (id = 0));

  it('arma encierro, origen y destino de cada servicio en orden, con las horas del rol', () => {
    const paradas = armarParadas({
      encierro: CENTRO,
      cita: a(4 * 60),
      tiempo,
      asignaciones: [
        // SALIDA del hotel (ZH) a CUN a las 06:00; LLEGADA de CUN al hotel a las 08:00.
        asignacion('SALIDA', ZH, CUN, 360, 390, HOTEL_ZH),
        asignacion('LLEGADA', CUN, ZH, 480, 510, HOTEL_ZH),
      ],
    });

    expect(paradas.map((p) => [p.orden, p.tipo, p.nombre])).toEqual([
      [1, 'ENCIERRO_SALIDA', 'Centro Cancún'],
      [2, 'ORIGEN', 'Hotel Ejemplo ZH 1'],
      [3, 'DESTINO', 'Aeropuerto CUN'],
      [4, 'ORIGEN', 'Aeropuerto CUN'],
      [5, 'DESTINO', 'Hotel Ejemplo ZH 1'],
    ]);
    // Origen: llega en el inicio efectivo (05:50) y sale a la hora del servicio.
    expect(paradas[1]).toMatchObject({
      llegada: a(350),
      salida: a(360),
      zona: 'Zona Hotelera',
    });
    // Destino: llega y queda libre en la liberación.
    expect(paradas[2]).toMatchObject({ llegada: a(390), salida: a(390) });
    expect(paradas[1].latitud).toBe(HOTEL_ZH.latitud);
    expect(paradas[2].servicio).toMatchObject({
      folio: 'S-1',
      pasajeros: 4,
      origen: 'Hotel Ejemplo ZH 1',
      destino: 'Aeropuerto CUN',
    });
    // Termina en Zona Hotelera (zona de término): no hay regreso.
    expect(paradas.some((p) => p.tipo === 'ENCIERRO_REGRESO')).toBe(false);
  });

  it('sale del encierro cuando le alcanza para llegar al inicio efectivo, no a la hora de cita', () => {
    const [encierro] = armarParadas({
      encierro: CENTRO,
      cita: a(4 * 60),
      tiempo,
      asignaciones: [asignacion('SALIDA', ZH, CUN, 360, 390)],
    });
    // 05:50 − 25 min (Centro → ZH) = 05:25, después de la cita de las 04:00.
    expect(encierro).toMatchObject({
      llegada: null,
      salida: a(325),
      horaCita: a(240),
    });
  });

  it('sale a la hora de cita si el traslado al primer origen la rebasa', () => {
    const [encierro] = armarParadas({
      encierro: CENTRO,
      cita: a(270),
      tiempo,
      // Inicio efectivo 04:50 − 30 min (Centro → CUN) = 04:20, antes de la cita 04:30.
      asignaciones: [asignacion('LLEGADA', CUN, ZH, 300, 330)],
    });
    expect(encierro.salida).toEqual(a(270));
  });

  it('usa la hora de cita si falta en la matriz el tiempo del encierro al primer origen', () => {
    const [encierro] = armarParadas({
      encierro: CENTRO,
      cita: a(240),
      tiempo,
      asignaciones: [asignacion('TRASLADO', PLAYA, ZH, 600, 700)],
    });
    expect(encierro.salida).toEqual(a(240));
  });

  it('regresa al encierro si el último destino no es zona de término', () => {
    const paradas = armarParadas({
      encierro: CENTRO,
      cita: a(720),
      tiempo,
      asignaciones: [asignacion('TRASLADO', CUN, PLAYA, 900, 960)],
    });
    const regreso = paradas[paradas.length - 1];
    // Liberación 16:00 + 60 min (Playa → Centro) = 17:00.
    expect(regreso).toMatchObject({
      orden: 4,
      tipo: 'ENCIERRO_REGRESO',
      nombre: 'Centro Cancún',
      llegada: a(1020),
      salida: null,
    });
  });

  it('deja sin hora el regreso si falta el tiempo destino → encierro', () => {
    const paradas = armarParadas({
      encierro: PLAYA,
      cita: a(720),
      tiempo,
      asignaciones: [asignacion('TRASLADO', CUN, CENTRO, 900, 940)],
    });
    expect(paradas[paradas.length - 1]).toMatchObject({
      tipo: 'ENCIERRO_REGRESO',
      llegada: null,
    });
  });

  it('usa las coordenadas de la zona si el hotel no está en la zona de la parada', () => {
    // Hotel de Zona Hotelera en un servicio que sale de Centro: no corresponde.
    const paradas = armarParadas({
      encierro: CENTRO,
      cita: a(240),
      tiempo,
      asignaciones: [asignacion('SALIDA', CENTRO, CUN, 360, 390, HOTEL_ZH)],
    });
    expect(paradas[1]).toMatchObject({
      nombre: 'Centro Cancún',
      latitud: CENTRO.latitud,
    });
  });
});
