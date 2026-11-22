import {
  type AsignacionDia,
  cobertura,
  type DatosDia,
  horasJornada,
  indicadoresDelDia,
  minutosElaboracion,
  ocupacionPromedio,
  resumenDelRango,
} from './calculo.js';

// Zonas: 1 CUN y 2 Zona Hotelera (de término), 3 Centro (encierro, no es de término).
const ZONAS_TERMINO = new Set([1, 2]);
const TIEMPOS: Record<string, number> = { '3-3': 0, '4-3': 50 };
const tiempo = (o: number, d: number) => TIEMPOS[`${o}-${d}`];
const h = (hora: string) => new Date(`2026-11-10T${hora}:00-05:00`);

const asignacion = (
  vehiculoId: number,
  pasajeros: number,
  liberacion: string,
  destinoId: number,
  capacidad = 14,
): AsignacionDia => ({
  vehiculoId,
  numeroEconomico: `BL-0${vehiculoId}`,
  capacidad,
  pasajeros,
  cita: h(vehiculoId === 1 ? '04:00' : '12:00'),
  liberacion: h(liberacion),
  destinoId,
  encierroId: 3,
});

/** Día con datos conocidos: 2 unidades, 4 asignados, 1 no cubierto. */
const DIA: DatosDia = {
  fecha: '2026-11-10',
  // Generado y autorizado 12 min 30 s después.
  rol: {
    estado: 'AUTORIZADO',
    generadoEn: new Date('2026-11-09T22:00:00Z'),
    autorizadoEn: new Date('2026-11-09T22:12:30Z'),
  },
  estados: ['COMPLETADO', 'COMPLETADO', 'CANCELADO', 'NO_SHOW', 'PENDIENTE'],
  asignaciones: [
    // BL-01: termina en CUN (zona de término) a las 12:30 → 04:00 a 12:30 = 8.5 h
    asignacion(1, 7, '09:00', 2),
    asignacion(1, 14, '12:30', 1),
    // BL-02 (Sprinter 20): termina en la zona 4 a las 19:00 y regresa 50 min
    // a su encierro → 12:00 a 19:50 = 7.83 h
    asignacion(2, 10, '15:00', 1, 20),
    asignacion(2, 5, '19:00', 4, 20),
  ],
  noCubiertos: ['CAPACIDAD'],
  incidencias: ['RETRASO', 'RETRASO', 'OTRO'],
  empalmes: 0,
  zonasTermino: ZONAS_TERMINO,
  tiempo,
};

describe('indicadoresDelDia', () => {
  it('calcula cada indicador con datos conocidos', () => {
    const r = indicadoresDelDia(DIA);

    expect(r).toMatchObject({
      fecha: '2026-11-10',
      estadoRol: 'AUTORIZADO',
      servicios: 5,
      asignados: 4,
      noCubiertos: 1,
      noCubiertosPorMotivo: {
        CAPACIDAD: 1,
        EMPALME: 0,
        JORNADA: 0,
        ZONA_TERMINO: 0,
        SIN_UNIDAD: 0,
      },
      // 4 / (4 + 1) = 80 %
      cobertura: 80,
      empalmes: 0,
      completados: 2,
      cancelados: 1,
      noShow: 1,
      incidencias: 3,
      incidenciasPorTipo: { RETRASO: 2, OTRO: 1, FALLA_MECANICA: 0 },
      // (7/14 + 14/14 + 10/20 + 5/20) / 4 = (0.5 + 1 + 0.5 + 0.25) / 4 = 0.5625
      ocupacion: 0.563,
      tiempoElaboracionMin: 12.5,
    });
    expect(r.unidades).toEqual([
      {
        vehiculoId: 1,
        numeroEconomico: 'BL-01',
        capacidad: 14,
        servicios: 2,
        pasajeros: 21,
        ocupacion: 0.75,
        horasJornada: 8.5,
      },
      {
        vehiculoId: 2,
        numeroEconomico: 'BL-02',
        capacidad: 20,
        servicios: 2,
        pasajeros: 15,
        ocupacion: 0.375,
        horasJornada: 7.83,
      },
    ]);
  });

  it('sin rol: cobertura y empalmes en null y sin unidades', () => {
    const r = indicadoresDelDia({
      ...DIA,
      rol: null,
      asignaciones: [],
      noCubiertos: [],
      empalmes: null,
      estados: ['PENDIENTE', 'PENDIENTE'],
    });
    expect(r).toMatchObject({
      servicios: 2,
      asignados: 0,
      cobertura: null,
      empalmes: null,
      ocupacion: null,
      tiempoElaboracionMin: null,
      unidades: [],
    });
  });

  it('tiempo de elaboración: un rol PROPUESTO no lo tiene, aunque traiga fecha', () => {
    const r = indicadoresDelDia({
      ...DIA,
      rol: { ...DIA.rol!, estado: 'PROPUESTO' },
    });
    expect(r.tiempoElaboracionMin).toBeNull();
  });
});

