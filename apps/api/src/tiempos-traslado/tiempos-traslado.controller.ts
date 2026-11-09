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
import { ApiError401, ApiError403 } from '../comun/swagger.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { GuardarMatrizDto } from './dto/matriz.dto.js';
import { TiemposTrasladoService } from './tiempos-traslado.service.js';

const EJEMPLO = {
  zonas: [
    { id: 1, nombre: 'Aeropuerto CUN', esZonaTermino: true },
    { id: 2, nombre: 'Zona Hotelera', esZonaTermino: true },
    { id: 7, nombre: 'Tulum', esZonaTermino: false },
  ],
  matriz: [
    [10, 25, 100],
    [30, 10, null],
    [105, 125, 10],
  ],
  faltantes: [{ zonaOrigenId: 2, zonaDestinoId: 7 }],
  completa: false,
};

/** Matriz de tiempos de traslado entre zonas (CU-09, RF-08). */
@ApiTags('tiempos-traslado')
@ApiBearerAuth()
@ApiError401()
@Controller('tiempos-traslado')
export class TiemposTrasladoController {
  constructor(private readonly servicio: TiemposTrasladoService) {}

  @Get('matriz')
  @ApiOperation({
    summary: 'Consultar la matriz de tiempos',
    description:
      'Cualquier rol autenticado. Devuelve las zonas (ordenadas por id), la matriz origen × destino en minutos (null = falta) y la lista de combinaciones faltantes. La matriz es por sentido: A → B puede ser distinto de B → A.',
  })
  @ApiOkResponse({
    description: 'Matriz de tiempos',
    schema: { example: EJEMPLO },
  })
  matriz() {
    return this.servicio.matriz();
  }

  @Put('matriz')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary: 'Guardar varios tiempos de traslado',
    description:
      'Solo ADMINISTRADOR. Crea o actualiza las celdas enviadas en una sola transacción: si alguna es inválida no se guarda ninguna. Minutos enteros de 1 a 300. Cada cambio queda en la bitácora. Devuelve la matriz actualizada.',
  })
  @ApiBody({
    type: GuardarMatrizDto,
    examples: {
      valido: {
        summary: 'Dos celdas válidas',
        value: {
          tiempos: [
            { zonaOrigenId: 2, zonaDestinoId: 7, minutos: 120 },
            { zonaOrigenId: 1, zonaDestinoId: 7, minutos: 95 },
          ],
        },
      },
      invalido: {
        summary: 'Minutos fuera de rango (400)',
        value: {
          tiempos: [
            { zonaOrigenId: 2, zonaDestinoId: 7, minutos: 0 },
            { zonaOrigenId: 1, zonaDestinoId: 7, minutos: 301 },
          ],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Matriz actualizada',
    schema: { example: EJEMPLO },
  })
  @ApiBadRequestResponse({
    description: 'Alguna celda es inválida; "errores" indica cuál',
    schema: {
      example: {
        message: [
          'Zona Hotelera → Tulum: los minutos deben ser un número entero de 1 a 300',
        ],
        errores: [
          {
            zonaOrigenId: 2,
            zonaDestinoId: 7,
            mensaje:
              'Zona Hotelera → Tulum: los minutos deben ser un número entero de 1 a 300',
          },
        ],
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiError403()
  guardar(
    @Body() dto: GuardarMatrizDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.guardar(dto.tiempos, usuario.id);
  }
}
