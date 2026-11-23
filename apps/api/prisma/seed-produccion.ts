/**
 * Punto de entrada del seed de producción. Lo ejecuta el contenedor de la API
 * después de `prisma migrate deploy`; los valores vienen de .env.production.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { sembrarProduccion } from './sembrar-produccion.js';

const { DATABASE_URL, ADMIN_NOMBRE, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Faltan DATABASE_URL, ADMIN_EMAIL o ADMIN_PASSWORD');
}
if (ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD.length > 72) {
  throw new Error('ADMIN_PASSWORD debe tener de 12 a 72 caracteres');
}

// Igual que en la API: la sesión con PostgreSQL trabaja en UTC.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
    options: '-c timezone=UTC',
  }),
});

try {
  const cargo = await sembrarProduccion(prisma, {
    nombre: ADMIN_NOMBRE || 'Administrador',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  console.log(
    cargo
      ? 'Seed de producción: catálogos y administrador cargados.'
      : 'Seed de producción: la base ya estaba inicializada, no se cambió nada.',
  );
} finally {
  await prisma.$disconnect();
}
