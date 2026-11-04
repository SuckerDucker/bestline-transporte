import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolUsuario } from '../../generated/prisma/client.js';
import { ROLES_PERMITIDOS } from '../../comun/decoradores.js';
import type { PeticionAutenticada } from '../tipos.js';

/**
 * Guard global que se ejecuta después de JwtAuthGuard. Si la ruta tiene
 * @Roles(...), solo deja pasar a usuarios con alguno de esos roles (si no, 403).
 * Las rutas sin @Roles quedan abiertas a cualquier usuario autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(
      ROLES_PERMITIDOS,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const { usuario } = contexto
      .switchToHttp()
      .getRequest<PeticionAutenticada>();
    if (!usuario || !roles.includes(usuario.rol)) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción',
      );
    }
    return true;
  }
}
