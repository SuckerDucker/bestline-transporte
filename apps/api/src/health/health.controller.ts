import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /** Permite comprobar que la API está levantada. */
  @Get()
  @ApiOkResponse({
    description: 'La API responde',
    schema: { example: { status: 'ok' } },
  })
  verificar(): { status: string } {
    return { status: 'ok' };
  }
}
