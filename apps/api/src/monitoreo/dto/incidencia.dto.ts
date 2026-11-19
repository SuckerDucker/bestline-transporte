import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Tipos de incidencia (la columna incidencia.tipo es texto; se valida aquí). */
export const TIPOS_INCIDENCIA = [
  'RETRASO',
  'FALLA_MECANICA',
  'PASAJERO_NO_SE_PRESENTO',
  'CAMBIO_DE_HORA',
  'OTRO',
] as const;
export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number];

/** Incidencia que se registra sobre un servicio. */
export class IncidenciaDto {
  @ApiProperty({ enum: TIPOS_INCIDENCIA, example: 'RETRASO' })
  @IsIn(TIPOS_INCIDENCIA, {
    message: `tipo debe ser uno de: ${TIPOS_INCIDENCIA.join(', ')}`,
  })
  tipo: TipoIncidencia;

  @ApiProperty({
    example: 'Vuelo demorado 40 minutos; la unidad espera en CUN',
    maxLength: 500,
  })
  @IsString({ message: 'descripcion debe ser texto' })
  @IsNotEmpty({ message: 'descripcion es obligatoria' })
  @MaxLength(500, {
    message: 'descripcion debe tener como máximo 500 caracteres',
  })
  descripcion: string;
}
