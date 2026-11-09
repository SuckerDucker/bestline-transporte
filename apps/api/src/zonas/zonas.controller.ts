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
  ActualizarZonaDto,
  ConsultaZonasDto,
  CrearZonaDto,
  MarcarZonaTerminoDto,
} from './dto/zona.dto.js';
import { ZonasService } from './zonas.service.js';

const EJEMPLO = {
  id: 9,
  nombre: 'Isla Mujeres',
  latitud: 21.2311,
  longitud: -86.731,
  esZonaTermino: false,
};

@ApiTags('zonas')
@ApiBearerAuth()
@Controller('zonas')
export class ZonasController {
  constructor(private readonly servicio: ZonasService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar zonas',
    description:
      'Búsqueda por nombre, filtro por zona de término, con paginación. Cualquier rol autenticado.',
  })
  @ApiOkResponse({
    description: 'Página de zonas',
    schema: { example: { datos: [EJEMPLO], total: 1, pagina: 1, limite: 10 } },
  })
  @ApiError400('esZonaTermino debe ser true o false')
  @ApiError401()
  listar(@Query() consulta: ConsultaZonasDto) {
    return this.servicio.listar(consulta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una zona' })
  @ApiOkResponse({ description: 'Zona', schema: { example: EJEMPLO } })
  @ApiError400('Validation failed (numeric string is expected)')
  @ApiError401()
  @ApiError404('No existe la zona 99')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Dar de alta una zona',
    description: 'Solo ADMINISTRADOR. Se registra en la bitácora.',
  })
  @ApiBody({
    type: CrearZonaDto,
    examples: {
      zona: {
        summary: 'Zona nueva',
        value: {
          nombre: 'Isla Mujeres',
          latitud: 21.2311,
          longitud: -86.731,
          esZonaTermino: false,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Zona creada',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura('latitud debe estar entre -90 y 90')
  @ApiError409('Ya existe una zona con el nombre "Isla Mujeres"')
  crear(
    @Body() dto: CrearZonaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.crear(dto, usuario.id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Editar una zona',
    description: 'Solo ADMINISTRADOR. Se registra en la bitácora.',
  })
  @ApiBody({
    type: ActualizarZonaDto,
    examples: {
      termino: {
        summary: 'Marcar como zona de término',
        value: { esZonaTermino: true },
      },
    },
  })
  @ApiOkResponse({
    description: 'Zona actualizada',
    schema: { example: EJEMPLO },
  })
  @ApiErroresEscritura(
    'esZonaTermino debe ser true o false',
    'Debe existir al menos una zona de término',
  )
  @ApiError404('No existe la zona 99')
  @ApiError409('Ya existe una zona con el nombre "Isla Mujeres"')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarZonaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.actualizar(id, dto, usuario.id);
  }

  @Patch(':id/zona-termino')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Marcar o desmarcar una zona de término',
    description:
      'Solo ADMINISTRADOR. Indica si una unidad puede terminar su jornada en esta zona (regla del motor). Debe quedar al menos una zona de término: desmarcar la última responde 400. El cambio queda en la bitácora ("ACTUALIZAR: es_zona_termino false → true").',
  })
  @ApiBody({
    type: MarcarZonaTerminoDto,
    examples: {
      marcar: { summary: 'Marcar', value: { esZonaTermino: true } },
      desmarcar: { summary: 'Desmarcar', value: { esZonaTermino: false } },
    },
  })
  @ApiOkResponse({
    description: 'Zona actualizada',
    schema: { example: { ...EJEMPLO, esZonaTermino: true } },
  })
  @ApiErroresEscritura(
    'esZonaTermino debe ser true o false',
    'Debe existir al menos una zona de término',
  )
  @ApiError404('No existe la zona 99')
  marcarZonaTermino(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarcarZonaTerminoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.marcarZonaTermino(id, dto.esZonaTermino, usuario.id);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Eliminar una zona',
    description:
      'Solo ADMINISTRADOR. Las zonas no tienen columna "activo": se eliminan solo si no las referencian hoteles, tiempos de traslado ni servicios; si no, responde 409. Se registra en la bitácora.',
  })
  @ApiOkResponse({
    description: 'Zona eliminada',
    schema: { example: { id: 9 } },
  })
  @ApiErroresEscritura(
    'Validation failed (numeric string is expected)',
    'Debe existir al menos una zona de término',
  )
  @ApiError404('No existe la zona 99')
  @ApiError409(
    'No se puede eliminar la zona "Tulum": está referenciada por 1 hotel(es), 16 tiempo(s) de traslado y 6 servicio(s)',
  )
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.eliminar(id, usuario.id);
  }
}
