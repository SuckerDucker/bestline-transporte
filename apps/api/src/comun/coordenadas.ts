import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

/**
 * Latitud y longitud validadas (Decimal(9,6) en la base de datos).
 * Se reutilizan en zonas y hoteles.
 */
export class CoordenadasDto {
  @ApiProperty({ example: 21.1335, minimum: -90, maximum: 90 })
  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: 'latitud debe ser un número con máximo 6 decimales' },
  )
  @Min(-90, { message: 'latitud debe estar entre -90 y 90' })
  @Max(90, { message: 'latitud debe estar entre -90 y 90' })
  latitud: number;

  @ApiProperty({ example: -86.7465, minimum: -180, maximum: 180 })
  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: 'longitud debe ser un número con máximo 6 decimales' },
  )
  @Min(-180, { message: 'longitud debe estar entre -180 y 180' })
  @Max(180, { message: 'longitud debe estar entre -180 y 180' })
  longitud: number;
}

/**
 * Prisma devuelve las columnas Decimal como objetos Decimal, que en JSON se
 * vuelven texto ("21.1335"). Se convierten a número para el frontend y el mapa.
 */
export function conCoordenadasNumericas<
  T extends { latitud: unknown; longitud: unknown },
>(
  registro: T,
): Omit<T, 'latitud' | 'longitud'> & { latitud: number; longitud: number } {
  return {
    ...registro,
    latitud: Number(registro.latitud),
    longitud: Number(registro.longitud),
  };
}
