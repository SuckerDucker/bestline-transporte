import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  EstadoServicio,
  EstadoVehiculo,
  ModalidadServicio,
  RolUsuario,
  TipoServicio,
} from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  crearApp,
  crearUsuario,
  limpiarBase,
  obtenerToken,
} from './utilidades-e2e.js';

describe('Resumen (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    await crearUsuario(
      prisma,
      'supervisor@prueba.local',
      RolUsuario.SUPERVISOR,
    );
    token = await obtenerToken(app, 'supervisor@prueba.local');

    // Datos mínimos: 2 vehículos activos y 1 de baja, 1 operador, 2 zonas, 1 hotel
    // y 3 servicios (2 del 10 de noviembre, uno de ellos completado; 1 del 11).
    await prisma.vehiculo.createMany({
      data: [
        {
          numeroEconomico: 'R-1',
          tipo: 'Van',
          capacidad: 14,
          estado: EstadoVehiculo.DISPONIBLE,
          encierroBase: 'E',
        },
        {
          numeroEconomico: 'R-2',
          tipo: 'Van',
          capacidad: 14,
          estado: EstadoVehiculo.MANTENIMIENTO,
          encierroBase: 'E',
        },
        {
          numeroEconomico: 'R-3',
          tipo: 'Van',
          capacidad: 14,
          estado: EstadoVehiculo.BAJA,
          encierroBase: 'E',
        },
      ],
    });
    await prisma.operador.create({
      data: { nombre: 'Operador R', licencia: 'L', telefono: '9980000000' },
    });
    const origen = await prisma.zona.create({
      data: {
        nombre: 'Origen',
        latitud: 21,
        longitud: -86,
        esZonaTermino: true,
      },
    });
    const destino = await prisma.zona.create({
      data: {
        nombre: 'Destino',
        latitud: 21,
        longitud: -86,
        esZonaTermino: false,
      },
    });
    await prisma.hotel.create({
      data: {
        nombre: 'Hotel R',
        zonaId: destino.id,
        latitud: 21,
        longitud: -86,
      },
    });
    const mayorista = await prisma.mayorista.create({
      data: { nombre: 'Mayorista R' },
    });
    const servicio = (
      folio: string,
      fechaHora: string,
      estado: EstadoServicio,
    ) => ({
      mayoristaId: mayorista.id,
      folio,
      localizador: `L-${folio}`,
      tipo: TipoServicio.LLEGADA,
      modalidad: ModalidadServicio.PRIVADO,
      fechaHora: new Date(fechaHora),
      pasajeros: 2,
      zonaOrigenId: origen.id,
      zonaDestinoId: destino.id,
      estado,
    });
    await prisma.servicio.createMany({
      data: [
        servicio('F-1', '2026-11-10T08:00:00-05:00', EstadoServicio.PENDIENTE),
        servicio('F-2', '2026-11-10T23:30:00-05:00', EstadoServicio.COMPLETADO),
        servicio('F-3', '2026-11-11T00:30:00-05:00', EstadoServicio.PENDIENTE),
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('200: devuelve los conteos del día indicado (hora de Cancún)', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/resumen?fecha=2026-11-10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(respuesta.body).toEqual({
      vehiculos: { activos: 2, disponibles: 1, enMantenimiento: 1 },
      operadores: { disponibles: 1, total: 1 },
      zonas: { total: 2, deTermino: 1 },
      hoteles: { total: 1 },
      // El servicio de las 00:30 del 11 no cuenta para el 10.
      servicios: { fecha: '2026-11-10', pendientes: 1, total: 2 },
    });
  });

  it('400: con una fecha mal escrita', () => {
    return request(app.getHttpServer())
      .get('/api/resumen?fecha=10-11-2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('401: sin token', () => {
    return request(app.getHttpServer()).get('/api/resumen').expect(401);
  });
});
