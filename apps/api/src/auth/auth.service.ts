import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { RolUsuario } from '../generated/prisma/client.js';
import { registrarBitacora } from '../comun/bitacora.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PayloadJwt } from './tipos.js';

/** Datos públicos del usuario (nunca se devuelve el hash de la contraseña). */
export interface UsuarioPublico {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

export interface RespuestaLogin {
  accessToken: string;
  usuario: UsuarioPublico;
}

// Mismo mensaje para correo inexistente, contraseña incorrecta o usuario
// inactivo: así no se revela qué correos están registrados.
const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<RespuestaLogin> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    const coincide = await bcrypt.compare(password, usuario.passwordHash);
    if (!coincide) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    await registrarBitacora(
      this.prisma,
      usuario.id,
      'INICIO_SESION',
      'usuario',
      usuario.id,
    );

    const payload: PayloadJwt = { sub: usuario.id, rol: usuario.rol };
    return {
      accessToken: await this.jwt.signAsync(payload),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    };
  }

  /** Datos del usuario dueño del token. Si ya no existe o está inactivo: 401. */
  async perfil(id: number): Promise<UsuarioPublico> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('El usuario ya no está activo');
    }
    const { activo: _activo, ...publico } = usuario;
    return publico;
  }
}
