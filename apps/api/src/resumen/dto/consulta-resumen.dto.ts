import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';

export class ConsultaResumenDto {
  @ApiPropertyOptional({
    description:
      'Día de operación (AAAA-MM-DD, hora de Cancún). Si se omite, se usa el próximo día con servicios a partir de hoy.',
    example: '2026-11-10',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener el formato AAAA-MM-DD',
  })
  @IsISO8601({ strict: true }, { message: 'fecha no es una fecha válida' })
  fecha?: string;
}
