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

describe('Parámetros de operación (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenCoordinador: string;

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
    await prisma.parametroOperacion.createMany({
      data: [
        { clave: 'hora_cita.turno_1', valor: '04:00', descripcion: 'Turno 1' },
        { clave: 'jornada_maxima_horas', valor: '9.5', descripcion: 'Jornada' },
        { clave: 'anticipacion.PRIVADO', valor: '10', descripcion: 'Privado' },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const guardar = (parametros: object[], token = tokenAdmin) =>
    request(app.getHttpServer())
      .put('/api/parametros')
      .set('Authorization', `Bearer ${token}`)
      .send({ parametros });

  it('200: cualquier rol autenticado puede leerlos', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/parametros')
      .set('Authorization', `Bearer ${tokenCoordinador}`)
      .expect(200);

    const claves = (respuesta.body as { clave: string }[]).map((p) => p.clave);
    expect(claves).toEqual([
      'anticipacion.PRIVADO',
      'hora_cita.turno_1',
      'jornada_maxima_horas',
    ]);
  });

  it('401: sin token', () => {
    return request(app.getHttpServer()).get('/api/parametros').expect(401);
  });

  it('200: el ADMINISTRADOR los edita y la bitácora guarda el antes y el después', async () => {
    const respuesta = await guardar([
      { clave: 'jornada_maxima_horas', valor: '10' },
      { clave: 'hora_cita.turno_1', valor: '04:30' },
    ]).expect(200);

    expect(respuesta.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clave: 'jornada_maxima_horas', valor: '10' }),
        expect.objectContaining({ clave: 'hora_cita.turno_1', valor: '04:30' }),
      ]),
    );
    const acciones = await prisma.bitacora.findMany({
      where: { entidad: 'parametro_operacion' },
      select: { accion: true },
    });
    expect(acciones.map((a) => a.accion).sort()).toEqual([
      'ACTUALIZAR: 04:00 → 04:30',
      'ACTUALIZAR: 9.5 → 10',
    ]);
  });

  it('400: valores inválidos, con el error por clave y sin guardar ninguno', async () => {
    const respuesta = await guardar([
      { clave: 'anticipacion.PRIVADO', valor: '15' },
      { clave: 'jornada_maxima_horas', valor: '13' },
    ]).expect(400);

    expect(respuesta.body).toMatchObject({
      errores: [
        {
          clave: 'jornada_maxima_horas',
          mensaje: 'debe ser un número de horas entre 1 y 12',
        },
      ],
    });
    // anticipacion.PRIVADO era válido, pero no se guardó (todo o nada).
    const anticipacion = await prisma.parametroOperacion.findUniqueOrThrow({
      where: { clave: 'anticipacion.PRIVADO' },
    });
    expect(anticipacion.valor).toBe('10');
  });

  it('404: clave inexistente', async () => {
    const respuesta = await guardar([
      { clave: 'hora_cita.turno_9', valor: '06:00' },
    ]).expect(404);
    expect(respuesta.body).toMatchObject({
      message: 'No existe el parámetro: hora_cita.turno_9',
    });
  });

  it('403: un COORDINADOR no puede editarlos', () => {
    return guardar(
      [{ clave: 'jornada_maxima_horas', valor: '11' }],
      tokenCoordinador,
    ).expect(403);
  });
});
