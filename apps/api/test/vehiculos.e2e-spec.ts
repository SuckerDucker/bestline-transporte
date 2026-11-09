import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { RolUsuario } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  crearApp,
  crearUsuario,
  limpiarBase,
  obtenerToken,
} from './utilidades-e2e.js';

describe('Vehículos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenCoordinador: string;

  const vehiculoValido = {
    numeroEconomico: 'E2E-01',
    tipo: 'Sprinter',
    capacidad: 20,
    encierroBase: 'Centro Cancún',
  };

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    await crearUsuario(prisma, 'admin@prueba.local', RolUsuario.ADMINISTRADOR);
    await crearUsuario(
      prisma,
      'coordinador@prueba.local',
      RolUsuario.COORDINADOR,
    );
    tokenAdmin = await obtenerToken(app, 'admin@prueba.local');
    tokenCoordinador = await obtenerToken(app, 'coordinador@prueba.local');
    // El encierro base debe ser una zona del catálogo.
    await prisma.zona.create({
      data: {
        nombre: 'Centro Cancún',
        latitud: 21.16,
        longitud: -86.85,
        esZonaTermino: false,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const crear = (token: string | null, cuerpo: object) => {
    const peticion = request(app.getHttpServer())
      .post('/api/vehiculos')
      .send(cuerpo);
    return token ? peticion.set('Authorization', `Bearer ${token}`) : peticion;
  };

  it('201: el ADMINISTRADOR da de alta un vehículo y queda en la bitácora', async () => {
    const respuesta = await crear(tokenAdmin, vehiculoValido).expect(201);

    expect(respuesta.body).toMatchObject({
      ...vehiculoValido,
      id: expect.any(Number),
      estado: 'DISPONIBLE',
    });
    const registro = await prisma.bitacora.findFirst({
      where: { accion: 'CREAR', entidad: 'vehiculo' },
    });
    expect(registro?.entidadId).toBe((respuesta.body as { id: number }).id);
  });

  it('400: capacidad mayor al máximo del tipo (Sprinter 25 > 20)', async () => {
    const respuesta = await crear(tokenAdmin, {
      ...vehiculoValido,
      numeroEconomico: 'E2E-02',
      capacidad: 25,
    }).expect(400);

    expect(respuesta.body).toMatchObject({
      message:
        'La capacidad de un vehículo Sprinter debe estar entre 1 y 20 pasajeros',
    });
  });

  it('400: encierro base que no es una zona del catálogo', async () => {
    const respuesta = await crear(tokenAdmin, {
      ...vehiculoValido,
      numeroEconomico: 'E2E-07',
      encierroBase: 'Bodega X',
    }).expect(400);
    expect(respuesta.body).toMatchObject({
      message: 'El encierro base "Bodega X" no es una zona del catálogo',
    });
  });

  it('400: tipo de vehículo desconocido', () => {
    return crear(tokenAdmin, {
      ...vehiculoValido,
      numeroEconomico: 'E2E-03',
      tipo: 'Camión',
    }).expect(400);
  });

  it('400: propiedades no declaradas en el DTO', () => {
    return crear(tokenAdmin, {
      ...vehiculoValido,
      numeroEconomico: 'E2E-04',
      color: 'rojo',
    }).expect(400);
  });

  it('403: un COORDINADOR no puede dar de alta vehículos', async () => {
    const respuesta = await crear(tokenCoordinador, {
      ...vehiculoValido,
      numeroEconomico: 'E2E-05',
    }).expect(403);

    expect(respuesta.body).toMatchObject({
      message: 'No tienes permiso para realizar esta acción',
    });
  });

  it('401: sin token', () => {
    return crear(null, { ...vehiculoValido, numeroEconomico: 'E2E-06' }).expect(
      401,
    );
  });

  it('200: el COORDINADOR sí puede consultar el listado', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/vehiculos?tipo=Sprinter')
      .set('Authorization', `Bearer ${tokenCoordinador}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({ total: 1, pagina: 1, limite: 10 });
  });

  it('200: desactivar deja el vehículo en BAJA', async () => {
    const vehiculo = await prisma.vehiculo.findUniqueOrThrow({
      where: { numeroEconomico: 'E2E-01' },
    });
    const respuesta = await request(app.getHttpServer())
      .patch(`/api/vehiculos/${vehiculo.id}/desactivar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({ estado: 'BAJA' });
  });
});
