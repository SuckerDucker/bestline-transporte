// Configuración de Prisma 7: aquí van la ruta del esquema, la carpeta de
// migraciones, el comando del seed y la URL de conexión (antes iban en schema.prisma
// y en package.json).
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
