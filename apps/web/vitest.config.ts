import { defineConfig, mergeConfig } from 'vitest/config'
import configuracionVite from './vite.config'

// Pruebas del frontend con Vitest y React Testing Library.
// Reutiliza la configuración de Vite (alias @/ y plugin de React).
export default mergeConfig(
  configuracionVite,
  defineConfig({
    test: {
      // jsdom simula el navegador (DOM) dentro de Node.
      environment: 'jsdom',
      setupFiles: ['./src/pruebas/configuracion.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      // Limpia el DOM entre pruebas (render de React Testing Library).
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        reportsDirectory: './coverage',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        // No se mide código que no es propio o que no tiene lógica: los componentes
        // copiados de shadcn/ui, el arranque (main.tsx), los archivos de tipos y
        // las propias pruebas con sus ayudas.
        exclude: [
          'src/components/ui/**',
          'src/main.tsx',
          'src/**/tipos.ts',
          'src/**/*.d.ts',
          'src/pruebas/**',
          'src/**/*.test.{ts,tsx}',
        ],
      },
    },
  }),
)
