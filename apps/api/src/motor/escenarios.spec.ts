import { performance } from 'node:perf_hooks';
import { crearTiempo, generarRol, generarRolBase } from './algoritmo.js';
import type {
  Modalidad,
  Motivo,
  ParametrosMotor,
  ResultadoRol,
  ServicioMotor,
  UnidadMotor,
} from './tipos.js';
import {
  type DatosVerificacion,
  type RolAVerificar,
  verificarRol,
} from './verificador.js';

/** mulberry32: números pseudoaleatorios reproducibles a partir de una semilla. */
function crearAleatorio(semilla: number) {
  let a = semilla >>> 0;
  const siguiente = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** Entero entre min y max (incluidos). */
  return (min: number, max: number) =>
    min + Math.floor(siguiente() * (max - min + 1));
}

const AEROPUERTO = 1;
const ZONAS = [1, 2, 3, 4, 5, 6, 7, 8];
const ANTICIPACION: Record<Modalidad, number> = {
  PRIVADO: 10,
  COMPARTIDO: 20,
  GRUPO: 30,
};
// Flota confirmada por la empresa: 4 Van/Urvan (14), 5 Sprinter (20) y 1 Autobús (45).
const CAPACIDADES = [14, 14, 14, 14, 20, 20, 20, 20, 20, 45];
// Bloques confirmados: 5 operadores con cita de 04:00 a 05:00 y 5 de 12:00 a 13:00.
const INICIO_BLOQUE = [240, 240, 240, 240, 240, 720, 720, 720, 720, 720];

/**
 * Un día de operación al azar con el volumen de la empresa: 60 a 75
 * servicios repartidos por franja como en la operación real y 10 unidades
 * (alguna puede no estar disponible). Zonas de término: 1 (aeropuerto) y 2.
 */
function escenario(semilla: number) {
  const azar = crearAleatorio(semilla);
  const matriz = new Map<string, number>();
  for (const o of ZONAS) {
    for (const d of ZONAS) {
      matriz.set(`${o}-${d}`, o === d ? 10 : azar(15, 120));
    }
  }
  const unidades: UnidadMotor[] = CAPACIDADES.map((capacidad, i) => ({
    vehiculoId: i + 1,
    numeroEconomico: `BL-${String(i + 1).padStart(2, '0')}`,
    capacidad,
    operadorId: 100 + i,
    disponible: azar(1, 10) > 1, // ~90 % disponibles
    // Una hora de cita al azar dentro del bloque de cada operador (cada 15 min).
    cita: INICIO_BLOQUE[i] + 15 * azar(0, 4),
    encierro: 3,
  }));
  const modalidades: Modalidad[] = ['PRIVADO', 'COMPARTIDO', 'GRUPO'];
  // Distribución confirmada por la empresa (en proporción 16 / 34 / 10 de
  // cada 60): mañana 04:00-11:55, sobre todo salidas y sin grupos; mediodía y
  // tarde 12:00-18:55, con los grupos desde las 13:00; noche 19:00-21:45.
  const servicios: ServicioMotor[] = Array.from(
    { length: azar(60, 75) },
    (_, i) => {
      const franja = azar(1, 60); // 1-16 mañana, 17-50 tarde, 51-60 noche
      const manana = franja <= 16;
      const noche = franja > 50;
      // En la mañana no hay grupos; en el resto, cualquier modalidad.
      const modalidad = modalidades[azar(0, manana ? 1 : 2)];
      // 1 llegada, 2 salida, 3 traslado; en la mañana, 2 de cada 3 son salidas.
      const sentido = manana ? [1, 2, 2, 2, 2, 3][azar(0, 5)] : azar(1, 3);
      const zona = azar(2, 8);
      const desde = manana
        ? 240
        : noche
          ? 1140
          : modalidad === 'GRUPO'
            ? 780
            : 720;
      const hasta = manana ? 715 : noche ? 1305 : 1135;
      return {
        id: i + 1,
        folio: `E${semilla}-${i + 1}`,
        hora: desde + 5 * azar(0, (hasta - desde) / 5),
        modalidad,
        pasajeros:
          modalidad === 'PRIVADO'
            ? azar(1, 6)
            : modalidad === 'COMPARTIDO'
              ? azar(4, 14)
              : azar(15, 40),
        origen: sentido === 1 ? AEROPUERTO : zona,
        destino: sentido === 2 ? AEROPUERTO : sentido === 1 ? zona : azar(2, 8),
      };
    },
  );
  const zonasTermino = new Set([AEROPUERTO, 2]);
  const parametros: ParametrosMotor = {
    anticipacion: ANTICIPACION,
    jornadaMaxima: 570,
    penalizacionCarga: 15,
    zonasTermino,
    tiempo: crearTiempo(matriz),
  };
  const datos: DatosVerificacion = {
    servicios,
    unidades,
    anticipacion: ANTICIPACION,
    jornadaMaxima: 570,
    zonasTermino,
    matriz,
  };
  return { servicios, unidades, parametros, datos };
}

