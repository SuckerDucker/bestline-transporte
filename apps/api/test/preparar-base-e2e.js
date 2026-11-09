// Se ejecuta una sola vez antes de todas las pruebas e2e (globalSetup de Jest).
// Crea la base de pruebas si no existe y le aplica las migraciones.
import 'dotenv/config';
import { execSync } from 'node:child_process';

export default function prepararBaseE2e() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('Falta DATABASE_URL_TEST en apps/api/.env (ver .env.example)');
  }
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
