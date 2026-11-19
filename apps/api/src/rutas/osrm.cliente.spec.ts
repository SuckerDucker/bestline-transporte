import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import {
  distanciaRectaKm,
  MAX_CACHE,
  OSRM_URL_DEMO,
  OsrmCliente,
  TIEMPO_LIMITE_MS,
  trazadoAproximado,
} from './osrm.cliente.js';

// Ninguna prueba llama al OSRM real: fetch siempre es simulado.
type Fetch = typeof globalThis.fetch;
const CENTRO = { latitud: 21.1619, longitud: -86.8515 };
const CUN = { latitud: 21.0365, longitud: -86.8771 };
const ZH = { latitud: 21.1335, longitud: -86.7465 };

const GEOMETRIA = {
  type: 'LineString' as const,
  coordinates: [
    [-86.8515, 21.1619],
    [-86.86, 21.1],
    [-86.8771, 21.0365],
  ] as [number, number][],
};
const respuestaOk = (
  cuerpo: unknown = {
    code: 'Ok',
    routes: [{ geometry: GEOMETRIA, distance: 18_345, duration: 1_530 }],
  },
) =>
  ({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) }) as Response;

function crear(implementacion: Fetch) {
  const fetch = jest.fn<Fetch>(implementacion);
  return { fetch, cliente: new OsrmCliente(fetch) };
}

describe('OsrmCliente', () => {
  const urlAnterior = process.env.OSRM_URL;
  // El aviso de "trazado aproximado" es esperado en estas pruebas.
  beforeAll(() =>
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
  );
  beforeEach(() => delete process.env.OSRM_URL);
  afterAll(() => (process.env.OSRM_URL = urlAnterior));

  it('pide la ruta por carretera y convierte metros a km y segundos a minutos', async () => {
    const { fetch, cliente } = crear(() => Promise.resolve(respuestaOk()));
    const trazado = await cliente.trazar([CENTRO, CUN]);

    expect(trazado).toEqual({
      geometria: GEOMETRIA,
      distanciaKm: 18.3,
      duracionMin: 26,
      trazado: 'carretera',
    });
    const [url, opciones] = fetch.mock.calls[0];
    // OSRM recibe longitud,latitud separados por punto y coma.
    expect(url).toBe(
      `${OSRM_URL_DEMO}/route/v1/driving/-86.8515,21.1619;-86.8771,21.0365?overview=full&geometries=geojson`,
    );
    expect(opciones?.signal).toBeInstanceOf(AbortSignal);
  });

  it('usa OSRM_URL del entorno sin la diagonal final', async () => {
    process.env.OSRM_URL = 'http://osrm.local:5000/';
    const { fetch, cliente } = crear(() => Promise.resolve(respuestaOk()));
    await cliente.trazar([CENTRO, CUN]);
    expect(fetch.mock.calls[0][0] as string).toMatch(
      /^http:\/\/osrm\.local:5000\/route\/v1\/driving\//,
    );
  });

  it('guarda en caché por secuencia de coordenadas: la segunda consulta no llama a OSRM', async () => {
    const { fetch, cliente } = crear(() => Promise.resolve(respuestaOk()));
    const primera = await cliente.trazar([CENTRO, CUN, ZH]);
    const segunda = await cliente.trazar([CENTRO, CUN, ZH]);
    await cliente.trazar([CENTRO, ZH]); // otra secuencia, otra consulta

    expect(segunda).toBe(primera);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('quita puntos repetidos seguidos antes de consultar (misma llave de caché)', async () => {
    const { fetch, cliente } = crear(() => Promise.resolve(respuestaOk()));
    await cliente.trazar([CENTRO, CUN, CUN, ZH]);
    await cliente.trazar([CENTRO, CUN, ZH]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch.mock.calls[0][0] as string).split(';')).toHaveLength(3);
  });

  it('borra la entrada más antigua al llenar la caché', async () => {
    const { fetch, cliente } = crear(() => Promise.resolve(respuestaOk()));
    const punto = (i: number) => ({ latitud: 21 + i / 1000, longitud: -86.8 });
    for (let i = 0; i <= MAX_CACHE; i++)
      await cliente.trazar([CENTRO, punto(i)]);
    expect(fetch).toHaveBeenCalledTimes(MAX_CACHE + 1);

    await cliente.trazar([CENTRO, punto(MAX_CACHE)]); // la más reciente sigue
    expect(fetch).toHaveBeenCalledTimes(MAX_CACHE + 1);
    await cliente.trazar([CENTRO, punto(0)]); // la primera ya salió
    expect(fetch).toHaveBeenCalledTimes(MAX_CACHE + 2);
  });

  it.each([
    ['falla la red', () => Promise.reject(new TypeError('fetch failed'))],
    [
      'responde 503',
      () => Promise.resolve({ ok: false, status: 503 } as Response),
    ],
    [
      'responde sin ruta',
      () => Promise.resolve(respuestaOk({ code: 'NoRoute', routes: [] })),
    ],
  ])(
    'si OSRM %s responde en línea recta, "aproximado" y sin guardar en caché',
    async (_caso, implementacion) => {
      const { fetch, cliente } = crear(implementacion as Fetch);
      const trazado = await cliente.trazar([CENTRO, CUN, ZH]);

      expect(trazado.trazado).toBe('aproximado');
      expect(trazado.duracionMin).toBeNull();
      expect(trazado.geometria.coordinates).toEqual([
        [CENTRO.longitud, CENTRO.latitud],
        [CUN.longitud, CUN.latitud],
        [ZH.longitud, ZH.latitud],
      ]);
      await cliente.trazar([CENTRO, CUN, ZH]);
      expect(fetch).toHaveBeenCalledTimes(2); // vuelve a intentar con OSRM
    },
  );

  it(`corta la consulta a los ${TIEMPO_LIMITE_MS / 1000} s y responde aproximado`, async () => {
    jest.useFakeTimers();
    try {
      // fetch simulado que solo termina cuando se aborta la señal.
      const { cliente } = crear(
        (_url, opciones) =>
          new Promise<Response>((_resolver, rechazar) => {
            opciones?.signal?.addEventListener('abort', () =>
              rechazar(opciones.signal?.reason),
            );
          }),
      );
      const pendiente = cliente.trazar([CENTRO, CUN]);
      await jest.advanceTimersByTimeAsync(TIEMPO_LIMITE_MS);
      await expect(pendiente).resolves.toMatchObject({ trazado: 'aproximado' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('con menos de dos puntos distintos no consulta a OSRM', async () => {
    const { fetch, cliente } = crear(() => Promise.resolve(respuestaOk()));
    const trazado = await cliente.trazar([CUN, CUN]);
    expect(fetch).not.toHaveBeenCalled();
    expect(trazado).toMatchObject({ trazado: 'aproximado', distanciaKm: 0 });
  });
});

describe('trazado aproximado', () => {
  it('distancia en línea recta (haversine) entre Centro Cancún y CUN ≈ 14 km', () => {
    expect(distanciaRectaKm(CENTRO, CUN)).toBeCloseTo(14.2, 0);
    expect(distanciaRectaKm(CUN, CUN)).toBe(0);
  });

  it('suma los tramos y redondea a un decimal', () => {
    const km = distanciaRectaKm(CENTRO, CUN) + distanciaRectaKm(CUN, ZH);
    expect(trazadoAproximado([CENTRO, CUN, ZH]).distanciaKm).toBe(
      Math.round(km * 10) / 10,
    );
  });
});
