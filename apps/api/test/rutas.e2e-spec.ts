import { jest } from '@jest/globals';
import { type INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { RolUsuario } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { OsrmCliente } from '../src/rutas/osrm.cliente.js';
import {
  crearApp,
  crearUsuario,
  limpiarBase,
  obtenerToken,
} from './utilidades-e2e.js';

const DIA = '2026-11-10';
/** 00:00 del 10/11/2026 en Cancún (UTC−5). */
const INICIO_DIA = new Date('2026-11-10T05:00:00Z');
const a = (minutos: number) =>
  new Date(INICIO_DIA.getTime() + minutos * 60_000).toISOString();

// OSRM simulado: nunca se consulta el servidor real. "falla" cambia su
// comportamiento para probar el respaldo en línea recta.
const GEOMETRIA = {
  type: 'LineString',
  coordinates: [
    [-86.8515, 21.1619],
    [-86.8, 21.12],
    [-86.7465, 21.1335],
  ],
};
let falla = false;
const fetchSimulado = jest.fn<typeof globalThis.fetch>(() =>
  falla
    ? Promise.reject(new TypeError('fetch failed'))
    : Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            code: 'Ok',
            routes: [
              { geometry: GEOMETRIA, distance: 52_480, duration: 3_720 },
            ],
          }),
      } as Response),
);

interface Ruta {
  vehiculo: { numeroEconomico: string };
  paradas: {
    orden: number;
    tipo: string;
    nombre: string;
    llegada: string | null;
    salida: string | null;
    horaCita?: string;
    servicio?: { folio: string; pasajeros: number };
  }[];
  geometria: { type: string; coordinates: number[][] };
  distanciaKm: number;
  duracionMin: number | null;
  trazado: string;
}

