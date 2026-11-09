import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/client.js';
import { Roles, UsuarioActual } from '../comun/decoradores.js';
import { ApiError401, ApiError403, ApiError404 } from '../comun/swagger.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { ActualizarParametrosDto } from './dto/parametros.dto.js';
import { ParametrosService } from './parametros.service.js';

const EJEMPLO = [
  {
    id: 6,
    clave: 'anticipacion.COMPARTIDO',
    valor: '20',
    descripcion: 'Minutos de anticipación para servicios COMPARTIDO',
  },
  {
    id: 1,
    clave: 'hora_cita.turno_1',
    valor: '04:00',
    descripcion: 'Hora de cita del turno 1 (HH:mm, America/Cancun)',
  },
  {
    id: 3,
    clave: 'jornada_maxima_horas',
    valor: '9.5',
    descripcion: 'Jornada máxima en horas desde la hora de cita',
  },
];

/** Parámetros de operación (CU-08, RF-07). */
@ApiTags('parametros')
@ApiBearerAuth()
@ApiError401()
@Controller('parametros')
export class ParametrosController {
  constructor(private readonly servicio: ParametrosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar los parámetros de operación',
    description: 'Cualquier rol autenticado. Ordenados por clave.',
  })
  @ApiOkResponse({ description: 'Parámetros', schema: { example: EJEMPLO } })
  listar() {
    return this.servicio.listar();
  }

  @Put()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Editar parámetros de operación',
    description:
      'Solo ADMINISTRADOR. Guarda todos en una sola transacción (si uno es inválido no se guarda ninguno). Reglas: hora_cita.* en HH:mm; jornada_maxima_horas entre 1 y 12; anticipacion.* en minutos enteros de 0 a 120. Cada cambio queda en la bitácora con el valor anterior y el nuevo. Devuelve la lista completa.',
  })
  @ApiBody({
    type: ActualizarParametrosDto,
    examples: {
      valido: {
        summary: 'Cambios válidos',
        value: {
          parametros: [
            { clave: 'jornada_maxima_horas', valor: '10' },
            { clave: 'hora_cita.turno_1', valor: '04:30' },
          ],
        },
      },
      invalido: {
        summary: 'Valores inválidos (400)',
        value: {
          parametros: [
            { clave: 'jornada_maxima_horas', valor: '15' },
            { clave: 'hora_cita.turno_1', valor: '4:30' },
          ],
        },
      },
      inexistente: {
        summary: 'Clave inexistente (404)',
        value: { parametros: [{ clave: 'hora_cita.turno_9', valor: '06:00' }] },
      },
    },
  })
  @ApiOkResponse({
    description: 'Parámetros actualizados',
    schema: { example: EJEMPLO },
  })
  @ApiBadRequestResponse({
    description: 'Algún valor no cumple su regla; "errores" indica la clave',
    schema: {
      example: {
        message: [
          'jornada_maxima_horas debe ser un número de horas entre 1 y 12',
          'hora_cita.turno_1 debe tener el formato HH:mm (00:00 a 23:59)',
        ],
        errores: [
          {
            clave: 'jornada_maxima_horas',
            mensaje: 'debe ser un número de horas entre 1 y 12',
          },
          {
            clave: 'hora_cita.turno_1',
            mensaje: 'debe tener el formato HH:mm (00:00 a 23:59)',
          },
        ],
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiError403()
  @ApiError404('No existe el parámetro: hora_cita.turno_9')
  actualizar(
    @Body() dto: ActualizarParametrosDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.actualizar(dto.parametros, usuario.id);
  }
}
