import type { RolUsuario } from '../generated/prisma/client.js';

/** Contenido (payload) del JWT. `sub` es el id del usuario, como recomienda el estándar. */
export interface PayloadJwt {
  sub: number;
  rol: RolUsuario;
}

/** Usuario autenticado que el guard JWT deja en la petición (`request.usuario`). */
export interface UsuarioAutenticado {
  id: number;
  rol: RolUsuario;
}

/** Petición HTTP con el usuario autenticado. */
export interface PeticionAutenticada {
  headers: Record<string, string | string[] | undefined>;
  usuario?: UsuarioAutenticado;
}
