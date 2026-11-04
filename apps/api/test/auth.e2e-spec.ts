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
  PASSWORD_PRUEBA,
} from './utilidades-e2e.js';

describe('Autenticación (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const EMAIL = 'admin@prueba.local';

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
    await crearUsuario(prisma, EMAIL, RolUsuario.ADMINISTRADOR);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('200: con credenciales correctas devuelve el token y el usuario', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: EMAIL, password: PASSWORD_PRUEBA })
        .expect(200);

      expect(respuesta.body).toEqual({
        accessToken: expect.any(String),
        usuario: {
          id: expect.any(Number),
          nombre: 'Usuario ADMINISTRADOR',
          email: EMAIL,
          rol: 'ADMINISTRADOR',
        },
      });
    });

    it('registra el inicio de sesión en la bitácora', async () => {
      const antes = await prisma.bitacora.count({
        where: { accion: 'INICIO_SESION' },
      });
      await obtenerToken(app, EMAIL);
      const despues = await prisma.bitacora.count({
        where: { accion: 'INICIO_SESION' },
      });
      expect(despues).toBe(antes + 1);
    });

    it('401: con contraseña incorrecta', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: EMAIL, password: 'incorrecta' })
        .expect(401);

      expect(respuesta.body).toMatchObject({
        statusCode: 401,
        message: 'Correo o contraseña incorrectos',
      });
    });

    it('401: con un correo que no existe', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nadie@prueba.local', password: PASSWORD_PRUEBA })
        .expect(401);
    });

    it('400: con un correo inválido', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'no-es-correo', password: 'x' })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('200: con token devuelve el usuario de la sesión', async () => {
      const token = await obtenerToken(app, EMAIL);
      const respuesta = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(respuesta.body).toMatchObject({
        email: EMAIL,
        rol: 'ADMINISTRADOR',
      });
    });

    it('401: sin token', () => {
      return request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('401: con un token alterado', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token.falso.123')
        .expect(401);
    });
  });
});
