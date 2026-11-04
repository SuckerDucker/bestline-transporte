// Configuración de Jest para las pruebas e2e (*.e2e-spec.ts) con Supertest.
// Reutiliza la configuración unitaria y cambia la carpeta, el patrón y la base:
// - globalSetup: crea y migra la base de pruebas (DATABASE_URL_TEST) una vez.
// - setupFiles: hace que la API use esa base en lugar de la de desarrollo.
// Se ejecuta con --runInBand (ver package.json) porque todas las suites
// comparten la misma base de pruebas.
import base from '../jest.config.js';

/** @type {import('jest').Config} */
const config = {
  ...base,
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  resolver: '<rootDir>/../jest.resolver.cjs',
  globalSetup: '<rootDir>/preparar-base-e2e.js',
  setupFiles: ['<rootDir>/entorno-e2e.js'],
};

export default config;
