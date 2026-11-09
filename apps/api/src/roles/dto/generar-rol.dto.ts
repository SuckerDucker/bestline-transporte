import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches } from 'class-validator';

export class GenerarRolDto {
  @ApiProperty({
    example: '2026-11-10',
    description: 'Día de operación (hora de Cancún), AAAA-MM-DD',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener el formato AAAA-MM-DD',
  })
  @IsISO8601({ strict: true }, { message: 'fecha no es una fecha válida' })
  fecha: string;
}
