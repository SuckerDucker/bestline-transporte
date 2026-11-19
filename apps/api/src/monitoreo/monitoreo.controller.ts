import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
  ApiError409,
} from '../comun/swagger.js';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto.js';
import { IncidenciaDto } from './dto/incidencia.dto.js';
import { MonitoreoService } from './monitoreo.service.js';

const ROLES_MONITOREO = [
  RolUsuario.ADMINISTRADOR,
  RolUsuario.COORDINADOR,
  RolUsuario.SUPERVISOR,
];
const FECHA = {
  name: 'fecha',
  example: '2026-11-10',
  description: 'Día de operación (AAAA-MM-DD)',
};
const SERVICIO = {
  name: 'id',
  example: 12,
  description: 'Id del servicio',
};

const SERVICIO_EJEMPLO = {
  id: 12,
  folio: 'NEX-0012',
  localizador: 'LOC-EJ-0012',
  tipo: 'LLEGADA',
  modalidad: 'PRIVADO',
  fechaHora: '2026-11-10T18:15:00.000Z',
  pasajeros: 4,
  vuelo: 'EJ482',
  estado: 'EN_RUTA',
  inicioReal: '2026-11-10T17:52:10.000Z',
  terminoReal: null,
  zonaOrigen: { id: 1, nombre: 'Aeropuerto CUN' },
  zonaDestino: { id: 2, nombre: 'Zona Hotelera' },
  hotel: { id: 1, nombre: 'Hyatt Ziva Cancun' },
  mayorista: { id: 2, nombre: 'Nexus Tours' },
};
const FILA_EJEMPLO = {
  asignacionId: 301,
  orden: 2,
  inicioEfectivo: '2026-11-10T18:05:00.000Z',
  liberacion: '2026-11-10T18:40:00.000Z',
  vehiculo: { id: 6, numeroEconomico: 'BL-06', tipo: 'Sprinter' },
  operador: { id: 6, nombre: 'Ricardo Díaz' },
  servicio: SERVICIO_EJEMPLO,
  incidencias: 1,
  retrasado: false,
};
const TOTALES_EJEMPLO = {
  total: 41,
  retrasados: 3,
  porEstado: {
    PROGRAMADO: 30,
    EN_RUTA: 4,
    EN_SERVICIO: 2,
    COMPLETADO: 4,
    CANCELADO: 0,
    NO_SHOW: 1,
  },
};
const INCIDENCIA_EJEMPLO = {
  id: 7,
  servicioId: 12,
  usuarioId: 5,
  tipo: 'RETRASO',
  descripcion: 'Vuelo demorado 40 minutos; la unidad espera en CUN',
  fecha: '2026-11-10T18:20:00.000Z',
  usuario: { id: 5, nombre: 'Jorge Ramírez' },
};

@ApiTags('Monitoreo')
@ApiBearerAuth()
@ApiError401()
@Controller('monitoreo')
export class MonitoreoController {
  constructor(private readonly monitoreo: MonitoreoService) {}

  @Get(':fecha')
  @Roles(...ROLES_MONITOREO)
  @ApiOperation({
    summary: 'Tablero del día',
    description:
      'Servicios asignados del rol AUTORIZADO con unidad, operador, hora, origen → destino, pasajeros, estado, horas reales e incidencias, y totales por estado. "retrasado": la hora del servicio ya pasó y sigue PROGRAMADO.',
  })
  @ApiParam(FECHA)
  @ApiOkResponse({
    description: 'Tablero',
    schema: {
      example: {
        fecha: '2026-11-10',
        rol: {
          id: 16,
          estado: 'AUTORIZADO',
          autorizadoEn: '2026-11-09T22:10:00.000Z',
        },
        totales: TOTALES_EJEMPLO,
        servicios: [FILA_EJEMPLO],
      },
    },
  })
  @ApiError400('fecha debe tener el formato AAAA-MM-DD')
  @ApiError403()
  @ApiError404('No hay rol autorizado del 2026-11-10')
  tablero(@Param('fecha', ParseFechaPipe) fecha: string) {
    return this.monitoreo.tablero(fecha);
  }

