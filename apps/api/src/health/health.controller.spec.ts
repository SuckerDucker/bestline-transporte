import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = modulo.get<HealthController>(HealthController);
  });

  it('responde { status: "ok" }', () => {
    expect(controller.verificar()).toEqual({ status: 'ok' });
  });
});
