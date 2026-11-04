import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ES_PUBLICA } from '../../comun/decoradores.js';
import type { PayloadJwt, PeticionAutenticada } from '../tipos.js';

/**
 * Guard global: toda ruta exige un JWT válido en `Authorization: Bearer <token>`,
 * salvo las marcadas con @Public(). Si el token es válido, deja el usuario en
 * `request.usuario` para los guards y controladores siguientes.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
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

    try {
      const payload = await this.jwt.verifyAsync<PayloadJwt>(token);
      peticion.usuario = { id: payload.sub, rol: payload.rol };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return true;
  }
}
