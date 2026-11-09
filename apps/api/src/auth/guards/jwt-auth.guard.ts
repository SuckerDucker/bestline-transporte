import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ES_PUBLICA } from '../../comun/decoradores.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PayloadJwt, PeticionAutenticada } from '../tipos.js';

/**
 * Guard global: toda ruta exige un JWT válido en `Authorization: Bearer <token>`,
 * salvo las marcadas con @Public().
 *
 * Además de la firma del token, en cada petición se consulta que el usuario
 * exista y siga activo: así, al desactivar un usuario su token deja de
 * funcionar de inmediato, sin esperar a que expire. El rol se toma de la base
 * de datos (no del token) para que un cambio de rol también aplique al momento.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(ES_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublica) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionAutenticada>();
    const encabezado = peticion.headers['authorization'];
    const [esquema, token] =
      typeof encabezado === 'string' ? encabezado.split(' ') : [];
    if (esquema !== 'Bearer' || !token) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    let payload: PayloadJwt;
    try {
      payload = await this.jwt.verifyAsync<PayloadJwt>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, rol: true, activo: true },
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('El usuario no existe o está inactivo');
    }

    peticion.usuario = { id: usuario.id, rol: usuario.rol };
    return true;
  }
}
