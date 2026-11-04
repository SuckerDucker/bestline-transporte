import type { Usuario } from './tipos'

// La sesión se guarda en localStorage para que sobreviva a recargar la página.
// La API vuelve a validar el token (y que el usuario siga activo) en cada
// petición, así que guardar aquí el usuario solo sirve para pintar la interfaz.
const CLAVE_TOKEN = 'bestline.token'
const CLAVE_USUARIO = 'bestline.usuario'

export interface Sesion {
  token: string
  usuario: Usuario
}

export function leerToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN)
}

export function leerSesion(): Sesion | null {
  const token = localStorage.getItem(CLAVE_TOKEN)
  const usuario = localStorage.getItem(CLAVE_USUARIO)
  if (!token || !usuario) return null
  try {
    return { token, usuario: JSON.parse(usuario) as Usuario }
  } catch {
    return null
  }
}

export function guardarSesion(sesion: Sesion) {
  localStorage.setItem(CLAVE_TOKEN, sesion.token)
  localStorage.setItem(CLAVE_USUARIO, JSON.stringify(sesion.usuario))
}

export function borrarSesion() {
  localStorage.removeItem(CLAVE_TOKEN)
  localStorage.removeItem(CLAVE_USUARIO)
}
