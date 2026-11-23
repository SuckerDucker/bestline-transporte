import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../comun/decoradores.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Salud del despliegue: a diferencia de /api/health (solo dice que el proceso
 * responde), aquí también se comprueba la base de datos. La usa el healthcheck
 * de Docker Compose. No devuelve detalles del error porque es una ruta pública.
 */
@ApiTags('salud')
@Controller('salud')
export class SaludController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Verificar la API y su conexión a la base de datos',
    description:
      'Ruta pública para el healthcheck de Docker Compose. Responde 503 si la base no contesta.',
  })
  @ApiOkResponse({
    description: 'La API y la base de datos responden',
    schema: { example: { status: 'ok', baseDatos: 'ok' } },
  })
  @ApiServiceUnavailableResponse({
    description: 'La base de datos no responde',
    schema: {
      example: {
        statusCode: 503,
        message: 'La base de datos no responde',
        error: 'Service Unavailable',
      },
    },
  })
  async verificar(): Promise<{ status: string; baseDatos: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde');
    }
    return { status: 'ok', baseDatos: 'ok' };
  }
}
