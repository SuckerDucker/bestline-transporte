import type { EstadoServicio, RolUsuario } from '../generated/prisma/client.js';
import {
  horasReales,
  TRANSICIONES,
  validarTransicion,
} from './transiciones.js';

const ESTADOS: EstadoServicio[] = [
  'PENDIENTE',
  'PROGRAMADO',
  'EN_RUTA',
  'EN_SERVICIO',
  'COMPLETADO',
  'CANCELADO',
  'INCIDENCIA',
  'NO_SHOW',
];
const SUPERVISORES: RolUsuario[] = [
  'ADMINISTRADOR',
  'COORDINADOR',
  'SUPERVISOR',
];

describe('validarTransicion', () => {
  it.each([
    ['PROGRAMADO', 'EN_RUTA'],
    ['EN_RUTA', 'EN_SERVICIO'],
    ['EN_SERVICIO', 'COMPLETADO'],
    ['PROGRAMADO', 'CANCELADO'],
    ['EN_RUTA', 'CANCELADO'],
    ['EN_SERVICIO', 'CANCELADO'],
    ['PROGRAMADO', 'NO_SHOW'],
    ['EN_RUTA', 'NO_SHOW'],
    ['EN_SERVICIO', 'NO_SHOW'],
  ] as [EstadoServicio, EstadoServicio][])(
    '%s → %s es válida para ADMINISTRADOR, COORDINADOR y SUPERVISOR',
    (desde, hacia) => {
      for (const rol of SUPERVISORES) {
        expect(validarTransicion(desde, hacia, rol)).toEqual({ valida: true });
      }
    },
  );

  it.each([
    ['PROGRAMADO', 'COMPLETADO'],
    ['PROGRAMADO', 'EN_SERVICIO'],
    ['EN_RUTA', 'PROGRAMADO'],
    ['EN_SERVICIO', 'EN_RUTA'],
    ['COMPLETADO', 'EN_RUTA'],
    ['CANCELADO', 'PROGRAMADO'],
    ['NO_SHOW', 'EN_RUTA'],
    ['PENDIENTE', 'EN_RUTA'],
    ['PROGRAMADO', 'PROGRAMADO'],
  ] as [EstadoServicio, EstadoServicio][])(
    '%s → %s es inválida: 400 con mensaje',
    (desde, hacia) => {
      expect(validarTransicion(desde, hacia, 'COORDINADOR')).toEqual({
        valida: false,
        codigo: 400,
        mensaje: `No se puede pasar de ${desde} a ${hacia}`,
      });
    },
  );

  it('COMPLETADO, CANCELADO y NO_SHOW son finales; INCIDENCIA no es un estado al que se llegue', () => {
    for (const final of ['COMPLETADO', 'CANCELADO', 'NO_SHOW'] as const) {
      expect(TRANSICIONES[final]).toBeUndefined();
    }
    for (const desde of ESTADOS) {
      expect(TRANSICIONES[desde] ?? []).not.toContain('INCIDENCIA');
      expect(
        validarTransicion(desde, 'INCIDENCIA', 'ADMINISTRADOR').valida,
      ).toBe(false);
    }
  });

  it('el OPERADOR hace las tres del flujo normal', () => {
    expect(validarTransicion('PROGRAMADO', 'EN_RUTA', 'OPERADOR').valida).toBe(
      true,
    );
    expect(validarTransicion('EN_RUTA', 'EN_SERVICIO', 'OPERADOR').valida).toBe(
      true,
    );
    expect(
      validarTransicion('EN_SERVICIO', 'COMPLETADO', 'OPERADOR').valida,
    ).toBe(true);
  });

  it('el OPERADOR no cancela ni marca NO_SHOW (403), aunque la transición exista', () => {
    for (const hacia of ['CANCELADO', 'NO_SHOW'] as const) {
      expect(validarTransicion('PROGRAMADO', hacia, 'OPERADOR')).toEqual({
        valida: false,
        codigo: 403,
        mensaje: `El operador no puede marcar un servicio como ${hacia}`,
      });
    }
  });

  it('el OPERADOR con una transición fuera de orden recibe 400', () => {
    expect(
      validarTransicion('PROGRAMADO', 'COMPLETADO', 'OPERADOR'),
    ).toMatchObject({
      valida: false,
      codigo: 400,
    });
  });
});

describe('horasReales', () => {
  const ahora = new Date('2026-11-10T18:00:00Z');

  it('EN_RUTA guarda el inicio real y COMPLETADO el término real', () => {
    expect(horasReales('EN_RUTA', ahora)).toEqual({ inicioReal: ahora });
    expect(horasReales('COMPLETADO', ahora)).toEqual({ terminoReal: ahora });
  });

  it('los demás estados no tocan las horas reales', () => {
    for (const e of ['EN_SERVICIO', 'CANCELADO', 'NO_SHOW'] as const) {
      expect(horasReales(e, ahora)).toEqual({});
    }
  });
});
