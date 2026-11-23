import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { sembrarProduccion } from '../prisma/sembrar-produccion.js';
import { crearApp, limpiarBase } from './utilidades-e2e.js';

const ADMIN = {
  nombre: 'Administración',
  email: 'Admin@Produccion.Local',
  password: 'contraseña-de-prueba-1',
};

describe('Seed de producción (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    await limpiarBase(prisma);
  });

  afterAll(async () => {
    await limpiarBase(prisma);
    await app.close();
  });

  it('con la base vacía carga los catálogos y un solo administrador', async () => {
    await expect(
      sembrarProduccion(prisma as unknown as PrismaClient, ADMIN),
    ).resolves.toBe(true);

    const usuarios = await prisma.usuario.findMany();
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0]).toMatchObject({
      email: 'admin@produccion.local',
      rol: 'ADMINISTRADOR',
      activo: true,
    });
    await expect(
      bcrypt.compare(ADMIN.password, usuarios[0].passwordHash),
    ).resolves.toBe(true);

    expect(await prisma.zona.count()).toBe(8);
    expect(await prisma.tiempoTraslado.count()).toBe(64);
    expect(await prisma.hotel.count()).toBe(16);
    expect(await prisma.mayorista.count()).toBe(2);
    expect(await prisma.vehiculo.count()).toBe(10);
    expect(await prisma.vehiculo.count({ where: { capacidad: 14 } })).toBe(4);
    expect(await prisma.vehiculo.count({ where: { capacidad: 20 } })).toBe(5);
    expect(await prisma.vehiculo.count({ where: { capacidad: 45 } })).toBe(1);
    expect(
      await prisma.operador.count({
        where: { vehiculoId: { not: null }, horaCita: { not: null } },
      }),
    ).toBe(10);
    expect(await prisma.parametroOperacion.count()).toBe(7);
  });

  it('no crea servicios, importaciones ni roles de ejemplo', async () => {
    expect(await prisma.servicio.count()).toBe(0);
    expect(await prisma.importacion.count()).toBe(0);
    expect(await prisma.rolDiario.count()).toBe(0);
  });

  it('al repetirse no cambia nada: conserva contraseña y catálogos editados', async () => {
    const admin = await prisma.usuario.findFirstOrThrow();
    await prisma.zona.update({
      where: { nombre: 'Tulum' },
      data: { nombre: 'Tulum Centro' },
    });

    await expect(
      sembrarProduccion(prisma as unknown as PrismaClient, {
        ...ADMIN,
        password: 'otra-contraseña-distinta',
      }),
    ).resolves.toBe(false);

    const despues = await prisma.usuario.findFirstOrThrow();
    expect(despues.passwordHash).toBe(admin.passwordHash);
    expect(await prisma.zona.count()).toBe(8);
    expect(await prisma.zona.count({ where: { nombre: 'Tulum' } })).toBe(0);
  });
});
