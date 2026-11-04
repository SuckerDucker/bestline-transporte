import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import type { RolUsuario } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const PASSWORD_PRUEBA = 'Clave-de-prueba-1';

/** Levanta la API completa con la misma configuración que main.ts. */
export async function crearApp(): Promise<{
  app: INestApplication<App>;
  prisma: PrismaService;
}> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
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
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE incidencia, servicio_no_cubierto, asignacion, rol_diario,
      servicio, importacion, bitacora, tiempo_traslado, hotel, zona, vehiculo,
      operador, mayorista, parametro_operacion, usuario RESTART IDENTITY CASCADE`,
  );
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