describe('minutosElaboracion', () => {
  const generado = new Date('2026-11-09T22:00:00Z');

  it('minutos con un decimal, también en 0 y de un día a otro', () => {
    expect(minutosElaboracion(generado, new Date('2026-11-09T22:12:30Z'))).toBe(
      12.5,
    );
    expect(minutosElaboracion(generado, generado)).toBe(0);
    expect(minutosElaboracion(generado, new Date('2026-11-10T22:00:00Z'))).toBe(
      1440,
    );
  });

  it('null sin autorización o si se autorizó antes de generar', () => {
    expect(minutosElaboracion(generado, null)).toBeNull();
    expect(
      minutosElaboracion(generado, new Date('2026-11-09T21:59:59Z')),
    ).toBeNull();
  });
});

describe('funciones de un indicador', () => {
  it('cobertura: porcentaje con un decimal; null si el rol no tiene servicios', () => {
    expect(cobertura(41, 19)).toBe(68.3);
    expect(cobertura(0, 0)).toBeNull();
  });

  it('ocupacion: promedio de pasajeros / capacidad', () => {
    expect(
      ocupacionPromedio([
        { pasajeros: 14, capacidad: 14 },
        { pasajeros: 0, capacidad: 20 },
      ]),
    ).toBe(0.5);
    expect(ocupacionPromedio([])).toBeNull();
  });

  it('horasJornada: sin cita es null; si falta el tiempo de regreso no se suma', () => {
    expect(
      horasJornada(
        [{ ...asignacion(1, 2, '10:00', 4), cita: null }],
        ZONAS_TERMINO,
        tiempo,
      ),
    ).toBeNull();
    // Destino 5 no tiene tiempo a su encierro en la matriz: 04:00 a 10:00 = 6 h
    expect(
      horasJornada([asignacion(1, 2, '10:00', 5)], ZONAS_TERMINO, tiempo),
    ).toBe(6);
  });
});

describe('resumenDelRango', () => {
  it('suma los días y calcula cobertura y ocupación con todos los servicios del rango', () => {
    const dia1 = indicadoresDelDia(DIA);
    const dia2 = indicadoresDelDia({
      ...DIA,
      fecha: '2026-11-11',
      rol: {
        estado: 'PROPUESTO',
        generadoEn: new Date('2026-11-10T22:00:00Z'),
        autorizadoEn: null,
      },
      asignaciones: [asignacion(1, 14, '10:00', 1)],
      noCubiertos: ['EMPALME', 'EMPALME', 'JORNADA'],
      estados: ['PROGRAMADO', 'PENDIENTE', 'PENDIENTE', 'PENDIENTE'],
      incidencias: [],
      empalmes: null,
    });
    const sinRol = indicadoresDelDia({
      ...DIA,
      fecha: '2026-11-12',
      rol: null,
      asignaciones: [],
      noCubiertos: [],
      estados: [],
      incidencias: [],
      empalmes: null,
    });

    const r = resumenDelRango([dia1, dia2, sinRol]);

    expect(r).toMatchObject({
      dias: 3,
      diasConRol: 2,
      servicios: 9,
      asignados: 5,
      noCubiertos: 4,
      noCubiertosPorMotivo: { CAPACIDAD: 1, EMPALME: 2, JORNADA: 1 },
      // 5 / 9 = 55.6 %, no el promedio de 80 % y 25 %
      cobertura: 55.6,
      // Solo el día AUTORIZADO cuenta empalmes.
      empalmes: 0,
      completados: 2,
      incidencias: 3,
      // (0.5 + 1 + 0.5 + 0.25 + 1) / 5 = 0.65
      ocupacion: 0.65,
    });
    expect(r.unidades).toEqual([
      // BL-01: 3 servicios, ocupación (0.75·2 + 1·1) / 3; jornada (8.5 + 6) / 2
      {
        vehiculoId: 1,
        numeroEconomico: 'BL-01',
        servicios: 3,
        ocupacion: 0.833,
        horasJornadaPromedio: 7.25,
      },
      {
        vehiculoId: 2,
        numeroEconomico: 'BL-02',
        servicios: 2,
        ocupacion: 0.375,
        horasJornadaPromedio: 7.83,
      },
    ]);
  });

  it('promedia el tiempo de elaboración solo de los roles autorizados', () => {
    const autorizado = (fecha: string, fin: string) =>
      indicadoresDelDia({
        ...DIA,
        fecha,
        rol: {
          estado: 'AUTORIZADO',
          generadoEn: new Date('2026-11-09T22:00:00Z'),
          autorizadoEn: new Date(fin),
        },
      });
    const propuesto = indicadoresDelDia({
      ...DIA,
      fecha: '2026-11-12',
      rol: { ...DIA.rol!, estado: 'PROPUESTO', autorizadoEn: null },
    });
    const r = resumenDelRango([
      autorizado('2026-11-10', '2026-11-09T22:12:30Z'),
      autorizado('2026-11-11', '2026-11-09T22:17:30Z'),
      propuesto,
    ]);
    // (12.5 + 17.5) / 2; el día PROPUESTO no cuenta como 0.
    expect(r.tiempoElaboracionPromedioMin).toBe(15);
  });

  it('sin días con rol: cobertura, empalmes, ocupación y elaboración en null', () => {
    const r = resumenDelRango([]);
    expect(r).toMatchObject({
      dias: 0,
      cobertura: null,
      empalmes: null,
      ocupacion: null,
      tiempoElaboracionPromedioMin: null,
      unidades: [],
    });
  });
});
