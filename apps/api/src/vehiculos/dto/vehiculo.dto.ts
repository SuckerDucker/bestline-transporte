import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstadoVehiculo } from '../../generated/prisma/client.js';
import { ConsultaPaginadaDto, recortar } from '../../comun/paginacion.js';
import { TIPOS_VEHICULO } from '../capacidad.js';

export class CrearVehiculoDto {
  @ApiProperty({ example: 'BL-11', maxLength: 20 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'numeroEconomico no debe estar vacío' })
  @MaxLength(20)
  numeroEconomico: string;

  // El tipo y la capacidad se validan juntos con la regla de capacidad
  // (validarCapacidad), que responde 400 si el tipo no es uno de los permitidos.
  @ApiProperty({ enum: TIPOS_VEHICULO, example: 'Sprinter' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'tipo no debe estar vacío' })
  @MaxLength(50)
  tipo: string;

  @ApiProperty({
    example: 20,
    description: 'Máximo por tipo: Van/Urvan 14, Sprinter 20, Autobús 45',
  })
  @IsInt({ message: 'capacidad debe ser un número entero' })
  capacidad: number;

  @ApiProperty({ example: 'Encierro Centro Cancún', maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'encierroBase no debe estar vacío' })
  @MaxLength(100)
  encierroBase: string;

  @ApiPropertyOptional({
    enum: EstadoVehiculo,
    default: EstadoVehiculo.DISPONIBLE,
  })
  @IsOptional()
  @IsEnum(EstadoVehiculo, {
    message: 'estado debe ser DISPONIBLE, MANTENIMIENTO o BAJA',
  })
  estado?: EstadoVehiculo;
}

/** En la edición todos los campos son opcionales. */
export class ActualizarVehiculoDto extends PartialType(CrearVehiculoDto) {}

export class ConsultaVehiculosDto extends ConsultaPaginadaDto {
  @ApiPropertyOptional({ enum: TIPOS_VEHICULO })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ enum: EstadoVehiculo })
  @IsOptional()
  @IsEnum(EstadoVehiculo, {
    message: 'estado debe ser DISPONIBLE, MANTENIMIENTO o BAJA',
  })
  estado?: EstadoVehiculo;
}
