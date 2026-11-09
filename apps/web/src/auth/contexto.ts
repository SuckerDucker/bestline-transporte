import { createContext, useContext } from 'react'
import type { RespuestaLogin, Usuario } from './tipos'

export interface ValorAuth {
  usuario: Usuario | null
  iniciarSesion: (respuesta: RespuestaLogin) => void
  cerrarSesion: () => void
}

export const AuthContext = createContext<ValorAuth | null>(null)

/** Acceso a la sesión desde cualquier componente dentro de AuthProvider. */
export function useAuth(): ValorAuth {
  const valor = useContext(AuthContext)
  if (!valor) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return valor
}

/** Solo el ADMINISTRADOR puede escribir en los catálogos (igual que en la API). */
export function usePuedeEscribir(): boolean {
  return useAuth().usuario?.rol === 'ADMINISTRADOR'
}
