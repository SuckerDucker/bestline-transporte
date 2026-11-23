import { ServiceUnavailableException } from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { SaludController } from './salud.controller.js';

describe('SaludController', () => {
  let prisma: PrismaSimulado;
  let controlador: SaludController;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    controlador = new SaludController(comoPrisma(prisma));
  });

  it('responde ok cuando la base de datos contesta', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controlador.verificar()).resolves.toEqual({
      status: 'ok',
      baseDatos: 'ok',
    });
  });

  it('responde 503 sin exponer el error de la conexión', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('detalle interno de la BD'));
    const promesa = controlador.verificar();
    await expect(promesa).rejects.toThrow(ServiceUnavailableException);
    await expect(promesa).rejects.toThrow('La base de datos no responde');
  });
});
