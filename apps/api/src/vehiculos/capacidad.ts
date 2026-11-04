import { BadRequestException } from '@nestjs/common';

/**
 * Capacidad máxima de pasajeros por tipo de vehículo (valores de la operación).
 * "Van" y "Urvan" son el mismo tipo de unidad, con el mismo máximo.
 */
export const CAPACIDAD_MAXIMA_POR_TIPO = {
  Van: 14,
  Urvan: 14,
  Sprinter: 20,
  Autobús: 45,
} as const;

export type TipoVehiculo = keyof typeof CAPACIDAD_MAXIMA_POR_TIPO;

export const TIPOS_VEHICULO = Object.keys(
  CAPACIDAD_MAXIMA_POR_TIPO,
) as TipoVehiculo[];

/**
 * Regla de negocio: la capacidad debe ser un entero mayor que 0 y menor o igual
 * al máximo de su tipo. Si el tipo no es uno de los permitidos, también es 400.
 */
export function validarCapacidad(tipo: string, capacidad: number): void {
  if (!Object.hasOwn(CAPACIDAD_MAXIMA_POR_TIPO, tipo)) {
    throw new BadRequestException(
      `Tipo de vehículo no válido: "${tipo}". Tipos permitidos: ${TIPOS_VEHICULO.join(', ')}`,
    );
  }
  const maxima = CAPACIDAD_MAXIMA_POR_TIPO[tipo as TipoVehiculo];
  if (!Number.isInteger(capacidad) || capacidad <= 0 || capacidad > maxima) {
    throw new BadRequestException(
      `La capacidad de un vehículo ${tipo} debe estar entre 1 y ${maxima} pasajeros`,
    );
  }
}
