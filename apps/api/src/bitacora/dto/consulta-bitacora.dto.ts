import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';
import { ACCIONES_BITACORA, ENTIDADES_BITACORA } from '../../comun/bitacora.js';
import { ConsultaPaginadaDto } from '../../comun/paginacion.js';

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros de la bitácora. Las fechas son días completos en hora de Cancún. */
export class ConsultaBitacoraDto extends OmitType(ConsultaPaginadaDto, [
  'buscar',
] as const) {
  @ApiPropertyOptional({
    description: 'Id del usuario que hizo la acción',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'usuarioId debe ser un número entero' })
  @Min(1, { message: 'usuarioId debe ser mayor o igual a 1' })
  usuarioId?: number;

  @ApiPropertyOptional({
    description: 'Desde este día (incluido), AAAA-MM-DD',
    example: '2026-11-01',
  })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'desde debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'desde no es una fecha válida' })
  desde?: string;

  @ApiPropertyOptional({
    description: 'Hasta este día (incluido), AAAA-MM-DD',
    example: '2026-11-30',
  })
  @IsOptional()
  @Matches(FORMATO_FECHA, { message: 'hasta debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'hasta no es una fecha válida' })
  hasta?: string;

  @ApiPropertyOptional({
    enum: ACCIONES_BITACORA,
    description:
      'Acción. También encuentra los registros con detalle (por ejemplo "ACTUALIZAR: 9.5 → 10").',
  })
  @IsOptional()
  @IsIn(ACCIONES_BITACORA, {
    message: `accion debe ser una de: ${ACCIONES_BITACORA.join(', ')}`,
  })
  accion?: string;

  @ApiPropertyOptional({
    enum: ENTIDADES_BITACORA,
    description: 'Entidad afectada',
  })
  @IsOptional()
  @IsIn(ENTIDADES_BITACORA, {
    message: `entidad debe ser una de: ${ENTIDADES_BITACORA.join(', ')}`,
  })
  entidad?: string;
}
