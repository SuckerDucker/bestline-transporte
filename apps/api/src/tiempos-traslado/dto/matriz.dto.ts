import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class TiempoCeldaDto {
  @ApiProperty({ example: 1, description: 'Zona de origen (fila)' })
  @IsInt({ message: 'zonaOrigenId debe ser un número entero' })
  @Min(1)
  zonaOrigenId: number;

  @ApiProperty({ example: 7, description: 'Zona de destino (columna)' })
  @IsInt({ message: 'zonaDestinoId debe ser un número entero' })
  @Min(1)
  zonaDestinoId: number;

  // El rango (entero de 1 a 300) se revisa en el servicio para responder con
  // el error de cada celda en lugar de un mensaje general.
  @ApiProperty({ example: 100, minimum: 1, maximum: 300 })
  @IsDefined({ message: 'minutos es obligatorio' })
  minutos: number;
}

export class GuardarMatrizDto {
  @ApiProperty({ type: [TiempoCeldaDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'tiempos debe tener al menos un elemento' })
  // 30 zonas × 30 zonas, de sobra para la operación actual.
  @ArrayMaxSize(900)
  @ValidateNested({ each: true })
  @Type(() => TiempoCeldaDto)
  tiempos: TiempoCeldaDto[];
}
