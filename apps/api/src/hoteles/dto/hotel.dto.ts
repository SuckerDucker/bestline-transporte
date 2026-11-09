import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CoordenadasDto } from '../../comun/coordenadas.js';
import { ConsultaPaginadaDto, recortar } from '../../comun/paginacion.js';

class DatosHotelDto {
  @ApiProperty({ example: 'Hotel Ejemplo ZH 3', maxLength: 150 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'nombre no debe estar vacío' })
  @MaxLength(150)
  nombre: string;

  @ApiProperty({ example: 2, description: 'Id de la zona a la que pertenece' })
  @IsInt({ message: 'zonaId debe ser un número entero' })
  @Min(1, { message: 'zonaId debe ser mayor o igual a 1' })
  zonaId: number;
}

export class CrearHotelDto extends IntersectionType(
  DatosHotelDto,
  CoordenadasDto,
) {}

/** En la edición todos los campos son opcionales. */
export class ActualizarHotelDto extends PartialType(CrearHotelDto) {}

export class ConsultaHotelesDto extends ConsultaPaginadaDto {
  @ApiPropertyOptional({ description: 'Filtrar por zona', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'zonaId debe ser un número entero' })
  zonaId?: number;
}
