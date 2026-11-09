import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public, UsuarioActual } from '../comun/decoradores.js';
import { ApiError400, ApiError401 } from '../comun/swagger.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import type { UsuarioAutenticado } from './tipos.js';

const EJEMPLO_USUARIO = {
  id: 1,
  nombre: 'Administrador',
  email: 'admin@bestline.local',
  rol: 'ADMINISTRADOR',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Valida correo y contraseña (bcrypt) y devuelve un JWT con el id y el rol del usuario. Cada inicio de sesión exitoso se registra en la bitácora.',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      administrador: {
        summary: 'Administrador',
        value: { email: 'admin@bestline.local', password: '<contraseña>' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Credenciales correctas',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        usuario: EJEMPLO_USUARIO,
      },
    },
  })
  @ApiError400(
    'email debe ser un correo válido',
    'password no debe estar vacío',
  )
  @ApiError401('Correo o contraseña incorrectos')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Usuario de la sesión',
    description: 'Devuelve los datos del usuario dueño del token.',
  })
  @ApiOkResponse({
    description: 'Usuario autenticado',
    schema: { example: EJEMPLO_USUARIO },
  })
  @ApiError401()
  me(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.auth.perfil(usuario.id);
  }
}
