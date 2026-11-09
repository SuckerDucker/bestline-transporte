import { BadRequestException } from '@nestjs/common';
import { CAPACIDAD_MAXIMA_POR_TIPO, validarCapacidad } from './capacidad.js';

describe('Regla de capacidad por tipo de vehículo', () => {
  it('tiene los máximos de operación: Van/Urvan 14, Sprinter 20, Autobús 45', () => {
    expect(CAPACIDAD_MAXIMA_POR_TIPO).toEqual({
      Van: 14,
      Urvan: 14,
      Sprinter: 20,
      Autobús: 45,
    });
  });

  it.each([
    ['Van', 1],
    ['Van', 14],
    ['Urvan', 14],
    ['Sprinter', 20],
    ['Autobús', 45],
  ])('acepta %s con %i pasajeros', (tipo, capacidad) => {
    expect(() => validarCapacidad(tipo, capacidad)).not.toThrow();
  });

  it.each([
    ['Van', 15],
    ['Urvan', 15],
    ['Sprinter', 21],
    ['Autobús', 46],
  ])('rechaza %s con %i pasajeros (excede el máximo)', (tipo, capacidad) => {
    expect(() => validarCapacidad(tipo, capacidad)).toThrow(
      BadRequestException,
    );
  });

  it.each([0, -3, 2.5])(
    'rechaza la capacidad %p (debe ser entero > 0)',
    (capacidad) => {
      expect(() => validarCapacidad('Sprinter', capacidad)).toThrow(
        'La capacidad de un vehículo Sprinter debe estar entre 1 y 20 pasajeros',
      );
    },
  );

  it.each(['Camión', 'van', '', 'toString'])(
    'rechaza el tipo desconocido %p con 400',
    (tipo) => {
      expect(() => validarCapacidad(tipo, 5)).toThrow(BadRequestException);
      expect(() => validarCapacidad(tipo, 5)).toThrow(
        /Tipo de vehículo no válido/,
      );
    },
  );
});
