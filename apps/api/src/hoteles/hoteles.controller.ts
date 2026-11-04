import {
  Body,
  Controller,
  Delete,
  Get,
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
  ActualizarHotelDto,
  ConsultaHotelesDto,
  CrearHotelDto,
} from './dto/hotel.dto.js';
import { HotelesService } from './hoteles.service.js';

const EJEMPLO = {
  id: 9,
  nombre: 'Hotel Ejemplo ZH 3',
  zonaId: 2,
  latitud: 21.1201,
  longitud: -86.7531,
  zona: { id: 2, nombre: 'Zona Hotelera' },
};

@ApiTags('hoteles')
@ApiBearerAuth()
@Controller('hoteles')
export class HotelesController {
  constructor(private readonly servicio: HotelesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar hoteles',
    description:
      'Búsqueda por nombre, filtro por zona, con paginación. Incluye la zona de cada hotel. Cualquier rol autenticado.',
  })
  @ApiOkResponse({
    description: 'Página de hoteles',
    schema: { example: { datos: [EJEMPLO], total: 1, pagina: 1, limite: 10 } },
  })
  @ApiError400('zonaId debe ser un número entero')
  @ApiError401()
  listar(@Query() consulta: ConsultaHotelesDto) {
    return this.servicio.listar(consulta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un hotel' })
  @ApiOkResponse({ description: 'Hotel', schema: { example: EJEMPLO } })
  @ApiError400('Validation failed (numeric string is expected)')
  @ApiError401()
  @ApiError404('No existe el hotel 99')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Dar de alta un hotel',
    description:
      'Solo ADMINISTRADOR. La zona debe existir. Se registra en la bitácora.',
  })
  @ApiBody({
    type: CrearHotelDto,
    examples: {
      hotel: {
        summary: 'Hotel nuevo en Zona Hotelera',
        value: {
          nombre: 'Hotel Ejemplo ZH 3',
          zonaId: 2,
          latitud: 21.1201,
          longitud: -86.7531,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Hotel creado',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura('La zona 99 no existe')
  crear(
    @Body() dto: CrearHotelDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.crear(dto, usuario.id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Editar un hotel',
    description: 'Solo ADMINISTRADOR. Se registra en la bitácora.',
  })
  @ApiBody({
    type: ActualizarHotelDto,
    examples: {
      nombre: {
        summary: 'Cambiar nombre',
        value: { nombre: 'Hotel Ejemplo ZH 3B' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Hotel actualizado',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura('La zona 99 no existe')
  @ApiError404('No existe el hotel 99')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarHotelDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.actualizar(id, dto, usuario.id);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Eliminar un hotel',
    description:
      'Solo ADMINISTRADOR. Los hoteles no tienen columna "activo": se eliminan solo si ningún servicio los referencia; si no, responde 409. Se registra en la bitácora.',
  })
  @ApiOkResponse({
    description: 'Hotel eliminado',
    schema: { example: { id: 9 } },
  })
  @ApiErroresEscritura('Validation failed (numeric string is expected)')
  @ApiError404('No existe el hotel 99')
  @ApiError409(
    'No se puede eliminar el hotel "Hotel Ejemplo ZH 1": está referenciado por 7 servicio(s)',
  )
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.eliminar(id, usuario.id);
  }
}
