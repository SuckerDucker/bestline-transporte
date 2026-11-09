import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CoordenadasDto } from '../../comun/coordenadas.js';
import {
  aBooleano,
  ConsultaPaginadaDto,
  recortar,
} from '../../comun/paginacion.js';

class DatosZonaDto {
  @ApiProperty({ example: 'Isla Mujeres', maxLength: 100 })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'nombre no debe estar vacío' })
  @MaxLength(100)
  nombre: string;

  @ApiProperty({
    example: false,
    description: 'Si una unidad puede terminar su jornada en esta zona',
  })
  @IsBoolean({ message: 'esZonaTermino debe ser true o false' })
  esZonaTermino: boolean;
}

export class CrearZonaDto extends IntersectionType(
  DatosZonaDto,
  CoordenadasDto,
) {}

/** En la edición todos los campos son opcionales. */
export class ActualizarZonaDto extends PartialType(CrearZonaDto) {}

export class ConsultaZonasDto extends ConsultaPaginadaDto {
  @ApiPropertyOptional({
    description: 'Filtrar zonas de término',
    example: true,
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'esZonaTermino debe ser true o false' })
  esZonaTermino?: boolean;
}

/** Cuerpo de PATCH /zonas/:id/zona-termino. */
export class MarcarZonaTerminoDto {
  @ApiProperty({
    example: true,
    description: 'true: una unidad puede terminar su jornada en esta zona',
  })
  @IsBoolean({ message: 'esZonaTermino debe ser true o false' })
  esZonaTermino: boolean;
}
