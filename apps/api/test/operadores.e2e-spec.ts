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

describe('Operadores con vehículo y hora de cita (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let vehiculoId: number;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    await crearUsuario(prisma, 'admin@prueba.local', RolUsuario.ADMINISTRADOR);
    tokenAdmin = await obtenerToken(app, 'admin@prueba.local');
    vehiculoId = (
      await prisma.vehiculo.create({
        data: {
          numeroEconomico: 'BL-03',
          tipo: 'Van',
          capacidad: 14,
          estado: 'DISPONIBLE',
          encierroBase: 'Centro Cancún',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const crear = (cuerpo: object) =>
    request(app.getHttpServer())
      .post('/api/operadores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ licencia: 'LIC-1', telefono: '998-000-0001', ...cuerpo });

  it('201: crea el operador con su vehículo y hora de cita', async () => {
    const respuesta = await crear({
      nombre: 'Operador A',
      vehiculoId,
      horaCita: '04:15',
    }).expect(201);

    expect(respuesta.body).toMatchObject({
      vehiculoId,
      horaCita: '04:15',
      vehiculo: { numeroEconomico: 'BL-03' },
    });
  });

  it('409: el vehículo ya tiene un operador', async () => {
    const respuesta = await crear({ nombre: 'Operador B', vehiculoId }).expect(
      409,
    );
    expect(respuesta.body).toMatchObject({
      message: 'El vehículo BL-03 ya tiene un operador asignado',
    });
  });

  it('400: vehículo inexistente u hora de cita mal escrita', async () => {
    await crear({ nombre: 'Operador C', vehiculoId: 9999 }).expect(400);
    const respuesta = await crear({
      nombre: 'Operador C',
      horaCita: '4:15',
    }).expect(400);
    expect(respuesta.body.message).toContain(
      'horaCita debe tener el formato HH:mm (00:00 a 23:59)',
    );
  });

  it('200: quitar el vehículo con null lo deja libre para otro operador', async () => {
    const a = await prisma.operador.findFirstOrThrow({
      where: { nombre: 'Operador A' },
    });
    await request(app.getHttpServer())
      .patch(`/api/operadores/${a.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ vehiculoId: null, horaCita: null })
      .expect(200)
      .expect((r) =>
        expect(r.body).toMatchObject({ vehiculoId: null, horaCita: null }),
      );

    await crear({ nombre: 'Operador B', vehiculoId }).expect(201);
  });
});
