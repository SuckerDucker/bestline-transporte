import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ConsultaPaginadaDto } from '../../comun/paginacion.js';

/** Campos de texto del formulario multipart (además del archivo). */
export class ArchivoImportacionDto {
  @ApiProperty({
    example: 2,
    description: 'Mayorista con el que se registra la importación',
  })
  @Type(() => Number)
  @IsInt({ message: 'mayoristaId debe ser un número entero' })
  @Min(1, { message: 'mayoristaId debe ser mayor o igual a 1' })
  mayoristaId: number;
}

/** Esquema de Swagger del formulario multipart. */
export const ESQUEMA_ARCHIVO = {
  type: 'object',
  required: ['archivo', 'mayoristaId'],
  properties: {
    archivo: {
      type: 'string',
      format: 'binary',
      description:
        'Layout de servicios en .xlsx o .csv (máximo 5 MB). Ejemplo: docs/ejemplos/Layout_Servicios_Nexus.xlsx',
    },
    mayoristaId: { type: 'integer', example: 2 },
  },
};

export class ConsultaImportacionesDto extends ConsultaPaginadaDto {
  @ApiPropertyOptional({ description: 'Filtrar por mayorista', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'mayoristaId debe ser un número entero' })
  @Min(1)
  mayoristaId?: number;
}
