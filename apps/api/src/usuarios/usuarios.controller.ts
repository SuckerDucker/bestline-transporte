import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/client.js';
import { Roles, UsuarioActual } from '../comun/decoradores.js';
import {
  ApiError400,
  ApiError401,
  ApiError403,
  ApiError404,
  ApiError409,
} from '../comun/swagger.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  ActualizarUsuarioDto,
  CambiarPasswordDto,
  ConsultaUsuariosDto,
  CrearUsuarioDto,
} from './dto/usuario.dto.js';
import { UsuariosService } from './usuarios.service.js';

const EJEMPLO = {
  id: 5,
  nombre: 'Coordinadora de turno',
  email: 'turno@bestline.local',
  rol: 'COORDINADOR',
  activo: true,
};

/** Administración de usuarios (CU-03, RF-02). Todo el módulo es solo para ADMINISTRADOR. */
@ApiTags('usuarios')
@ApiBearerAuth()
@Roles(RolUsuario.ADMINISTRADOR)
@ApiError401()
@ApiError403()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly servicio: UsuariosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Búsqueda por nombre o correo, filtros por rol y activo, con paginación. Solo ADMINISTRADOR. Nunca devuelve password_hash.',
  })
  @ApiOkResponse({
    description: 'Página de usuarios',
    schema: { example: { datos: [EJEMPLO], total: 1, pagina: 1, limite: 10 } },
  })
  @ApiError400(
    'rol debe ser uno de: ADMINISTRADOR, COORDINADOR, SUPERVISOR, OPERADOR',
  )
  listar(@Query() consulta: ConsultaUsuariosDto) {
    return this.servicio.listar(consulta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario' })
  @ApiOkResponse({ description: 'Usuario', schema: { example: EJEMPLO } })
  @ApiError400('Validation failed (numeric string is expected)')
  @ApiError404('No existe el usuario 99')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Dar de alta un usuario',
    description:
      'La contraseña se guarda cifrada con bcrypt. El correo se guarda en minúsculas. Se registra en la bitácora.',
  })
  @ApiBody({
    type: CrearUsuarioDto,
    examples: {
      usuario: {
        summary: 'Usuario nuevo',
        value: {
          nombre: 'Coordinadora de turno',
          email: 'turno@bestline.local',
          password: '<contraseña-nueva>',
          rol: 'COORDINADOR',
        },
      },
      passwordCorta: {
        summary: 'Contraseña corta (400)',
        value: {
          nombre: 'Prueba',
          email: 'prueba@bestline.local',
          password: '123',
          rol: 'OPERADOR',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Usuario creado (sin password_hash)',
    schema: { example: EJEMPLO },
  })
  @ApiError400('password debe tener al menos 8 caracteres')
  @ApiError409('Ya existe un usuario con el correo turno@bestline.local')
  crear(
    @Body() dto: CrearUsuarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.crear(dto, usuario.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar nombre y rol',
    description:
      'Un administrador no puede quitarse a sí mismo el rol de ADMINISTRADOR (400). El cambio de rol queda en el texto de la bitácora.',
  })
  @ApiBody({
    type: ActualizarUsuarioDto,
    examples: {
      rol: { summary: 'Cambiar el rol', value: { rol: 'SUPERVISOR' } },
    },
  })
  @ApiOkResponse({
    description: 'Usuario actualizado',
    schema: { example: { ...EJEMPLO, rol: 'SUPERVISOR' } },
  })
  @ApiError400('No puedes quitarte el rol de ADMINISTRADOR a ti mismo')
  @ApiError404('No existe el usuario 99')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.actualizar(id, dto, usuario.id);
  }

  @Patch(':id/password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cambiar la contraseña',
    description:
      'Guarda la nueva contraseña cifrada con bcrypt. Se registra CAMBIAR_PASSWORD en la bitácora (sin la contraseña).',
  })
  @ApiBody({
    type: CambiarPasswordDto,
    examples: {
      password: {
        summary: 'Contraseña nueva',
        value: { password: '<contraseña-nueva>' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Contraseña cambiada',
    schema: { example: EJEMPLO },
  })
  @ApiError400('password debe tener al menos 8 caracteres')
  @ApiError404('No existe el usuario 99')
  cambiarPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarPasswordDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.cambiarPassword(id, dto.password, usuario.id);
  }

  @Patch(':id/desactivar')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Desactivar un usuario',
    description:
      'Deja activo = false: ya no puede iniciar sesión y su token deja de funcionar. Un administrador no puede desactivarse a sí mismo (400).',
  })
  @ApiOkResponse({
    description: 'Usuario desactivado',
    schema: { example: { ...EJEMPLO, activo: false } },
  })
  @ApiError400('No puedes desactivar tu propio usuario')
  @ApiError404('No existe el usuario 99')
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.desactivar(id, usuario.id);
  }

  @Patch(':id/reactivar')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reactivar un usuario',
    description: 'Deja activo = true. Se registra REACTIVAR en la bitácora.',
  })
  @ApiOkResponse({
    description: 'Usuario reactivado',
    schema: { example: EJEMPLO },
  })
  @ApiError400('Validation failed (numeric string is expected)')
  @ApiError404('No existe el usuario 99')
  reactivar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.reactivar(id, usuario.id);
  }
}
