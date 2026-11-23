import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/configurar-app.js';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduloPrueba: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduloPrueba.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  it('GET /api/health responde { status: "ok" }', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /api/docs-json publica el documento OpenAPI', () => {
    return request(app.getHttpServer()).get('/api/docs-json').expect(200);
  });

  it('GET /api/salud es pública y comprueba la base de datos', () => {
    return request(app.getHttpServer())
      .get('/api/salud')
      .expect(200)
      .expect({ status: 'ok', baseDatos: 'ok' });
  });

  afterEach(async () => {
    await app.close();
  });
});

describe('Swagger apagado (SWAGGER_HABILITADO=false)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.SWAGGER_HABILITADO = 'false';
    const moduloPrueba = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduloPrueba.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.SWAGGER_HABILITADO;
    await app.close();
  });

  it('no publica la página ni el documento, y la API sigue respondiendo', async () => {
    const servidor = app.getHttpServer();
    await request(servidor).get('/api/docs').expect(404);
    await request(servidor).get('/api/docs-json').expect(404);
    await request(servidor).get('/api/health').expect(200);
  });
});
