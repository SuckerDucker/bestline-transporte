// Configuración de Jest para las pruebas unitarias (*.spec.ts dentro de src/).
// La API es un módulo ES ("type": "module"), por eso Jest corre en modo ESM:
// - ts-jest compila TypeScript conservando import/export (useESM).
// - jest.resolver.cjs resuelve los imports relativos con .js al archivo .ts
//   (nodenext exige la extensión .js en el código).
// Se ejecuta con node --experimental-vm-modules (ver scripts de package.json).

/** @type {import('jest').Config} */
const config = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  resolver: '<rootDir>/../jest.resolver.cjs',
  collectCoverageFrom: ['**/*.ts', '!generated/**', '!main.ts'],
  coverageDirectory: '../coverage',
};

export default config;
