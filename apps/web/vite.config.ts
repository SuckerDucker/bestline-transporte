import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // @/ apunta a src/ (mismo alias que en tsconfig; lo usa shadcn/ui)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // El archivo de librerías pesa ~530 kB (~170 kB comprimido): aceptable para un
    // sistema interno. Se sube el límite del aviso para que el build quede limpio.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Las librerías (React, Radix, TanStack…) van en un archivo aparte:
        // cambian poco y el navegador las guarda en caché entre versiones.
        advancedChunks: {
          groups: [{ name: 'librerias', test: /node_modules/ }],
        },
      },
    },
  },
  server: {
    // Puerto fijo: es el único origen permitido por CORS en la API.
    port: 5173,
    strictPort: true,
  },
})
