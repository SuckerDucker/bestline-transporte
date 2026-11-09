import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { RolUsuario } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { Matriz } from '../src/tiempos-traslado/tiempos-traslado.service.js';
import {
  crearApp,
  crearUsuario,
  limpiarBase,
  obtenerToken,
} from './utilidades-e2e.js';

describe('Matriz de tiempos y zonas de término (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenSupervisor: string;
  let cun: number;
  let tulum: number;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    await crearUsuario(prisma, 'admin@prueba.local', RolUsuario.ADMINISTRADOR);
    await crearUsuario(
      prisma,
      'supervisor@prueba.local',
      RolUsuario.SUPERVISOR,
    );
    tokenAdmin = await obtenerToken(app, 'admin@prueba.local');
    tokenSupervisor = await obtenerToken(app, 'supervisor@prueba.local');
    const zona = (nombre: string, esZonaTermino: boolean) =>
      prisma.zona.create({
        data: { nombre, latitud: 21, longitud: -87, esZonaTermino },
      });
    cun = (await zona('Aeropuerto CUN', true)).id;
    tulum = (await zona('Tulum', false)).id;
    await prisma.tiempoTraslado.create({
      data: { zonaOrigenId: cun, zonaDestinoId: tulum, minutos: 100 },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const guardar = (tiempos: object[], token = tokenAdmin) =>
    http()
      .put('/api/tiempos-traslado/matriz')
      .set('Authorization', `Bearer ${token}`)
      .send({ tiempos });

  it('200: la matriz indica las combinaciones que faltan (cualquier rol)', async () => {
    const respuesta = await http()
      .get('/api/tiempos-traslado/matriz')
      .set('Authorization', `Bearer ${tokenSupervisor}`)
      .expect(200);
    const matriz = respuesta.body as Matriz;

    expect(matriz.zonas.map((z) => z.nombre)).toEqual([
      'Aeropuerto CUN',
      'Tulum',
    ]);
    expect(matriz.matriz).toEqual([
      [null, 100],
      [null, null],
    ]);
    expect(matriz.faltantes).toHaveLength(3);
    expect(matriz.completa).toBe(false);
  });

  it('401: sin token', () => {
    return http().get('/api/tiempos-traslado/matriz').expect(401);
  });

  it('200: guarda todas las celdas juntas y deja la matriz completa', async () => {
    const respuesta = await guardar([
      { zonaOrigenId: cun, zonaDestinoId: cun, minutos: 10 },
      { zonaOrigenId: cun, zonaDestinoId: tulum, minutos: 95 },
      { zonaOrigenId: tulum, zonaDestinoId: cun, minutos: 105 },
      { zonaOrigenId: tulum, zonaDestinoId: tulum, minutos: 10 },
    ]).expect(200);

    expect((respuesta.body as Matriz).completa).toBe(true);
    const registros = await prisma.bitacora.findMany({
      where: { entidad: 'tiempo_traslado' },
      select: { accion: true },
    });
    expect(registros.map((r) => r.accion)).toEqual(
      expect.arrayContaining(['ACTUALIZAR: 100 → 95', 'CREAR: 10 min']),
    );
    expect(registros).toHaveLength(4);
  });

  it('400: una celda inválida no deja guardar ninguna', async () => {
    const respuesta = await guardar([
      { zonaOrigenId: cun, zonaDestinoId: tulum, minutos: 90 },
      { zonaOrigenId: tulum, zonaDestinoId: cun, minutos: 301 },
    ]).expect(400);

    expect(respuesta.body).toMatchObject({
      errores: [
        {
          zonaOrigenId: tulum,
          zonaDestinoId: cun,
          mensaje:
            'Tulum → Aeropuerto CUN: los minutos deben ser un número entero de 1 a 300',
        },
      ],
    });
    const sinCambio = await prisma.tiempoTraslado.findUniqueOrThrow({
      where: {
        zonaOrigenId_zonaDestinoId: { zonaOrigenId: cun, zonaDestinoId: tulum },
      },
    });
    expect(sinCambio.minutos).toBe(95);
  });

  it('403: un SUPERVISOR no puede editar la matriz', () => {
    return guardar(
      [{ zonaOrigenId: cun, zonaDestinoId: tulum, minutos: 90 }],
      tokenSupervisor,
    ).expect(403);
  });

  describe('PATCH /api/zonas/:id/zona-termino', () => {
    const marcar = (id: number, cuerpo: object, token = tokenAdmin) =>
      http()
        .patch(`/api/zonas/${id}/zona-termino`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo);

    it('200: marca la zona y queda en la bitácora', async () => {
      const respuesta = await marcar(tulum, { esZonaTermino: true }).expect(
        200,
      );

      expect(respuesta.body).toMatchObject({ id: tulum, esZonaTermino: true });
      const registro = await prisma.bitacora.findFirst({
        where: { entidad: 'zona', entidadId: tulum },
      });
      expect(registro?.accion).toBe('ACTUALIZAR: es_zona_termino false → true');
    });

    it('400: valor que no es booleano', () => {
      return marcar(tulum, { esZonaTermino: 'sí' }).expect(400);
    });

    it('403: un SUPERVISOR no puede cambiarla', () => {
      return marcar(tulum, { esZonaTermino: false }, tokenSupervisor).expect(
        403,
      );
    });

    it('400: no se puede quitar la última zona de término', async () => {
      // Hay dos (Aeropuerto CUN y Tulum): quitar una sí se permite.
      await marcar(cun, { esZonaTermino: false }).expect(200);

      const respuesta = await marcar(tulum, { esZonaTermino: false }).expect(
        400,
      );
      expect(respuesta.body).toMatchObject({
        message: 'Debe existir al menos una zona de término',
      });
      // Tampoco por la edición general de la zona.
      await http()
        .patch(`/api/zonas/${tulum}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ esZonaTermino: false })
        .expect(400);
      const zona = await prisma.zona.findUniqueOrThrow({
        where: { id: tulum },
      });
      expect(zona.esZonaTermino).toBe(true);
    });

    it('404: zona inexistente', () => {
      return marcar(9999, { esZonaTermino: true }).expect(404);
    });
  });
});