  @Get(':fecha/mis-servicios')
  @Roles(RolUsuario.OPERADOR)
  @ApiOperation({
    summary: 'Mis servicios del día (OPERADOR)',
    description:
      'Servicios del rol AUTORIZADO asignados al operador ligado al usuario de la sesión, en el orden en que los hace.',
  })
  @ApiParam(FECHA)
  @ApiOkResponse({
    description: 'Servicios del operador',
    schema: {
      example: {
        fecha: '2026-11-10',
        operador: { id: 1, nombre: 'José Hernández', horaCita: '04:00' },
        vehiculo: { id: 1, numeroEconomico: 'BL-01', tipo: 'Van' },
        totales: { ...TOTALES_EJEMPLO, total: 4, retrasados: 0 },
        servicios: [FILA_EJEMPLO],
      },
    },
  })
  @ApiError400('fecha debe tener el formato AAAA-MM-DD')
  @ApiError403()
  @ApiError404('No hay rol autorizado del 2026-11-10')
  misServicios(
    @Param('fecha', ParseFechaPipe) fecha: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.monitoreo.misServicios(fecha, usuario);
  }

  @Get(':fecha/incidencias')
  @Roles(...ROLES_MONITOREO)
  @ApiOperation({
    summary: 'Incidencias del día',
    description: 'Las más nuevas primero.',
  })
  @ApiParam(FECHA)
  @ApiOkResponse({
    description: 'Incidencias',
    schema: {
      example: [
        {
          ...INCIDENCIA_EJEMPLO,
          servicio: { id: 12, folio: 'NEX-0012' },
          vehiculo: { id: 6, numeroEconomico: 'BL-06' },
        },
      ],
    },
  })
  @ApiError400('fecha debe tener el formato AAAA-MM-DD')
  @ApiError403()
  @ApiError404('No hay rol autorizado del 2026-11-10')
  incidencias(@Param('fecha', ParseFechaPipe) fecha: string) {
    return this.monitoreo.incidenciasDelDia(fecha);
  }

  @Patch('servicios/:id/estado')
  @Roles(...ROLES_MONITOREO, RolUsuario.OPERADOR)
  @ApiOperation({
    summary: 'Cambiar el estado de un servicio',
    description:
      'PROGRAMADO → EN_RUTA (guarda inicioReal) → EN_SERVICIO → COMPLETADO (guarda terminoReal). CANCELADO y NO_SHOW desde PROGRAMADO, EN_RUTA o EN_SERVICIO, solo ADMINISTRADOR, COORDINADOR y SUPERVISOR. El OPERADOR solo marca EN_RUTA, EN_SERVICIO y COMPLETADO en sus servicios. Registra bitácora con la nota.',
  })
  @ApiParam(SERVICIO)
  @ApiOkResponse({
    description: 'Servicio actualizado',
    schema: { example: SERVICIO_EJEMPLO },
  })
  @ApiError400(
    'No se puede pasar de COMPLETADO a EN_RUTA',
    'El servicio NEX-0012 no está asignado en un rol autorizado',
  )
  @ApiError403()
  @ApiError404('Servicio no encontrado')
  @ApiError409(
    'El servicio cambió de estado mientras tanto; vuelve a cargar el tablero',
  )
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.monitoreo.cambiarEstado(id, dto, usuario);
  }

  @Post('servicios/:id/incidencias')
  @Roles(...ROLES_MONITOREO)
  @ApiOperation({
    summary: 'Registrar una incidencia',
    description:
      'Tipos: RETRASO, FALLA_MECANICA, PASAJERO_NO_SE_PRESENTO, CAMBIO_DE_HORA y OTRO. El servicio conserva su estado. Registra bitácora.',
  })
  @ApiParam(SERVICIO)
  @ApiCreatedResponse({
    description: 'Incidencia registrada',
    schema: { example: INCIDENCIA_EJEMPLO },
  })
  @ApiError400(
    'tipo debe ser uno de: RETRASO, FALLA_MECANICA, PASAJERO_NO_SE_PRESENTO, CAMBIO_DE_HORA, OTRO',
  )
  @ApiError403()
  @ApiError404('Servicio no encontrado')
  registrarIncidencia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IncidenciaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.monitoreo.registrarIncidencia(id, dto, usuario);
  }
}
