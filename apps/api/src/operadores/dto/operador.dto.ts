import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
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

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    description:
      'Vehículo que maneja (un vehículo solo puede tener un operador). null = sin vehículo: no participa en el rol',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'vehiculoId debe ser un número entero' })
  @Min(1, { message: 'vehiculoId debe ser mayor o igual a 1' })
  vehiculoId?: number | null;

  @ApiPropertyOptional({
    example: '04:30',
    nullable: true,
    description:
      'Hora de cita HH:mm (America/Cancun), dentro del bloque matutino o vespertino de Parámetros. null = sin cita: no participa en el rol',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaCita debe tener el formato HH:mm (00:00 a 23:59)',
  })
  horaCita?: string | null;
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
