import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Rango de días (incluidos los dos extremos) de los indicadores. */
export class RangoDto {
  @ApiProperty({
    example: '2026-11-05',
    description: 'Primer día (AAAA-MM-DD)',
  })
  @Matches(FECHA, { message: 'desde debe tener el formato AAAA-MM-DD' })
  desde: string;

  @ApiProperty({
    example: '2026-11-10',
    description: 'Último día (AAAA-MM-DD)',
  })
  @Matches(FECHA, { message: 'hasta debe tener el formato AAAA-MM-DD' })
  hasta: string;
}
