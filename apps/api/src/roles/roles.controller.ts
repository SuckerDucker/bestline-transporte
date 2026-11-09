import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/client.js';
import { Roles, UsuarioActual } from '../comun/decoradores.js';
import { ParseFechaPipe } from '../comun/fecha.pipe.js';
import {
  ApiError400,
  ApiError401,
  ApiError403,
  ApiError404,
  ApiError409,
} from '../comun/swagger.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { GenerarRolDto } from './dto/generar-rol.dto.js';
import { RolesService } from './roles.service.js';

const ROLES_GENERAR = [RolUsuario.ADMINISTRADOR, RolUsuario.COORDINADOR];
const ROLES_CONSULTAR = [...ROLES_GENERAR, RolUsuario.SUPERVISOR];
const FECHA = {
  name: 'fecha',
  example: '2026-11-10',
  description: 'Día de operación (AAAA-MM-DD)',
};

const SERVICIO_EJEMPLO = {
  id: 12,
  folio: 'NEX-0012',
  localizador: 'LOC-EJ-0012',
  tipo: 'LLEGADA',
  modalidad: 'PRIVADO',
  fechaHora: '2026-11-10T13:15:00.000Z',
  pasajeros: 4,
  vuelo: 'EJ482',
  estado: 'PENDIENTE',
  zonaOrigen: { id: 1, nombre: 'Aeropuerto CUN' },
  zonaDestino: { id: 2, nombre: 'Zona Hotelera' },
  hotel: { id: 1, nombre: 'Hotel Ejemplo ZH 1' },
  mayorista: { id: 2, nombre: 'Nexus Tours' },
};

/** Motor de asignación: generación y consulta del rol diario (CU-13, CU-14). */
@ApiTags('roles')
@ApiBearerAuth()
@ApiError401()
@ApiError403()
@Controller('roles')
export class RolesController {
  constructor(private readonly servicio: RolesService) {}

  @Post('generar')
  @Roles(...ROLES_GENERAR)
  @ApiOperation({
    summary: 'Generar el rol del día (motor de asignación)',
    description:
      'ADMINISTRADOR y COORDINADOR. Toma los servicios PENDIENTE de la fecha, ejecuta el motor y guarda en UNA transacción el rol (PROPUESTO), las asignaciones (orden, inicio efectivo y liberación) y los no cubiertos con su motivo, más el registro en la bitácora con el tiempo de generación. Si ya hay un rol PROPUESTO de esa fecha lo reemplaza; si está AUTORIZADO responde 409. Los servicios siguen en PENDIENTE.',
  })
  @ApiBody({
    type: GenerarRolDto,
    examples: {
      seed: { summary: 'Día del seed', value: { fecha: '2026-11-10' } },
      ejemplo: {
        summary: 'Día del archivo de ejemplo',
        value: { fecha: '2026-11-05' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Rol generado y guardado',
    schema: {
      example: {
        rol: {
          id: 1,
          fecha: '2026-11-10',
          estado: 'PROPUESTO',
          autorizadoPor: null,
          generadoEn: '2026-11-09T22:10:00.000Z',
        },
        reemplazado: false,
        resumen: {
          servicios: 60,
          asignados: 41,
          noCubiertos: 19,
          unidadesDisponibles: 9,
          unidadesUsadas: 9,
          tiempoMs: 35,
          porMotivo: {
            CAPACIDAD: 6,
            EMPALME: 4,
            JORNADA: 7,
            ZONA_TERMINO: 2,
            SIN_UNIDAD: 0,
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Fecha inválida, sin servicios PENDIENTE, falta un parámetro, el encierro de una unidad no es una zona o la matriz de tiempos está incompleta',
    schema: {
      example: {
        message: 'No hay servicios PENDIENTE el 2026-12-25',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiError409(
    'El rol del 2026-11-10 ya está AUTORIZADO; no se puede volver a generar',
  )
  generar(
    @Body() dto: GenerarRolDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.generar(dto.fecha, usuario.id);
  }

  @Get(':fecha')
  @Roles(...ROLES_CONSULTAR)
  @ApiParam(FECHA)
  @ApiOperation({
    summary: 'Consultar el rol de una fecha',
    description:
      'ADMINISTRADOR, COORDINADOR y SUPERVISOR. Asignaciones agrupadas por unidad (vehículo y operador), en orden, con su inicio efectivo y liberación.',
  })
  @ApiOkResponse({
    description: 'Rol con sus unidades',
    schema: {
      example: {
        id: 1,
        fecha: '2026-11-10',
        estado: 'PROPUESTO',
        autorizadoPor: null,
        generadoEn: '2026-11-09T22:10:00.000Z',
        resumen: {
          servicios: 60,
          asignados: 41,
          noCubiertos: 19,
          unidadesUsadas: 9,
        },
        unidades: [
          {
            vehiculo: {
              id: 1,
              numeroEconomico: 'BL-01',
              tipo: 'Van',
              capacidad: 14,
            },
            operador: {
              id: 1,
              nombre: 'Operador Ejemplo 01',
              horaCita: '04:00',
            },
            asignaciones: [
              {
                id: 1,
                rolId: 1,
                servicioId: 12,
                vehiculoId: 1,
                operadorId: 1,
                orden: 1,
                inicioEfectivo: '2026-11-10T13:05:00.000Z',
                liberacion: '2026-11-10T13:40:00.000Z',
                servicio: SERVICIO_EJEMPLO,
              },
            ],
          },
        ],
      },
    },
  })
  @ApiError400('fecha debe tener el formato AAAA-MM-DD')
  @ApiError404('No hay rol del 2026-11-10')
  obtener(@Param('fecha', ParseFechaPipe) fecha: string) {
    return this.servicio.obtener(fecha);
  }

  @Get(':fecha/no-cubiertos')
  @Roles(...ROLES_CONSULTAR)
  @ApiParam(FECHA)
  @ApiOperation({
    summary: 'Servicios no cubiertos del rol (CU-14)',
    description:
      'ADMINISTRADOR, COORDINADOR y SUPERVISOR. Cada servicio con el motivo: CAPACIDAD, EMPALME, JORNADA, ZONA_TERMINO o SIN_UNIDAD. Ordenados por hora.',
  })
  @ApiOkResponse({
    description: 'No cubiertos',
    schema: {
      example: [
        {
          id: 1,
          rolId: 1,
          servicioId: 40,
          motivo: 'CAPACIDAD',
          servicio: {
            ...SERVICIO_EJEMPLO,
            id: 40,
            pasajeros: 32,
            modalidad: 'GRUPO',
          },
        },
      ],
    },
  })
  @ApiError400('fecha debe tener el formato AAAA-MM-DD')
  @ApiError404('No hay rol del 2026-11-10')
  noCubiertos(@Param('fecha', ParseFechaPipe) fecha: string) {
    return this.servicio.noCubiertos(fecha);
  }
}
