import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import type { RolUsuario } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const PASSWORD_PRUEBA = 'Clave-de-prueba-1';

/**
 * Levanta la API completa con la misma configuración que main.ts. Con
 * "personalizar" se reemplazan piezas (p. ej. el cliente de OSRM por uno
 * con fetch simulado) antes de compilar.
 */
export async function crearApp(
  personalizar: (b: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<{
  app: INestApplication<App>;
  prisma: PrismaService;
}> {
  const modulo = await personalizar(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();
  const app = modulo.createNestApplication<INestApplication<App>>();
  configurarApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/**
 * Vacía todas las tablas de la base de pruebas. Por seguridad, se niega a
 * correr si la base no es la de pruebas (su nombre debe terminar en _test).
 */
export async function limpiarBase(prisma: PrismaService): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (!/_test(\?|$)/.test(url)) {
    throw new Error('limpiarBase solo se puede usar con la base de pruebas');
  }
  // Si otra conexión tiene bloqueada una tabla, el TRUNCATE falla a los 10 s
  // con un error claro en lugar de esperar hasta el límite de la prueba.
  // SET LOCAL vale solo dentro de esta transacción (misma conexión).
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL lock_timeout = '10s'`),
    prisma.$executeRawUnsafe(
      `TRUNCATE TABLE incidencia, servicio_no_cubierto, asignacion, rol_diario,
        servicio, importacion, bitacora, tiempo_traslado, hotel, zona, vehiculo,
        operador, mayorista, parametro_operacion, usuario RESTART IDENTITY CASCADE`,
    ),
  ]);
}

/** Crea un usuario con la contraseña de prueba. */
export async function crearUsuario(
  prisma: PrismaService,
  email: string,
  rol: RolUsuario,
) {
  return prisma.usuario.create({
    data: {
      nombre: `Usuario ${rol}`,
      email,
      rol,
      passwordHash: await bcrypt.hash(PASSWORD_PRUEBA, 4),
    },
  });
}

/** Inicia sesión y devuelve el token. */
export async function obtenerToken(
  app: INestApplication<App>,
  email: string,
): Promise<string> {
  const respuesta = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: PASSWORD_PRUEBA })
    .expect(200);
  return (respuesta.body as { accessToken: string }).accessToken;
}
