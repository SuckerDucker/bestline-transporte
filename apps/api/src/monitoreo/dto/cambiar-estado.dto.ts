import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { EstadoServicio } from '../../generated/prisma/client.js';
import { ESTADOS_DESTINO } from '../transiciones.js';

/** Nuevo estado de un servicio y una nota opcional para la bitácora. */
export class CambiarEstadoDto {
  @ApiProperty({ enum: ESTADOS_DESTINO, example: 'EN_RUTA' })
  @IsIn(ESTADOS_DESTINO, {
    message: `estado debe ser uno de: ${ESTADOS_DESTINO.join(', ')}`,
  })
  estado: EstadoServicio;

  @ApiPropertyOptional({
    example: 'Sale del encierro con 10 min de retraso',
    maxLength: 150,
  })
  @IsOptional()
  @IsString({ message: 'nota debe ser texto' })
  @MaxLength(150, { message: 'nota debe tener como máximo 150 caracteres' })
  nota?: string;
}
