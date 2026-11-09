import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { recortar } from '../../comun/paginacion.js';

export class ValorParametroDto {
  @ApiProperty({ example: 'jornada_maxima_horas', maxLength: 100 })
  @IsString()
  @IsNotEmpty({ message: 'clave no debe estar vacía' })
  @MaxLength(100)
  clave: string;

  // Las reglas de cada clave (HH:mm, horas o minutos) se revisan en el
  // servicio para poder responder qué clave falló.
  @ApiProperty({ example: '10', maxLength: 100 })
  @Transform(recortar)
  @IsString({ message: 'valor debe ser texto' })
  @MaxLength(100)
  valor: string;
}

export class ActualizarParametrosDto {
  @ApiProperty({ type: [ValorParametroDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'parametros debe tener al menos un elemento' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ValorParametroDto)
  parametros: ValorParametroDto[];
}
