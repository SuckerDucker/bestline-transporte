import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/client.js';
import { Roles } from '../comun/decoradores.js';
import { ApiError400, ApiError401, ApiError403 } from '../comun/swagger.js';
import { BitacoraService } from './bitacora.service.js';
import { ConsultaBitacoraDto } from './dto/consulta-bitacora.dto.js';

/** Consulta de la bitácora (CU-04, RF-03). Solo ADMINISTRADOR. */
@ApiTags('bitacora')
@ApiBearerAuth()
@Roles(RolUsuario.ADMINISTRADOR)
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly servicio: BitacoraService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar la bitácora',
    description:
      'Filtros por usuario, rango de fechas (días de Cancún, ambos incluidos), acción y entidad. Del más reciente al más antiguo, con paginación. Solo ADMINISTRADOR.',
  })
  @ApiOkResponse({
    description: 'Página de registros',
    schema: {
      example: {
        datos: [
          {
            id: 42,
            fecha: '2026-11-08T15:04:05.000Z',
            accion: 'ACTUALIZAR: 9.5 → 10',
            entidad: 'parametro_operacion',
            entidadId: 3,
            usuario: {
              id: 1,
              nombre: 'Administrador',
              email: 'admin@bestline.local',
            },
          },
        ],
        total: 1,
        pagina: 1,
        limite: 10,
      },
    },
  })
  @ApiError400(
    'desde debe tener el formato AAAA-MM-DD',
    'La fecha "desde" no puede ser posterior a "hasta"',
  )
  @ApiError401()
  @ApiError403()
  listar(@Query() consulta: ConsultaBitacoraDto) {
    return this.servicio.listar(consulta);
  }
}
