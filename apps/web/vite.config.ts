import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Puerto fijo: es el único origen permitido por CORS en la API.
    port: 5173,
    strictPort: true,
  },
})
