import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { Roles, UsuarioActual } from '../comun/decoradores.js';
import { ParseFechaPipe } from '../comun/fecha.pipe.js';
import {
  ApiError400,
  ApiError401,
  ApiError403,
  ApiError404,
} from '../comun/swagger.js';
import { ExportarDto } from './dto/exportar.dto.js';
import { ExportacionService } from './exportacion.service.js';

const CSV_EJEMPLO =
  'fecha,unidad,tipo_unidad,operador,cita,orden,folio,tipo,modalidad,presentarse,hora,libre,origen,destino,hotel,pasajeros,vuelo,estado\r\n' +
  '2026-11-10,BL-01,Van,José Hernández,04:00,1,TUI-0016,TRASLADO,GRUPO,04:55,05:25,06:50,Zona Hotelera,Playa del Carmen,Hyatt Ziva Cancun,10,,PROGRAMADO';

@ApiTags('roles')
@ApiBearerAuth()
@ApiError401()
@Controller('roles')
export class ExportacionController {
  constructor(private readonly exportacion: ExportacionService) {}

  @Get(':fecha/exportar')
  @Roles(
    RolUsuario.ADMINISTRADOR,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.OPERADOR,
  )
  @ApiOperation({
    summary: 'Exportar el rol del día (CSV o PDF)',
    description:
      'Rol por operador (operadorId) o de todos: unidad, operador, hora de cita y servicios en orden con horas (presentarse, hora del servicio y libre), origen, destino, hotel, pasajeros y vuelo. El PDF es carta horizontal, con la fecha y el nombre del sistema en el encabezado. El OPERADOR solo exporta su propio rol y solo si está AUTORIZADO.',
  })
  @ApiParam({
    name: 'fecha',
    example: '2026-11-10',
    description: 'Día de operación (AAAA-MM-DD)',
  })
  @ApiProduces('text/csv', 'application/pdf')
  @ApiOkResponse({
    description:
      'Archivo adjunto (Content-Disposition: attachment; filename="rol-2026-11-10.csv")',
    content: {
      'text/csv': { example: CSV_EJEMPLO },
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiError400(
    'formato debe ser csv o pdf',
    'fecha debe tener el formato AAAA-MM-DD',
  )
  @ApiError403()
  @ApiError404('No hay rol del 2026-11-10')
  async exportar(
    @Param('fecha', ParseFechaPipe) fecha: string,
    @Query() dto: ExportarDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<StreamableFile> {
    const archivo = await this.exportacion.exportar(fecha, dto, usuario);
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipo,
      disposition: `attachment; filename="${archivo.nombre}"`,
      length: archivo.contenido.length,
    });
  }
}
