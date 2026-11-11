import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** Unidad (vehículo) a la que se mueve o asigna un servicio. */
export class VehiculoDestinoDto {
  @ApiProperty({ example: 5, description: 'Id del vehículo destino' })
  @IsInt({ message: 'vehiculoId debe ser un número entero' })
  @Min(1, { message: 'vehiculoId debe ser mayor que 0' })
  vehiculoId: number;
}
