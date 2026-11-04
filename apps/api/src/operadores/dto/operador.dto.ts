import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  aBooleano,
  ConsultaPaginadaDto,
  recortar,
} from '../../comun/paginacion.js';

export class CrearOperadorDto {
  @ApiProperty({ example: 'Operador Ejemplo 11', maxLength: 150 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'nombre no debe estar vacío' })
  @MaxLength(150)
  nombre: string;

  @ApiProperty({ example: 'LIC-EJEMPLO-11', maxLength: 30 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'licencia no debe estar vacía' })
  @MaxLength(30)
  licencia: string;

  @ApiProperty({ example: '998-000-0011', maxLength: 20 })
  @Transform(recortar)
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, {
    message:
      'telefono solo admite dígitos, espacios, +, - y paréntesis (7 a 20)',
  })
  telefono: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean({ message: 'disponible debe ser true o false' })
  disponible?: boolean;
}

/** En la edición todos los campos son opcionales. */
export class ActualizarOperadorDto extends PartialType(CrearOperadorDto) {}

export class ConsultaOperadoresDto extends ConsultaPaginadaDto {
  @ApiPropertyOptional({
    description: 'Filtrar por disponibilidad',
    example: true,
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'disponible debe ser true o false' })
  disponible?: boolean;
}
