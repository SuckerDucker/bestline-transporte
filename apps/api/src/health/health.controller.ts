import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../comun/decoradores.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /** Permite comprobar que la API está levantada. */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Verificar que la API responde' })
  @ApiOkResponse({
    description: 'La API responde',
    schema: { example: { status: 'ok' } },
  })
  verificar(): { status: string } {
    return { status: 'ok' };
  }
}
