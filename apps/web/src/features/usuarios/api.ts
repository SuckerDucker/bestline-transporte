import { useMutation } from '@tanstack/react-query'
import { pedir } from '@/api/cliente'
import type { Rol } from '@/auth/tipos'
import { useInvalidar } from '../catalogos/api'

/** Usuario como lo devuelve la API (nunca incluye la contraseña). */
export interface UsuarioAdmin {
  id: number
  nombre: string
  email: string
  rol: Rol
  activo: boolean
}

/** PATCH /usuarios/:id/password */
export function useCambiarPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      pedir<UsuarioAdmin>(`/usuarios/${id}/password`, { metodo: 'PATCH', cuerpo: { password } }),
  })
}

/** PATCH /usuarios/:id/desactivar o /reactivar */
export function useCambiarActivo() {
  const invalidar = useInvalidar('usuarios')
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      pedir<UsuarioAdmin>(`/usuarios/${id}/${activo ? 'reactivar' : 'desactivar'}`, { metodo: 'PATCH' }),
    onSuccess: invalidar,
  })
}
