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
import { ConsultaServiciosDto } from './dto/consulta-servicios.dto.js';
import { ServiciosService } from './servicios.service.js';

const EJEMPLO = {
  id: 61,
  mayoristaId: 2,
  importacionId: 1,
  folio: 'NX-15001',
  localizador: 'LOC85001A',
  tipo: 'SALIDA',
  modalidad: 'COMPARTIDO',
  fechaHora: '2026-11-05T11:15:00.000Z',
  pasajeros: 2,
  zonaOrigenId: 4,
  zonaDestinoId: 1,
  hotelId: 9,
  vuelo: 'AM691',
  estado: 'PENDIENTE',
  mayorista: { id: 2, nombre: 'Nexus Tours' },
  zonaOrigen: { id: 4, nombre: 'Costa Mujeres' },
  zonaDestino: { id: 1, nombre: 'Aeropuerto CUN' },
  hotel: { id: 9, nombre: 'Planet Hollywood Cancun' },
};

/** Servicios de transporte (solo lectura). Todos los roles excepto OPERADOR. */
@ApiTags('servicios')
@ApiBearerAuth()
@Roles(RolUsuario.ADMINISTRADOR, RolUsuario.COORDINADOR, RolUsuario.SUPERVISOR)
@Controller('servicios')
export class ServiciosController {
  constructor(private readonly servicio: ServiciosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar servicios',
    description:
      'Filtros por día de operación (hora de Cancún), mayorista, tipo, modalidad, zona (origen o destino), estado e importación; búsqueda por folio, localizador o vuelo. Ordenados por hora, con paginación.',
  })
  @ApiOkResponse({
    description: 'Página de servicios',
    schema: { example: { datos: [EJEMPLO], total: 1, pagina: 1, limite: 10 } },
  })
  @ApiError400(
    'fecha debe tener el formato AAAA-MM-DD',
    'tipo debe ser uno de: LLEGADA, SALIDA, TRASLADO',
  )
  @ApiError401()
  @ApiError403()
  listar(@Query() consulta: ConsultaServiciosDto) {
    return this.servicio.listar(consulta);
  }
}
