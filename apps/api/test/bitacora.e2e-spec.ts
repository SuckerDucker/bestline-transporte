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

interface PaginaBitacora {
  total: number;
  datos: { accion: string; fecha: string; usuario: { email: string } }[];
}

describe('Bitácora (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenSupervisor: string;
  let idAdmin: number;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    idAdmin = (
      await crearUsuario(prisma, 'admin@prueba.local', RolUsuario.ADMINISTRADOR)
    ).id;
    await crearUsuario(
      prisma,
      'supervisor@prueba.local',
      RolUsuario.SUPERVISOR,
    );
    tokenAdmin = await obtenerToken(app, 'admin@prueba.local');
    tokenSupervisor = await obtenerToken(app, 'supervisor@prueba.local');
    // Registros con fechas conocidas (hora de Cancún = UTC-5).
    await prisma.bitacora.createMany({
      data: [
        {
          usuarioId: idAdmin,
          accion: 'CREAR',
          entidad: 'zona',
          entidadId: 1,
          fecha: new Date('2026-11-01T15:00:00Z'),
        },
        {
          usuarioId: idAdmin,
          accion: 'ACTUALIZAR: 9.5 → 10',
          entidad: 'parametro_operacion',
          entidadId: 3,
          fecha: new Date('2026-11-05T15:00:00Z'),
        },
        // 23:30 del 10 de noviembre en Cancún (04:30 del 11 en UTC).
        {
          usuarioId: idAdmin,
          accion: 'ELIMINAR',
          entidad: 'hotel',
          entidadId: 2,
          fecha: new Date('2026-11-11T04:30:00Z'),
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const consultar = (query: string, token = tokenAdmin) =>
    request(app.getHttpServer())
      .get(`/api/bitacora${query}`)
      .set('Authorization', `Bearer ${token}`);

  it('200: del más reciente al más antiguo, con el usuario', async () => {
    const respuesta = await consultar('?entidad=hotel').expect(200);
    const cuerpo = respuesta.body as PaginaBitacora;

    expect(cuerpo.total).toBe(1);
    expect(cuerpo.datos[0]).toMatchObject({
      accion: 'ELIMINAR',
      usuario: { email: 'admin@prueba.local' },
    });

    const todos = (await consultar('?limite=100').expect(200))
      .body as PaginaBitacora;
    const fechas = todos.datos.map((d) => d.fecha);
    expect(fechas).toEqual([...fechas].sort().reverse());
  });

  it('200: rango de fechas en días de Cancún y acción con detalle', async () => {
    const rango = (
      await consultar('?desde=2026-11-05&hasta=2026-11-10').expect(200)
    ).body as PaginaBitacora;
    // Se ignoran los INICIO_SESION de hoy que generan los logins de la prueba.
    expect(
      rango.datos.map((d) => d.accion).filter((a) => a !== 'INICIO_SESION'),
    ).toEqual(['ELIMINAR', 'ACTUALIZAR: 9.5 → 10']);

    const accion = (
      await consultar(`?accion=ACTUALIZAR&usuarioId=${idAdmin}`).expect(200)
    ).body as PaginaBitacora;
    expect(accion.total).toBe(1);
  });

  it('400: fecha mal escrita, rango invertido y acción desconocida', async () => {
    await consultar('?desde=05-11-2026').expect(400);
    await consultar('?desde=2026-11-10&hasta=2026-11-01').expect(400);
    await consultar('?accion=BORRAR').expect(400);
  });

  it('403: un SUPERVISOR no puede consultar la bitácora', () => {
    return consultar('', tokenSupervisor).expect(403);
  });

  it('401: sin token', () => {
    return request(app.getHttpServer()).get('/api/bitacora').expect(401);
  });
});
