import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Parámetros comunes de listado: búsqueda de texto y paginación. */
export class ConsultaPaginadaDto {
  @ApiPropertyOptional({ description: 'Texto a buscar', example: '' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  buscar?: string;

  @ApiPropertyOptional({
    description: 'Número de página (desde 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pagina debe ser un número entero' })
  @Min(1, { message: 'pagina debe ser mayor o igual a 1' })
  pagina: number = 1;

  @ApiPropertyOptional({
    description: 'Registros por página',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limite debe ser un número entero' })
  @Min(1, { message: 'limite debe ser mayor o igual a 1' })
  @Max(100, { message: 'limite no puede ser mayor a 100' })
  limite: number = 10;
}

/** Respuesta paginada de los listados. */
export interface Paginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}

/** Calcula skip/take de Prisma a partir de la página y el límite. */
export function rango(consulta: ConsultaPaginadaDto) {
  return {
    skip: (consulta.pagina - 1) * consulta.limite,
    take: consulta.limite,
  };
}

/**
 * Convierte "true"/"false" de la URL a booleano. Cualquier otro valor se deja
 * igual para que @IsBoolean responda 400.
 */
export const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Quita espacios al inicio y al final de los textos. */
export const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
