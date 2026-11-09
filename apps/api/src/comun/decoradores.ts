import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { RolUsuario } from '../generated/prisma/client.js';
import type { PeticionAutenticada, UsuarioAutenticado } from '../auth/tipos.js';

export const ES_PUBLICA = 'esPublica';
export const ROLES_PERMITIDOS = 'rolesPermitidos';

/** Marca una ruta como pública: el guard JWT global no pide token. */
export const Public = () => SetMetadata(ES_PUBLICA, true);

/** Restringe una ruta a los roles indicados (lo revisa RolesGuard). */
export const Roles = (...roles: RolUsuario[]) =>
  SetMetadata(ROLES_PERMITIDOS, roles);

/** Inyecta en el controlador el usuario autenticado (id y rol del JWT). */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const peticion = contexto.switchToHttp().getRequest<PeticionAutenticada>();
    return peticion.usuario as UsuarioAutenticado;
  },
);
