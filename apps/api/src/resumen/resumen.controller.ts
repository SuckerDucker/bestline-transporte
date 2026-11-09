import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiError400, ApiError401 } from '../comun/swagger.js';
import { ConsultaResumenDto } from './dto/consulta-resumen.dto.js';
import { ResumenService } from './resumen.service.js';

@ApiTags('resumen')
@ApiBearerAuth()
@Controller('resumen')
export class ResumenController {
  constructor(private readonly servicio: ResumenService) {}

  @Get()
  @ApiOperation({
    summary: 'Resumen para la pantalla de inicio',
    description:
      'Solo lectura. Vehículos activos (no dados de baja), operadores disponibles, zonas, hoteles y servicios pendientes de un día de operación. Cualquier rol autenticado.',
  })
  @ApiOkResponse({
    description: 'Conteos del sistema',
    schema: {
      example: {
        vehiculos: { activos: 10, disponibles: 9, enMantenimiento: 1 },
        operadores: { disponibles: 9, total: 10 },
        zonas: { total: 8, deTermino: 2 },
        hoteles: { total: 8 },
        servicios: { fecha: '2026-11-10', pendientes: 60, total: 60 },
      },
    },
  })
  @ApiError400('fecha debe tener el formato AAAA-MM-DD')
  @ApiError401()
  obtener(@Query() consulta: ConsultaResumenDto) {
    return this.servicio.obtener(consulta.fecha);
  }
}