describe('Rutas sugeridas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const token: Partial<Record<RolUsuario, string>> = {};
  const vehiculo: Record<string, number> = {};

  const get = (url: string, rol: RolUsuario = RolUsuario.COORDINADOR) =>
    request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${token[rol]}`);

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    ({ app, prisma } = await crearApp((b) =>
      b.overrideProvider(OsrmCliente).useValue(new OsrmCliente(fetchSimulado)),
    ));
    await limpiarBase(prisma);
    for (const rol of Object.values(RolUsuario)) {
      const email = `${rol.toLowerCase()}@prueba.local`;
      await crearUsuario(prisma, email, rol);
      token[rol] = await obtenerToken(app, email);
    }

    const zona: Record<string, number> = {};
    for (const [nombre, latitud, longitud, termino] of [
      ['Aeropuerto CUN', 21.0365, -86.8771, true],
      ['Zona Hotelera', 21.11, -86.763, true],
      ['Centro Cancún', 21.1619, -86.8515, false],
    ] as const) {
      zona[nombre] = (
        await prisma.zona.create({
          data: { nombre, latitud, longitud, esZonaTermino: termino },
        })
      ).id;
    }
    const ids = Object.values(zona);
    await prisma.tiempoTraslado.createMany({
      data: ids.flatMap((o) =>
        ids.map((d) => ({
          zonaOrigenId: o,
          zonaDestinoId: d,
          minutos: o === d ? 10 : 30,
        })),
      ),
    });
    const hotel = await prisma.hotel.create({
      data: {
        nombre: 'Hyatt Ziva Cancun',
        zonaId: zona['Zona Hotelera'],
        latitud: 21.1335,
        longitud: -86.7465,
      },
    });
    const operadorId: Record<string, number> = {};
    for (const n of [1, 2]) {
      const v = await prisma.vehiculo.create({
        data: {
          numeroEconomico: `BL-0${n}`,
          tipo: 'Van',
          capacidad: 14,
          estado: 'DISPONIBLE',
          encierroBase: 'Centro Cancún',
        },
      });
      vehiculo[v.numeroEconomico] = v.id;
      operadorId[v.numeroEconomico] = (
        await prisma.operador.create({
          data: {
            nombre: `Operador ${n}`,
            licencia: `L-${n}`,
            telefono: '998-000-0000',
            vehiculoId: v.id,
            horaCita: '04:00',
          },
        })
      ).id;
    }
    const { id: mayoristaId } = await prisma.mayorista.create({
      data: { nombre: 'Nexus Tours' },
    });

    // BL-01: SALIDA del hotel (ZH) a CUN a las 06:00 y TRASLADO de CUN a
    // Centro a las 08:00 (Centro no es zona de término: regresa al encierro).
    // BL-02 no tiene servicios.
    const rol = await prisma.rolDiario.create({
      data: { fecha: new Date(`${DIA}T00:00:00Z`), estado: 'PROPUESTO' },
    });
    for (const [orden, folio, tipo, hora, origen, destino, hotelId] of [
      [1, 'S-1', 'SALIDA', 360, 'Zona Hotelera', 'Aeropuerto CUN', hotel.id],
      [2, 'S-2', 'TRASLADO', 480, 'Aeropuerto CUN', 'Centro Cancún', null],
    ] as const) {
      const s = await prisma.servicio.create({
        data: {
          mayoristaId,
          folio,
          localizador: 'L',
          tipo,
          modalidad: 'PRIVADO',
          fechaHora: a(hora),
          pasajeros: 4,
          zonaOrigenId: zona[origen],
          zonaDestinoId: zona[destino],
          hotelId,
        },
      });
      await prisma.asignacion.create({
        data: {
          rolId: rol.id,
          servicioId: s.id,
          vehiculoId: vehiculo['BL-01'],
          operadorId: operadorId['BL-01'],
          orden,
          inicioEfectivo: a(hora - 10),
          liberacion: a(hora + 30),
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    falla = false;
    fetchSimulado.mockClear();
  });

  // Va antes que la de carretera: el trazado aproximado no se guarda en caché,
  // pero el de carretera sí.
  it('200 con trazado aproximado (línea recta) si OSRM falla', async () => {
    falla = true;
    const { body } = await get(
      `/api/roles/${DIA}/rutas/${vehiculo['BL-01']}`,
    ).expect(200);
    const ruta = body as Ruta;

    expect(ruta.trazado).toBe('aproximado');
    expect(ruta.duracionMin).toBeNull();
    expect(ruta.distanciaKm).toBeGreaterThan(0);
    // Un vértice por parada: encierro, 2 orígenes, 2 destinos y regreso.
    expect(ruta.geometria.coordinates).toHaveLength(6);
  });

  it('200 con las paradas en orden, las horas del rol y el trazado por carretera de OSRM', async () => {
    const { body } = await get(
      `/api/roles/${DIA}/rutas/${vehiculo['BL-01']}`,
      RolUsuario.SUPERVISOR,
    ).expect(200);
    const ruta = body as Ruta;

    expect(ruta.paradas.map((p) => [p.orden, p.tipo, p.nombre])).toEqual([
      [1, 'ENCIERRO_SALIDA', 'Centro Cancún'],
      [2, 'ORIGEN', 'Hyatt Ziva Cancun'],
      [3, 'DESTINO', 'Aeropuerto CUN'],
      [4, 'ORIGEN', 'Aeropuerto CUN'],
      [5, 'DESTINO', 'Centro Cancún'],
      [6, 'ENCIERRO_REGRESO', 'Centro Cancún'],
    ]);
    // Cita 04:00; sale a las 05:20 (inicio efectivo 05:50 − 30 min).
    expect(ruta.paradas[0]).toMatchObject({
      salida: a(320),
      horaCita: a(240),
    });
    expect(ruta.paradas[1]).toMatchObject({
      llegada: a(350),
      salida: a(360),
      servicio: { folio: 'S-1', pasajeros: 4 },
    });
    // Regreso: liberación 08:30 + 10 min (destino Centro → encierro Centro).
    expect(ruta.paradas[5].llegada).toBe(a(520));
    expect(ruta).toMatchObject({
      vehiculo: { numeroEconomico: 'BL-01' },
      geometria: GEOMETRIA,
      distanciaKm: 52.5,
      duracionMin: 62,
      trazado: 'carretera',
    });
    // La consulta fue al OSRM simulado con la URL de pruebas, no al real.
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(fetchSimulado.mock.calls[0][0] as string).toMatch(
      /^http:\/\/127\.0\.0\.1:9\/route\/v1\/driving\//,
    );
  });

  it('la segunda consulta de la misma ruta sale de la caché', async () => {
    await get(`/api/roles/${DIA}/rutas/${vehiculo['BL-01']}`).expect(200);
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('404 si la unidad no tiene servicios ese día', async () => {
    const { body } = await get(
      `/api/roles/${DIA}/rutas/${vehiculo['BL-02']}`,
    ).expect(404);
    expect((body as { message: string }).message).toBe(
      `La unidad no tiene servicios en el rol del ${DIA}`,
    );
    await get(`/api/roles/${DIA}/rutas/9999`).expect(404);
  });

  it('404 si no hay rol de la fecha', async () => {
    const { body } = await get(
      `/api/roles/2026-11-11/rutas/${vehiculo['BL-01']}`,
    ).expect(404);
    expect((body as { message: string }).message).toBe(
      'No hay rol del 2026-11-11',
    );
  });

  it('400 si la fecha no tiene el formato AAAA-MM-DD', async () => {
    await get(`/api/roles/10-11-2026/rutas/${vehiculo['BL-01']}`).expect(400);
  });

  it('403 para OPERADOR y 401 sin token', async () => {
    await get(
      `/api/roles/${DIA}/rutas/${vehiculo['BL-01']}`,
      RolUsuario.OPERADOR,
    ).expect(403);
    await request(app.getHttpServer())
      .get(`/api/roles/${DIA}/rutas/${vehiculo['BL-01']}`)
      .expect(401);
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});
