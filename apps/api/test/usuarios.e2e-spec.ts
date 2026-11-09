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

describe('Usuarios (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenCoordinador: string;
  let idAdmin: number;

  const nuevo = {
    nombre: 'Usuario E2E',
    email: 'Nuevo.E2E@Prueba.local',
    password: 'Contraseña-e2e-1',
    rol: 'SUPERVISOR',
  };

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    idAdmin = (
      await crearUsuario(prisma, 'admin@prueba.local', RolUsuario.ADMINISTRADOR)
    ).id;
    await crearUsuario(
      prisma,
      'coordinador@prueba.local',
      RolUsuario.COORDINADOR,
    );
    tokenAdmin = await obtenerToken(app, 'admin@prueba.local');
    tokenCoordinador = await obtenerToken(app, 'coordinador@prueba.local');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const comoAdmin = (peticion: request.Test) =>
    peticion.set('Authorization', `Bearer ${tokenAdmin}`);
  const idDe = async (email: string) =>
    (await prisma.usuario.findUniqueOrThrow({ where: { email } })).id;

  it('201: alta con la contraseña cifrada y sin password_hash en la respuesta', async () => {
    const respuesta = await comoAdmin(
      http().post('/api/usuarios').send(nuevo),
    ).expect(201);

    expect(respuesta.body).toEqual({
      id: expect.any(Number),
      nombre: 'Usuario E2E',
      email: 'nuevo.e2e@prueba.local',
      rol: 'SUPERVISOR',
      activo: true,
    });
    const guardado = await prisma.usuario.findUniqueOrThrow({
      where: { email: 'nuevo.e2e@prueba.local' },
    });
    expect(guardado.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    // El usuario nuevo puede iniciar sesión con su contraseña.
    await http()
      .post('/api/auth/login')
      .send({ email: 'nuevo.e2e@prueba.local', password: nuevo.password })
      .expect(200);
  });

  it('409: correo repetido', async () => {
    const respuesta = await comoAdmin(
      http()
        .post('/api/usuarios')
        .send({ ...nuevo, email: 'nuevo.e2e@prueba.local' }),
    ).expect(409);
    expect(respuesta.body).toMatchObject({
      message: 'Ya existe un usuario con el correo nuevo.e2e@prueba.local',
    });
  });

  it('400: contraseña corta y rol desconocido', async () => {
    const respuesta = await comoAdmin(
      http()
        .post('/api/usuarios')
        .send({
          ...nuevo,
          email: 'otro@prueba.local',
          password: '123',
          rol: 'CHOFER',
        }),
    ).expect(400);
    expect(respuesta.body.message).toEqual(
      expect.arrayContaining([
        'password debe tener al menos 8 caracteres',
        'rol debe ser uno de: ADMINISTRADOR, COORDINADOR, SUPERVISOR, OPERADOR',
      ]),
    );
  });

  it('200: listado con filtros por rol y activo, sin password_hash', async () => {
    const respuesta = await comoAdmin(
      http().get('/api/usuarios?rol=SUPERVISOR&activo=true&buscar=e2e'),
    ).expect(200);

    expect(respuesta.body).toMatchObject({ total: 1, pagina: 1, limite: 10 });
    expect(JSON.stringify(respuesta.body)).not.toContain('passwordHash');
  });

  it('403: un COORDINADOR no puede consultar usuarios', () => {
    return http()
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenCoordinador}`)
      .expect(403);
  });

  it('401: sin token', () => {
    return http().get('/api/usuarios').expect(401);
  });

  it('404: usuario inexistente', () => {
    return comoAdmin(
      http().patch('/api/usuarios/9999').send({ nombre: 'X' }),
    ).expect(404);
  });

  it('200: edición de nombre y rol, con el cambio en la bitácora', async () => {
    const id = await idDe('nuevo.e2e@prueba.local');
    const respuesta = await comoAdmin(
      http()
        .patch(`/api/usuarios/${id}`)
        .send({ nombre: 'Usuario E2E editado', rol: 'OPERADOR' }),
    ).expect(200);

    expect(respuesta.body).toMatchObject({
      nombre: 'Usuario E2E editado',
      rol: 'OPERADOR',
    });
    const registro = await prisma.bitacora.findFirst({
      where: {
        entidad: 'usuario',
        entidadId: id,
        accion: { startsWith: 'ACTUALIZAR' },
      },
    });
    expect(registro?.accion).toBe('ACTUALIZAR: rol SUPERVISOR → OPERADOR');
  });

  it('400: el administrador no puede quitarse su rol ni desactivarse', async () => {
    await comoAdmin(
      http().patch(`/api/usuarios/${idAdmin}`).send({ rol: 'COORDINADOR' }),
    ).expect(400);
    const respuesta = await comoAdmin(
      http().patch(`/api/usuarios/${idAdmin}/desactivar`),
    ).expect(400);
    expect(respuesta.body).toMatchObject({
      message: 'No puedes desactivar tu propio usuario',
    });
  });

  it('200: cambio de contraseña (la anterior deja de servir)', async () => {
    const id = await idDe('nuevo.e2e@prueba.local');
    await comoAdmin(
      http()
        .patch(`/api/usuarios/${id}/password`)
        .send({ password: 'Clave-nueva-e2e' }),
    ).expect(200);

    await http()
      .post('/api/auth/login')
      .send({ email: 'nuevo.e2e@prueba.local', password: nuevo.password })
      .expect(401);
    await http()
      .post('/api/auth/login')
      .send({ email: 'nuevo.e2e@prueba.local', password: 'Clave-nueva-e2e' })
      .expect(200);
  });

  it('200: desactivar impide el login y reactivar lo devuelve', async () => {
    const id = await idDe('nuevo.e2e@prueba.local');
    const login = () =>
      http()
        .post('/api/auth/login')
        .send({ email: 'nuevo.e2e@prueba.local', password: 'Clave-nueva-e2e' });

    await comoAdmin(http().patch(`/api/usuarios/${id}/desactivar`))
      .expect(200)
      .expect((r) => expect(r.body).toMatchObject({ activo: false }));
    await login().expect(401);

    await comoAdmin(http().patch(`/api/usuarios/${id}/reactivar`))
      .expect(200)
      .expect((r) => expect(r.body).toMatchObject({ activo: true }));
    await login().expect(200);

    const acciones = await prisma.bitacora.findMany({
      where: { entidad: 'usuario', entidadId: id },
      select: { accion: true },
    });
    expect(acciones.map((a) => a.accion)).toEqual(
      expect.arrayContaining([
        'CREAR',
        'CAMBIAR_PASSWORD',
        'DESACTIVAR',
        'REACTIVAR',
      ]),
    );
  });
});
