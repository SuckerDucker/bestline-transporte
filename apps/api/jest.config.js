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
  // Cobertura: solo código con lógica propia. Se excluyen el cliente generado
  // por Prisma, el arranque (main.ts), los módulos de Nest (solo declaran
  // piezas), los DTO (solo decoradores de validación) y las ayudas de prueba.
  collectCoverageFrom: [
    '**/*.ts',
    '!generated/**',
    '!main.ts',
    '!**/*.module.ts',
    '!**/dto/**',
    '!**/pruebas/**',
    '!**/*.spec.ts',
  ],
  coverageDirectory: '../coverage',
};

export default config;
