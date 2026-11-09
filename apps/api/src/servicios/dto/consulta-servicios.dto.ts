import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';
import {
  EstadoServicio,
  ModalidadServicio,
  TipoServicio,
} from '../../generated/prisma/client.js';
import { ConsultaPaginadaDto } from '../../comun/paginacion.js';

const entero = (campo: string) => ({
  message: `${campo} debe ser un número entero`,
});

/** Filtros de GET /servicios. */
export class ConsultaServiciosDto extends ConsultaPaginadaDto {
  @ApiPropertyOptional({
    description: 'Día de operación en hora de Cancún (AAAA-MM-DD)',
    example: '2026-11-05',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener el formato AAAA-MM-DD',
  })
  @IsISO8601({ strict: true }, { message: 'fecha no es una fecha válida' })
  fecha?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt(entero('mayoristaId'))
  @Min(1)
  mayoristaId?: number;

  @ApiPropertyOptional({ enum: TipoServicio })
  @IsOptional()
  @IsEnum(TipoServicio, {
    message: `tipo debe ser uno de: ${Object.values(TipoServicio).join(', ')}`,
  })
  tipo?: TipoServicio;

  @ApiPropertyOptional({ enum: ModalidadServicio })
  @IsOptional()
  @IsEnum(ModalidadServicio, {
    message: `modalidad debe ser una de: ${Object.values(ModalidadServicio).join(', ')}`,
  })
  modalidad?: ModalidadServicio;

  @ApiPropertyOptional({
    description: 'Zona de origen o de destino',
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt(entero('zonaId'))
  @Min(1)
  zonaId?: number;

  @ApiPropertyOptional({ enum: EstadoServicio })
  @IsOptional()
  @IsEnum(EstadoServicio, {
    message: `estado debe ser uno de: ${Object.values(EstadoServicio).join(', ')}`,
  })
  estado?: EstadoServicio;

  @ApiPropertyOptional({
    description: 'Servicios de una importación',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt(entero('importacionId'))
  @Min(1)
  importacionId?: number;
}