/** Resultado del motor en el formato que revisa el verificador. */
const aRol = (resultado: ResultadoRol): RolAVerificar => ({
  asignaciones: resultado.unidades.map((u) => ({
    vehiculoId: u.vehiculoId,
    servicios: u.secuencia.map((s) => ({
      id: s.id,
      inicio: s.inicio,
      liberacion: s.liberacion,
    })),
  })),
  noCubiertos: resultado.noCubiertos.map((n) => n.servicio.id),
});

describe('Verificador independiente', () => {
  const { servicios, unidades, parametros, datos } = escenario(7);
  const rol = aRol(generarRol(servicios, unidades, parametros));
  /** Copia del rol para alterarla sin tocar la original. */
  const copia = (): RolAVerificar => structuredClone(rol);
  const conServicios = () =>
    copia().asignaciones.find(
      (a) => a.servicios.length >= 2,
    ) as RolAVerificar['asignaciones'][number];

  it('un rol del motor no tiene violaciones', () => {
    expect(verificarRol(datos, rol)).toEqual([]);
  });

  it('detecta un servicio repetido o que falta', () => {
    const repetido = copia();
    repetido.noCubiertos.push(
      repetido.asignaciones.find((a) => a.servicios.length)!.servicios[0].id,
    );
    expect(verificarRol(datos, repetido).join()).toMatch(/aparece 2 veces/);

    const falta = copia();
    falta.asignaciones.find((a) => a.servicios.length)!.servicios.shift();
    expect(verificarRol(datos, falta).join()).toMatch(/aparece 0 veces/);
  });

  it('detecta CAPACIDAD, EMPALME, JORNADA, ZONA_TERMINO y una unidad no disponible', () => {
    const fila = conServicios();
    const u = unidades.find(
      (x) => x.vehiculoId === fila.vehiculoId,
    ) as UnidadMotor;
    const base = {
      ...datos,
      servicios: datos.servicios.map((s) => ({ ...s })),
    };
    const rolAlterado: RolAVerificar = { ...copia(), asignaciones: [fila] };

    // Más pasajeros que la capacidad.
    const primero = base.servicios.find((s) => s.id === fila.servicios[0].id)!;
    primero.pasajeros = u.capacidad + 1;
    // Dos servicios a la misma hora: el segundo se empalma.
    const segundo = base.servicios.find((s) => s.id === fila.servicios[1].id)!;
    const original = { ...segundo };
    segundo.hora = primero.hora;
    const sinHoras = {
      ...rolAlterado,
      asignaciones: [
        { ...fila, servicios: fila.servicios.map((s) => ({ id: s.id })) },
      ],
    };
    const texto = verificarRol(
      { ...base, jornadaMaxima: 0, zonasTermino: new Set() },
      sinHoras,
    ).join(' | ');
    expect(texto).toMatch(/CAPACIDAD/);
    expect(texto).toMatch(/EMPALME/);
    expect(texto).toMatch(/JORNADA/);
    expect(texto).toMatch(/ZONA_TERMINO/);
    Object.assign(segundo, original);

    const noDisponible = verificarRol(
      {
        ...datos,
        unidades: unidades.map((x) =>
          x === u ? { ...x, disponible: false } : x,
        ),
      },
      rolAlterado,
    );
    expect(noDisponible.join()).toMatch(/no está disponible/);
  });

  it('ZONA_TERMINO: fuera de zona de término es válido si alcanza a regresar al encierro', () => {
    // Un servicio de la zona 1 (término) a la 3, a las 600; encierro en la 2.
    const mini: DatosVerificacion = {
      servicios: [
        {
          id: 1,
          folio: 'T-1',
          hora: 600,
          modalidad: 'PRIVADO',
          pasajeros: 4,
          origen: 1,
          destino: 3,
        },
      ],
      unidades: [{ ...unidades[0], cita: 240, encierro: 2, disponible: true }],
      anticipacion: ANTICIPACION,
      jornadaMaxima: 570,
      zonasTermino: new Set([1]),
      matriz: new Map([
        ['2-1', 30],
        ['1-3', 60],
        ['3-2', 50],
      ]),
    };
    const unico: RolAVerificar = {
      asignaciones: [
        { vehiculoId: unidades[0].vehiculoId, servicios: [{ id: 1 }] },
      ],
      noCubiertos: [],
    };
    // Libera a las 660 en la zona 3 y regresa al encierro a las 710 (470 <= 570).
    expect(verificarRol(mini, unico)).toEqual([]);
    // Con 7 h (420 min) el servicio cabe (660 − 240 = 420), pero el regreso no.
    expect(verificarRol({ ...mini, jornadaMaxima: 420 }, unico)).toEqual([
      expect.stringMatching(
        /no alcanza a regresar al encierro \(ZONA_TERMINO\)/,
      ),
    ]);
  });

  it('detecta horas guardadas distintas de las calculadas', () => {
    const fila = conServicios();
    fila.servicios[0].liberacion = (fila.servicios[0].liberacion ?? 0) + 1;
    expect(
      verificarRol(datos, { ...copia(), asignaciones: [fila] }).join(),
    ).toMatch(/liberación guardada/);
  });
});

