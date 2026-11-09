import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext } from '@/auth/contexto'
import type { Rol, Usuario } from '@/auth/tipos'

/** Usuario de prueba con el rol indicado. */
export const usuarioDePrueba = (rol: Rol): Usuario => ({
  id: 1,
  nombre: `Usuario ${rol}`,
  email: `${rol.toLowerCase()}@prueba.local`,
  rol,
})

/**
 * Renderiza un componente con lo que necesita la aplicación: TanStack Query
 * (sin reintentos), React Router en memoria y una sesión simulada.
 */
export function renderizar(ui: ReactNode, { usuario = null as Usuario | null, ruta = '/' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const sesion = { usuario, iniciarSesion: vi.fn(), cerrarSesion: vi.fn() }
  return {
    sesion,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={sesion}>
          <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    ),
  }
}
