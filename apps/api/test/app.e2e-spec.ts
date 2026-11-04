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

  afterEach(async () => {
    await app.close();
  });
});