describe('200 escenarios aleatorios (semilla fija)', () => {
  it('ningún rol viola una restricción', () => {
    const motivos: Record<Motivo, number> = {
      CAPACIDAD: 0,
      EMPALME: 0,
      JORNADA: 0,
      ZONA_TERMINO: 0,
      SIN_UNIDAD: 0,
    };
    let servicios = 0;
    let asignados = 0;
    let asignadosSinReinsercion = 0;
    const fallas: string[] = [];
    const contar = (r: ResultadoRol) =>
      r.unidades.reduce((n, u) => n + u.secuencia.length, 0);

    for (let semilla = 1; semilla <= 200; semilla++) {
      const caso = escenario(semilla);
      const resultado = generarRol(
        caso.servicios,
        caso.unidades,
        caso.parametros,
      );
      const violaciones = verificarRol(caso.datos, aRol(resultado));
      if (violaciones.length)
        fallas.push(`semilla ${semilla}: ${violaciones.join('; ')}`);
      // Propiedad: la reinserción nunca baja la cobertura.
      const sinReinsercion = contar(
        generarRolBase(caso.servicios, caso.unidades, caso.parametros),
      );
      if (contar(resultado) < sinReinsercion)
        fallas.push(`semilla ${semilla}: la reinserción bajó la cobertura`);

      servicios += caso.servicios.length;
      asignados += contar(resultado);
      asignadosSinReinsercion += sinReinsercion;
      for (const n of resultado.noCubiertos) motivos[n.motivo]++;
    }

    expect(fallas).toEqual([]);
    // Los escenarios sí ponen a prueba las reglas: hay servicios rechazados por
    // capacidad, por empalme o jornada y por zona de término.
    expect(servicios).toBeGreaterThanOrEqual(200 * 60);
    expect(motivos.CAPACIDAD).toBeGreaterThan(0);
    expect(motivos.EMPALME + motivos.JORNADA).toBeGreaterThan(0);
    expect(motivos.ZONA_TERMINO).toBeGreaterThan(0);
    // Resumen para las evidencias.
    console.info(
      `200 escenarios: ${servicios} servicios, ${asignadosSinReinsercion} asignados sin reinserción, ${asignados} con reinserción, no cubiertos ${JSON.stringify(motivos)}`,
    );
  });
});

describe('Rendimiento (RNF-02)', () => {
  it('75 servicios y 10 unidades: genera el rol en menos de 1 minuto', () => {
    const caso = escenario(2026);
    // Se fuerza el volumen máximo del día: 75 servicios.
    const extra = escenario(2027).servicios.map((s, i) => ({
      ...s,
      id: 1000 + i,
    }));
    const servicios = [...caso.servicios, ...extra].slice(0, 75);
    expect(servicios).toHaveLength(75);

    const inicio = performance.now();
    const resultado = generarRol(servicios, caso.unidades, caso.parametros);
    const ms = performance.now() - inicio;

    expect(ms).toBeLessThan(60_000);
    expect(
      resultado.unidades.reduce((n, u) => n + u.secuencia.length, 0) +
        resultado.noCubiertos.length,
    ).toBe(75);
    console.info(
      `Rendimiento: 75 servicios y 10 unidades en ${ms.toFixed(2)} ms`,
    );
  });
});
