import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/client.js';
import { Roles } from '../comun/decoradores.js';
import { ParseFechaPipe } from '../comun/fecha.pipe.js';
import {
  ApiError400,
  ApiError401,
  ApiError403,
  ApiError404,
} from '../comun/swagger.js';
import { RutasService } from './rutas.service.js';

const SERVICIO = {
  id: 12,
  folio: 'NEX-0012',
  tipo: 'LLEGADA',
  modalidad: 'PRIVADO',
  pasajeros: 4,
  origen: 'Aeropuerto CUN',
  destino: 'Hyatt Ziva Cancun',
};

const EJEMPLO = {
  fecha: '2026-11-10',
  estadoRol: 'PROPUESTO',
  vehiculo: { id: 3, numeroEconomico: 'BL-03', tipo: 'Van', capacidad: 14 },
  operador: { id: 3, nombre: 'Luis García', horaCita: '04:30' },
  servicios: 1,
  paradas: [
    {
      orden: 1,
      tipo: 'ENCIERRO_SALIDA',
      nombre: 'Centro Cancún',
      zona: 'Centro Cancún',
      latitud: 21.1619,
      longitud: -86.8515,
      llegada: null,
      salida: '2026-11-10T17:35:00.000Z',
      horaCita: '2026-11-10T09:30:00.000Z',
    },
    {
      orden: 2,
      tipo: 'ORIGEN',
      nombre: 'Aeropuerto CUN',
      zona: 'Aeropuerto CUN',
      latitud: 21.0365,
      longitud: -86.8771,
      llegada: '2026-11-10T18:05:00.000Z',
      salida: '2026-11-10T18:15:00.000Z',
      servicio: SERVICIO,
    },
    {
      orden: 3,
      tipo: 'DESTINO',
      nombre: 'Hyatt Ziva Cancun',
      zona: 'Zona Hotelera',
      latitud: 21.1335,
      longitud: -86.7465,
      llegada: '2026-11-10T18:45:00.000Z',
      salida: '2026-11-10T18:45:00.000Z',
      servicio: SERVICIO,
    },
  ],
  geometria: {
    type: 'LineString',
    coordinates: [
      [-86.8515, 21.1619],
      [-86.8771, 21.0365],
      [-86.7465, 21.1335],
    ],
  },
  distanciaKm: 41.3,
  duracionMin: 48,
  trazado: 'carretera',
};

/** Rutas sugeridas por unidad sobre el mapa. */
@ApiTags('rutas')
@ApiBearerAuth()
@ApiError401()
@ApiError403()
@Controller('roles')
export class RutasController {
  constructor(private readonly servicio: RutasService) {}

  @Get(':fecha/rutas/:vehiculoId')
  @Roles(
    RolUsuario.ADMINISTRADOR,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @ApiParam({
    name: 'fecha',
    example: '2026-11-10',
    description: 'Día de operación (AAAA-MM-DD)',
  })
  @ApiParam({
    name: 'vehiculoId',
    example: 3,
    description: 'Id del vehículo (unidad)',
  })
  @ApiOperation({
    summary: 'Ruta sugerida de una unidad',
    description:
      'ADMINISTRADOR, COORDINADOR y SUPERVISOR. Paradas en orden (salida del encierro, origen y destino de cada servicio y regreso al encierro si el último destino no es zona de término) con las horas del rol: salida del encierro = la mayor entre la hora de cita y (inicio efectivo del primero − traslado al primer origen); origen: llegada en el inicio efectivo y salida a la hora del servicio; destino: liberación. La geometría (GeoJSON LineString, [longitud, latitud]), la distancia y la duración las da OSRM desde la API (5 s de límite, caché en memoria). Si OSRM falla, responde 200 con segmentos rectos entre paradas, trazado "aproximado", distancia en línea recta y duracionMin null.',
  })
  @ApiOkResponse({
    description: 'Ruta de la unidad',
    schema: { example: EJEMPLO },
  })
  @ApiError400('fecha debe tener el formato AAAA-MM-DD')
  @ApiError404('La unidad no tiene servicios en el rol del 2026-11-10')
  obtener(
    @Param('fecha', ParseFechaPipe) fecha: string,
    @Param('vehiculoId', ParseIntPipe) vehiculoId: number,
  ) {
    return this.servicio.obtener(fecha, vehiculoId);
  }
}
