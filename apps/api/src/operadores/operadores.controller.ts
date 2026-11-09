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
  ApiError404,
  ApiErroresEscritura,
} from '../comun/swagger.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  ActualizarOperadorDto,
  ConsultaOperadoresDto,
  CrearOperadorDto,
} from './dto/operador.dto.js';
import { OperadoresService } from './operadores.service.js';

const EJEMPLO = {
  id: 11,
  nombre: 'Operador Ejemplo 11',
  licencia: 'LIC-EJEMPLO-11',
  telefono: '998-000-0011',
  disponible: true,
};

@ApiTags('operadores')
@ApiBearerAuth()
@Controller('operadores')
export class OperadoresController {
  constructor(private readonly servicio: OperadoresService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar operadores',
    description:
      'Búsqueda por nombre, licencia o teléfono, filtro por disponibilidad, con paginación. Cualquier rol autenticado.',
  })
  @ApiOkResponse({
    description: 'Página de operadores',
    schema: { example: { datos: [EJEMPLO], total: 1, pagina: 1, limite: 10 } },
  })
  @ApiError400('disponible debe ser true o false')
  @ApiError401()
  listar(@Query() consulta: ConsultaOperadoresDto) {
    return this.servicio.listar(consulta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un operador' })
  @ApiOkResponse({ description: 'Operador', schema: { example: EJEMPLO } })
  @ApiError400('Validation failed (numeric string is expected)')
  @ApiError401()
  @ApiError404('No existe el operador 99')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Dar de alta un operador',
    description: 'Solo ADMINISTRADOR. Se registra en la bitácora.',
  })
  @ApiBody({
    type: CrearOperadorDto,
    examples: {
      operador: {
        summary: 'Operador nuevo',
        value: {
          nombre: 'Operador Ejemplo 11',
          licencia: 'LIC-EJEMPLO-11',
          telefono: '998-000-0011',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Operador creado',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura('nombre no debe estar vacío')
  crear(
    @Body() dto: CrearOperadorDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.crear(dto, usuario.id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Editar un operador',
    description: 'Solo ADMINISTRADOR. Se registra en la bitácora.',
  })
  @ApiBody({
    type: ActualizarOperadorDto,
    examples: {
      telefono: {
        summary: 'Cambiar teléfono',
        value: { telefono: '998-111-2233' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Operador actualizado',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura(
    'telefono solo admite dígitos, espacios, +, - y paréntesis (7 a 20)',
  )
  @ApiError404('No existe el operador 99')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarOperadorDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.actualizar(id, dto, usuario.id);
  }

  @Patch(':id/desactivar')
  @HttpCode(200)
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Desactivar un operador',
    description:
      'Solo ADMINISTRADOR. Deja disponible = false (no se borra). Se registra en la bitácora.',
  })
  @ApiOkResponse({
    description: 'Operador desactivado',
    schema: { example: { ...EJEMPLO, disponible: false } },
  })
  @ApiErroresEscritura('Validation failed (numeric string is expected)')
  @ApiError404('No existe el operador 99')
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.desactivar(id, usuario.id);
  }
}
