import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { aInstante } from '../roles/conversion.js';
import type { Punto } from './armado-ruta.js';
import type { OsrmCliente, Trazado } from './osrm.cliente.js';
import { RutasService } from './rutas.service.js';

const FECHA = '2026-11-10';
const INICIO_DIA = new Date('2026-11-10T05:00:00Z');
const a = (minutos: number) => aInstante(INICIO_DIA, minutos);
// Prisma devuelve las coordenadas como Decimal.
const d = (n: number) => new Prisma.Decimal(n);
const zona = (
  id: number,
  nombre: string,
  esZonaTermino: boolean,
  lat: number,
  lon: number,
) => ({
  id,
  nombre,
  esZonaTermino,
  latitud: d(lat),
  longitud: d(lon),
});
const CUN = zona(1, 'Aeropuerto CUN', true, 21.0365, -86.8771);
const CENTRO = zona(3, 'Centro Cancún', false, 21.1619, -86.8515);
const VEHICULO = {
  id: 3,
  numeroEconomico: 'BL-03',
  tipo: 'Van',
  capacidad: 14,
  encierroBase: 'Centro Cancún',
};
const OPERADOR = { id: 3, nombre: 'Luis García', horaCita: '12:00' };

const TRAZADO: Trazado = {
  geometria: { type: 'LineString', coordinates: [] },
  distanciaKm: 30.2,
  duracionMin: 41,
  trazado: 'carretera',
};

describe('RutasService', () => {
  let prisma: PrismaSimulado;
  let trazar: jest.Mock<(puntos: Punto[]) => Promise<Trazado>>;
  let servicio: RutasService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    trazar = jest
      .fn<(puntos: Punto[]) => Promise<Trazado>>()
      .mockResolvedValue(TRAZADO);
    servicio = new RutasService(comoPrisma(prisma), {
      trazar,
    } as unknown as OsrmCliente);
    prisma.rolDiario.findUnique.mockResolvedValue({
      id: 1,
      estado: 'PROPUESTO',
    });
    prisma.zona.findFirst.mockResolvedValue(CENTRO);
    prisma.tiempoTraslado.findMany.mockResolvedValue([
      { zonaOrigenId: 3, zonaDestinoId: 1, minutos: 30 },
      { zonaOrigenId: 1, zonaDestinoId: 3, minutos: 30 },
    ]);
  });

  it('404 si no hay rol de la fecha', async () => {
    prisma.rolDiario.findUnique.mockResolvedValue(null);
    await expect(servicio.obtener(FECHA, 3)).rejects.toThrow(
      new NotFoundException(`No hay rol del ${FECHA}`),
    );
  });

  it('404 si la unidad no tiene servicios ese día', async () => {
    prisma.asignacion.findMany.mockResolvedValue([]);
    await expect(servicio.obtener(FECHA, 3)).rejects.toThrow(NotFoundException);
    expect(trazar).not.toHaveBeenCalled();
  });

  it('404 si el encierro no es una zona del catálogo', async () => {
    prisma.asignacion.findMany.mockResolvedValue([fila()]);
    prisma.zona.findFirst.mockResolvedValue(null);
    await expect(servicio.obtener(FECHA, 3)).rejects.toThrow(
      /no es una zona del catálogo/,
    );
  });

  it('arma las paradas con coordenadas numéricas, pide el trazado y devuelve los totales', async () => {
    prisma.asignacion.findMany.mockResolvedValue([fila()]);
    const ruta = await servicio.obtener(FECHA, 3);

    expect(prisma.asignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rolId: 1, vehiculoId: 3 } }),
    );
    expect(ruta).toMatchObject({
      fecha: FECHA,
      estadoRol: 'PROPUESTO',
      vehiculo: { id: 3, numeroEconomico: 'BL-03' },
      operador: OPERADOR,
      servicios: 1,
      distanciaKm: 30.2,
      duracionMin: 41,
      trazado: 'carretera',
    });
    // Encierro, origen (CUN), destino (Centro, no es de término) y regreso.
    expect(ruta.paradas.map((p) => p.tipo)).toEqual([
      'ENCIERRO_SALIDA',
      'ORIGEN',
      'DESTINO',
      'ENCIERRO_REGRESO',
    ]);
    // Cita 12:00; inicio efectivo 13:05 − 30 min = 12:35.
    expect(ruta.paradas[0]).toMatchObject({
      salida: a(755),
      horaCita: a(720),
      latitud: 21.1619,
    });
    expect(trazar).toHaveBeenCalledWith(ruta.paradas);
  });

  it('sin hora de cita toma el inicio efectivo del primer servicio', async () => {
    prisma.asignacion.findMany.mockResolvedValue([
      fila({ ...OPERADOR, horaCita: null }),
    ]);
    const ruta = await servicio.obtener(FECHA, 3);
    expect(ruta.paradas[0].horaCita).toEqual(a(785));
  });
});

/** Asignación de BL-03: LLEGADA CUN → Centro a las 13:15 (inicio 13:05, libre 13:45). */
function fila(
  operador: { id: number; nombre: string; horaCita: string | null } = OPERADOR,
) {
  return {
    inicioEfectivo: a(785),
    liberacion: a(825),
    vehiculo: VEHICULO,
    operador,
    servicio: {
      id: 12,
      folio: 'NEX-0012',
      tipo: 'LLEGADA',
      modalidad: 'PRIVADO',
      fechaHora: a(795),
      pasajeros: 4,
      zonaOrigen: CUN,
      zonaDestino: CENTRO,
      hotel: {
        id: 1,
        nombre: 'Hotel Plaza Caribe',
        zonaId: 3,
        latitud: d(21.1605),
        longitud: d(-86.8475),
      },
    },
  };
}
