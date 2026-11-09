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
  vehiculoId: 3,
  horaCita: '04:15',
  vehiculo: {
    id: 3,
    numeroEconomico: 'BL-03',
    tipo: 'Van',
    capacidad: 14,
    estado: 'DISPONIBLE',
  },
};
const ERROR_VEHICULO = 'No existe el vehículo 99';
const ERROR_HORA = 'horaCita debe tener el formato HH:mm (00:00 a 23:59)';
const FUERA_DE_BLOQUE =
  'La hora de cita 06:30 no está en ningún bloque: matutino 04:00-05:00 o vespertino 12:00-13:00';
const VEHICULO_OCUPADO = 'El vehículo BL-03 ya tiene un operador asignado';

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
          vehiculoId: 3,
          horaCita: '04:15',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Operador creado',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura(
    'nombre no debe estar vacío',
    ERROR_VEHICULO,
    ERROR_HORA,
    FUERA_DE_BLOQUE,
  )
  @ApiError409(VEHICULO_OCUPADO)
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
      unidad: {
        summary: 'Asignar vehículo y hora de cita',
        value: { vehiculoId: 3, horaCita: '04:30' },
      },
      sinUnidad: {
        summary: 'Quitar el vehículo (no participa en el rol)',
        value: { vehiculoId: null },
      },
    },
  })
  @ApiOkResponse({
    description: 'Operador actualizado',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura(
    'telefono solo admite dígitos, espacios, +, - y paréntesis (7 a 20)',
    ERROR_VEHICULO,
    ERROR_HORA,
    FUERA_DE_BLOQUE,
  )
  @ApiError404('No existe el operador 99')
  @ApiError409(VEHICULO_OCUPADO)
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
