// Configuración de Jest para las pruebas e2e (*.e2e-spec.ts) con Supertest.
// Reutiliza la configuración unitaria y solo cambia la carpeta y el patrón.
import base from '../jest.config.js';

/** @type {import('jest').Config} */
const config = {
  ...base,
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  resolver: '<rootDir>/../jest.resolver.cjs',
};

export default config;
