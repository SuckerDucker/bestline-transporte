import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
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
import { VehiculoDestinoDto } from './dto/vehiculo-destino.dto.js';
import { RevisionService } from './revision.service.js';
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
  constructor(
    private readonly servicio: RolesService,
    private readonly revision: RevisionService,
  ) {}

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
      'ADMINISTRADOR, COORDINADOR y SUPERVISOR. Estado y autorización del rol; cada unidad que participa (también las que no tienen servicios) con tipo, capacidad, operador, hora de cita y fin de jornada; sus asignaciones por inicio efectivo con el traslado en vacío previo (vacio), y los no cubiertos con su motivo.',
  })
  @ApiOkResponse({
    description: 'Rol con sus unidades',
    schema: {
      example: {
        id: 1,
        fecha: '2026-11-10',
        estado: 'PROPUESTO',
        autorizadoPor: null,
        autorizadoEn: null,
        autorizador: null,
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
            disponible: true,
            encierro: { id: 3, nombre: 'Centro Cancún' },
            cita: '2026-11-10T09:00:00.000Z',
            finJornada: '2026-11-10T18:30:00.000Z',
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
                vacio: {
                  minutos: 30,
                  desde: '2026-11-10T09:00:00.000Z',
                  hasta: '2026-11-10T09:30:00.000Z',
                },
              },
            ],
          },
        ],
        noCubiertos: [
          {
            id: 1,
            rolId: 1,
            servicioId: 40,
            motivo: 'CAPACIDAD',
            servicio: { ...SERVICIO_EJEMPLO, id: 40, pasajeros: 32 },
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

  @Get(':fecha/servicios/:servicioId/opciones')
  @Roles(...ROLES_CONSULTAR)
  @ApiParam(FECHA)
  @ApiParam({
    name: 'servicioId',
    example: 31,
    description: 'Id del servicio (asignado o no cubierto)',
  })
  @ApiOperation({
    summary: 'Unidades que aceptan un servicio (selector "Mover a…")',
    description:
      'ADMINISTRADOR, COORDINADOR y SUPERVISOR. Para cada unidad dice si aceptaría el servicio en su posición cronológica, revalidando con las mismas funciones del motor la secuencia completa de esa unidad y la de la unidad de origen. Si no, da el motivo (EMPALME, CAPACIDAD, JORNADA, ZONA_TERMINO o DISPONIBILIDAD) y el detalle. Primero las válidas.',
  })
  @ApiOkResponse({
    description: 'Opciones por unidad',
    schema: {
      example: [
        {
          vehiculoId: 5,
          numeroEconomico: 'BL-05',
          capacidad: 20,
          actual: false,
          valido: true,
          posicion: 3,
        },
        {
          vehiculoId: 3,
          numeroEconomico: 'BL-03',
          capacidad: 14,
          actual: false,
          valido: false,
          motivo: 'EMPALME',
          detalle: 'Empalma con el servicio NEX-0024 de 14:40 en BL-03',
        },
        {
          vehiculoId: 2,
          numeroEconomico: 'BL-02',
          capacidad: 14,
          actual: true,
          valido: false,
          detalle: 'Es la unidad actual del servicio',
        },
      ],
    },
  })
  @ApiError400('fecha debe tener el formato AAAA-MM-DD')
  @ApiError404('El servicio 999 no es del rol del 2026-11-10')
  opciones(
    @Param('fecha', ParseFechaPipe) fecha: string,
    @Param('servicioId', ParseIntPipe) servicioId: number,
  ) {
    return this.revision.opciones(fecha, servicioId);
  }

  @Patch(':fecha/asignaciones/:id')
  @Roles(...ROLES_GENERAR)
  @ApiParam(FECHA)
  @ApiParam({ name: 'id', example: 12, description: 'Id de la asignación' })
  @ApiOperation({
    summary: 'Mover un servicio a otra unidad',
    description:
      'ADMINISTRADOR y COORDINADOR. Con la fila del rol bloqueada (SELECT … FOR UPDATE) y los datos recién leídos, inserta el servicio en la posición cronológica de la unidad destino y revalida con las funciones del motor la secuencia COMPLETA del destino y la que le queda al origen (su nuevo último servicio debe cerrar bien el día). Si pasa, guarda en una transacción y lo registra en la bitácora; si no, 400 con motivo y detalle. Con el rol AUTORIZADO responde 409.',
  })
  @ApiBody({
    type: VehiculoDestinoDto,
    examples: { mover: { summary: 'Mover a BL-05', value: { vehiculoId: 5 } } },
  })
  @ApiOkResponse({
    description: 'Servicio movido',
    schema: {
      example: {
        asignacion: {
          id: 12,
          rolId: 1,
          servicioId: 35,
          vehiculoId: 5,
          operadorId: 5,
          orden: 3,
        },
        de: 'BL-10',
        a: 'BL-05',
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'La revalidación no pasa (motivo ∈ EMPALME, CAPACIDAD, JORNADA, ZONA_TERMINO, DISPONIBILIDAD) o el servicio ya está en esa unidad',
    schema: {
      example: {
        message: 'Empalma con el servicio NEX-0024 de 14:40 en BL-03',
        motivo: 'EMPALME',
        detalle: 'Empalma con el servicio NEX-0024 de 14:40 en BL-03',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiError404('La asignación 999 no es del rol del 2026-11-10')
  @ApiError409(
    'El rol del 2026-11-10 ya está AUTORIZADO; no se puede modificar',
  )
  mover(
    @Param('fecha', ParseFechaPipe) fecha: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VehiculoDestinoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.revision.mover(fecha, id, dto.vehiculoId, usuario.id);
  }

  @Post(':fecha/no-cubiertos/:servicioId/asignar')
  @HttpCode(200)
  @Roles(...ROLES_GENERAR)
  @ApiParam(FECHA)
  @ApiParam({
    name: 'servicioId',
    example: 31,
    description: 'Id del servicio no cubierto',
  })
  @ApiOperation({
    summary: 'Asignar un servicio no cubierto a una unidad',
    description:
      'ADMINISTRADOR y COORDINADOR. Misma revalidación que mover (con la fila del rol bloqueada). Si pasa, en una transacción crea la asignación, lo quita de los no cubiertos y lo registra en la bitácora. Con el rol AUTORIZADO responde 409.',
  })
  @ApiBody({
    type: VehiculoDestinoDto,
    examples: {
      asignar: { summary: 'Asignar a BL-10', value: { vehiculoId: 10 } },
    },
  })
  @ApiOkResponse({
    description: 'Servicio asignado',
    schema: {
      example: {
        asignacion: {
          id: 61,
          rolId: 1,
          servicioId: 31,
          vehiculoId: 10,
          operadorId: 10,
          orden: 2,
        },
        a: 'BL-10',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'La revalidación no pasa',
    schema: {
      example: {
        message: 'NEX-0031 lleva 30 pasajeros y BL-05 tiene capacidad para 20',
        motivo: 'CAPACIDAD',
        detalle: 'NEX-0031 lleva 30 pasajeros y BL-05 tiene capacidad para 20',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiError404(
    'El servicio 999 no está en los no cubiertos del rol del 2026-11-10',
  )
  @ApiError409(
    'El rol del 2026-11-10 ya está AUTORIZADO; no se puede modificar',
  )
  asignar(
    @Param('fecha', ParseFechaPipe) fecha: string,
    @Param('servicioId', ParseIntPipe) servicioId: number,
    @Body() dto: VehiculoDestinoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.revision.asignarNoCubierto(
      fecha,
      servicioId,
      dto.vehiculoId,
      usuario.id,
    );
  }

  @Post(':fecha/autorizar')
  @HttpCode(200)
  @Roles(...ROLES_GENERAR)
  @ApiParam(FECHA)
  @ApiOperation({
    summary: 'Autorizar el rol',
    description:
      'ADMINISTRADOR y COORDINADOR. Corre el verificador independiente sobre el rol guardado; si pasa, en una transacción: rol AUTORIZADO con usuario y fecha de autorización, servicios asignados → PROGRAMADO y bitácora. Después, cualquier cambio o regenerar responde 409.',
  })
  @ApiOkResponse({
    description: 'Rol autorizado',
    schema: {
      example: {
        rol: {
          id: 1,
          fecha: '2026-11-10',
          estado: 'AUTORIZADO',
          autorizadoPor: 2,
          autorizadoEn: '2026-11-10T18:30:00.000Z',
          generadoEn: '2026-11-10T17:10:00.000Z',
        },
        programados: 41,
        noCubiertos: 19,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'El rol no pasa el verificador independiente (no debería pasar)',
    schema: {
      example: {
        message: 'El rol no pasa el verificador independiente; no se autorizó',
        violaciones: ['BL-03 / NEX-0024: EMPALME'],
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiError404('No hay rol del 2026-11-10')
  @ApiError409(
    'El rol del 2026-11-10 ya está AUTORIZADO; no se puede modificar',
  )
  autorizar(
    @Param('fecha', ParseFechaPipe) fecha: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.revision.autorizar(fecha, usuario.id);
  }
}
