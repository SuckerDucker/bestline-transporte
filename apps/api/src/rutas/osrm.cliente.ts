// Cliente de OSRM (Open Source Routing Machine). Solo la API lo consulta, nunca
// el navegador. OSRM da el trazado por carretera, la distancia y la duración de
// manejo; las horas de las paradas salen del rol.
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Punto } from './armado-ruta.js';

/** Servidor público de demostración (máx. ~1 petición por segundo). */
export const OSRM_URL_DEMO = 'https://router.project-osrm.org';
export const TIEMPO_LIMITE_MS = 5_000;
export const MAX_CACHE = 200;
/** Token de inyección de fetch: las pruebas lo reemplazan por uno simulado. */
export const FETCH_OSRM = 'FETCH_OSRM';

export interface LineString {
  type: 'LineString';
  /** [longitud, latitud], como en GeoJSON. */
  coordinates: [number, number][];
}

export interface Trazado {
  geometria: LineString;
  distanciaKm: number;
  /** Minutos de manejo según OSRM; null si el trazado es aproximado. */
  duracionMin: number | null;
  trazado: 'carretera' | 'aproximado';
}

interface RespuestaOsrm {
  code: string;
  routes?: { geometry: LineString; distance: number; duration: number }[];
}

const RADIO_TIERRA_KM = 6371;
const rad = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en línea recta (fórmula de haversine) entre dos puntos, en km. */
export function distanciaRectaKm(a: Punto, b: Punto): number {
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitud)) *
      Math.cos(rad(b.latitud)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(h));
}

/** Respaldo: segmentos rectos entre las paradas y distancia por haversine. */
export function trazadoAproximado(puntos: Punto[]): Trazado {
  let km = 0;
  for (let i = 1; i < puntos.length; i++)
    km += distanciaRectaKm(puntos[i - 1], puntos[i]);
  return {
    geometria: {
      type: 'LineString',
      coordinates: puntos.map((p) => [p.longitud, p.latitud]),
    },
    distanciaKm: Math.round(km * 10) / 10,
    duracionMin: null,
    trazado: 'aproximado',
  };
}

/** Quita puntos consecutivos repetidos (p. ej. dejar y recoger en CUN). */
const sinRepetidos = (puntos: Punto[]) =>
  puntos.filter(
    (p, i) =>
      i === 0 ||
      p.latitud !== puntos[i - 1].latitud ||
      p.longitud !== puntos[i - 1].longitud,
  );

@Injectable()
export class OsrmCliente {
  private readonly logger = new Logger(OsrmCliente.name);
  private readonly url = (process.env.OSRM_URL || OSRM_URL_DEMO).replace(
    /\/+$/,
    '',
  );
  /** Caché en memoria: secuencia de coordenadas → trazado por carretera. */
  private readonly cache = new Map<string, Trazado>();
  private readonly fetch: typeof globalThis.fetch;

  constructor(
    @Optional() @Inject(FETCH_OSRM) fetchOsrm?: typeof globalThis.fetch,
  ) {
    this.fetch = fetchOsrm ?? globalThis.fetch;
  }

  /**
   * Trazado por carretera de la secuencia de puntos. Si OSRM falla, responde
   * con error o tarda más de 5 s, devuelve el trazado aproximado (no se guarda
   * en caché, para que la siguiente consulta vuelva a intentar con OSRM).
   */
  async trazar(puntos: Punto[]): Promise<Trazado> {
    const unicos = sinRepetidos(puntos);
    if (unicos.length < 2) return trazadoAproximado(puntos);
    const coordenadas = unicos
      .map((p) => `${p.longitud},${p.latitud}`)
      .join(';');
    const enCache = this.cache.get(coordenadas);
    if (enCache) return enCache;

    // Si OSRM no responde a tiempo se aborta la petición.
    const control = new AbortController();
    const reloj = setTimeout(
      () =>
        control.abort(
          new Error(`OSRM tardó más de ${TIEMPO_LIMITE_MS / 1000} s`),
        ),
      TIEMPO_LIMITE_MS,
    );
    try {
      const respuesta = await this.fetch(
        `${this.url}/route/v1/driving/${coordenadas}?overview=full&geometries=geojson`,
        { signal: control.signal },
      );
      if (!respuesta.ok) throw new Error(`OSRM respondió ${respuesta.status}`);
      const cuerpo = (await respuesta.json()) as RespuestaOsrm;
      const ruta = cuerpo.routes?.[0];
      if (cuerpo.code !== 'Ok' || !ruta)
        throw new Error(`OSRM respondió ${cuerpo.code}`);

      const trazado: Trazado = {
        geometria: ruta.geometry,
        distanciaKm: Math.round(ruta.distance / 100) / 10,
        duracionMin: Math.round(ruta.duration / 60),
        trazado: 'carretera',
      };
      // Al llegar al máximo se borra la entrada más antigua (los Map conservan
      // el orden de inserción).
      if (this.cache.size >= MAX_CACHE)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(coordenadas, trazado);
      return trazado;
    } catch (error) {
      this.logger.warn(`Trazado aproximado: ${(error as Error).message}`);
      return trazadoAproximado(puntos);
    } finally {
      clearTimeout(reloj);
    }
  }
}
