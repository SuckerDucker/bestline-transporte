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
  ApiError409,
  ApiErroresEscritura,
} from '../comun/swagger.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  ActualizarVehiculoDto,
  ConsultaVehiculosDto,
  CrearVehiculoDto,
} from './dto/vehiculo.dto.js';
import { VehiculosService } from './vehiculos.service.js';

const EJEMPLO = {
  id: 11,
  numeroEconomico: 'BL-11',
  tipo: 'Sprinter',
  capacidad: 20,
  estado: 'DISPONIBLE',
  encierroBase: 'Encierro Centro Cancún',
};
const ERROR_CAPACIDAD =
  'La capacidad de un vehículo Sprinter debe estar entre 1 y 20 pasajeros';

@ApiTags('vehiculos')
@ApiBearerAuth()
@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly servicio: VehiculosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar vehículos',
    description:
      'Búsqueda por número económico o encierro, filtros por tipo y estado, con paginación. Cualquier rol autenticado.',
  })
  @ApiOkResponse({
    description: 'Página de vehículos',
    schema: { example: { datos: [EJEMPLO], total: 1, pagina: 1, limite: 10 } },
  })
  @ApiError400('limite no puede ser mayor a 100')
  @ApiError401()
  listar(@Query() consulta: ConsultaVehiculosDto) {
    return this.servicio.listar(consulta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un vehículo' })
  @ApiOkResponse({ description: 'Vehículo', schema: { example: EJEMPLO } })
  @ApiError400('Validation failed (numeric string is expected)')
  @ApiError401()
  @ApiError404('No existe el vehículo 99')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Dar de alta un vehículo',
    description:
      'Solo ADMINISTRADOR. La capacidad debe corresponder al tipo (Van/Urvan 14, Sprinter 20, Autobús 45). Se registra en la bitácora.',
  })
  @ApiBody({
    type: CrearVehiculoDto,
    examples: {
      sprinter: {
        summary: 'Sprinter de 20 pasajeros',
        value: {
          numeroEconomico: 'BL-11',
          tipo: 'Sprinter',
          capacidad: 20,
          encierroBase: 'Encierro Centro Cancún',
        },
      },
      capacidadInvalida: {
        summary: 'Capacidad mayor al máximo (responde 400)',
        value: {
          numeroEconomico: 'BL-12',
          tipo: 'Sprinter',
          capacidad: 25,
          encierroBase: 'Encierro Centro Cancún',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Vehículo creado',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura(ERROR_CAPACIDAD)
  @ApiError409('Ya existe un vehículo con el número económico BL-11')
  crear(
    @Body() dto: CrearVehiculoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.crear(dto, usuario.id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Editar un vehículo',
    description: 'Solo ADMINISTRADOR. Se registra en la bitácora.',
  })
  @ApiBody({
    type: ActualizarVehiculoDto,
    examples: {
      mantenimiento: {
        summary: 'Mandar a mantenimiento',
        value: { estado: 'MANTENIMIENTO' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Vehículo actualizado',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura(ERROR_CAPACIDAD)
  @ApiError404('No existe el vehículo 99')
  @ApiError409('Ya existe un vehículo con el número económico BL-11')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarVehiculoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.actualizar(id, dto, usuario.id);
  }

  @Patch(':id/desactivar')
  @HttpCode(200)
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Desactivar un vehículo',
    description:
      'Solo ADMINISTRADOR. Cambia el estado a BAJA (no se borra). Se registra en la bitácora.',
  })
  @ApiOkResponse({
    description: 'Vehículo dado de baja',
    schema: { example: { ...EJEMPLO, estado: 'BAJA' } },
  })
  @ApiErroresEscritura('Validation failed (numeric string is expected)')
  @ApiError404('No existe el vehículo 99')
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.desactivar(id, usuario.id);
  }
}
