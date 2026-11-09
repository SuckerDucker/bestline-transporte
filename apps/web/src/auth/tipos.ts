export const ROLES = ['ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR', 'OPERADOR'] as const
export type Rol = (typeof ROLES)[number]

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: Rol
}

export interface RespuestaLogin {
  accessToken: string
  usuario: Usuario
}

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  COORDINADOR: 'Coordinador',
  SUPERVISOR: 'Supervisor',
  OPERADOR: 'Operador',
}
