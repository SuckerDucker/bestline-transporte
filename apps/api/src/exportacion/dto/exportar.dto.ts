import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const FORMATOS = ['csv', 'pdf'] as const;
export type Formato = (typeof FORMATOS)[number];

/** Formato del archivo y, opcionalmente, un solo operador. */
export class ExportarDto {
  @ApiProperty({ enum: FORMATOS, example: 'pdf' })
  @IsIn(FORMATOS, { message: 'formato debe ser csv o pdf' })
  formato: Formato;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Solo el rol de este operador. Sin él, todos. El OPERADOR solo puede pedir el suyo (si lo omite, se usa el suyo).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'operadorId debe ser un número entero' })
  @Min(1, { message: 'operadorId debe ser mayor que 0' })
  operadorId?: number;
}
