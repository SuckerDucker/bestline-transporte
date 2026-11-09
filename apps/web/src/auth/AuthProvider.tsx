import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { pedir, registrarManejador401 } from '../api/cliente'
import { AuthContext, type ValorAuth } from './contexto'
import { borrarSesion, guardarSesion, leerSesion, type Sesion } from './sesion'
import type { RespuestaLogin, Usuario } from './tipos'

/** Mantiene la sesión (token y usuario) disponible para toda la aplicación. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  const queryClient = useQueryClient()

  const cerrarSesion = useCallback(() => {
    borrarSesion()
    setSesion(null)
    queryClient.clear()
  }, [queryClient])

  // Si cualquier petición autenticada recibe 401 (token vencido o usuario
  // desactivado), se cierra la sesión y las rutas protegidas mandan al login.
  useEffect(() => {
    registrarManejador401(cerrarSesion)
  }, [cerrarSesion])

  // Con una sesión guardada, se confirma con GET /auth/me y se toman de ahí los
  // datos actuales del usuario (por ejemplo, si cambió su rol).
  const token = sesion?.token
  const perfil = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: async () => {
      const usuario = await pedir<Usuario>('/auth/me')
      if (token) guardarSesion({ token, usuario })
      return usuario
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const iniciarSesion = useCallback((respuesta: RespuestaLogin) => {
    const nueva = { token: respuesta.accessToken, usuario: respuesta.usuario }
    guardarSesion(nueva)
    setSesion(nueva)
  }, [])

  const usuario = sesion ? (perfil.data ?? sesion.usuario) : null
  const valor = useMemo<ValorAuth>(
    () => ({ usuario, iniciarSesion, cerrarSesion }),
    [usuario, iniciarSesion, cerrarSesion],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
