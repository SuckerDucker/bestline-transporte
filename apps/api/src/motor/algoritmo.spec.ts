import {
  calcularHoras,
  cierreValido,
  costo,
  costoInsercion,
  crearTiempo,
  generarRol,
  generarRolBase,
  mejorHueco,
  mejorInsercion,
  motivoPorMayoria,
  reinsertar,
  reubicarPorZonaTermino,
  secuenciaValida,
  verificarRestricciones,
} from './algoritmo.js';
import type {
  Modalidad,
  ParametrosMotor,
  ServicioCalculado,
  ServicioMotor,
  UnidadEnRol,
  UnidadMotor,
} from './tipos.js';

// Escenario pequeño, fácil de seguir a mano (horas en minutos desde las 00:00):
// zonas 1 = Aeropuerto CUN y 2 = Zona Hotelera (de término), 3 = Centro
// (encierro) y 4 = Tulum. Tiempos: 10 min en la misma zona, 100 min desde o
// hacia Tulum y 30 min entre las demás.
const CUN = 1;
const ZH = 2;
const CENTRO = 3;
const TULUM = 4;
const matriz = new Map<string, number>();
for (const o of [CUN, ZH, CENTRO, TULUM]) {
  for (const d of [CUN, ZH, CENTRO, TULUM]) {
    matriz.set(
      `${o}-${d}`,
      o === d ? 10 : o === TULUM || d === TULUM ? 100 : 30,
    );
  }
}
const parametros = (
  cambios: Partial<ParametrosMotor> = {},
): ParametrosMotor => ({
  anticipacion: { PRIVADO: 10, COMPARTIDO: 20, GRUPO: 30 },
  jornadaMaxima: 570, // 9.5 h
  penalizacionCarga: 15,
  zonasTermino: new Set([CUN, ZH]),
  tiempo: crearTiempo(matriz),
  ...cambios,
});
const p = parametros();

const unidad = (
  n: number,
  cambios: Partial<UnidadMotor> = {},
): UnidadMotor => ({
  vehiculoId: n,
  numeroEconomico: `BL-${String(n).padStart(2, '0')}`,
  capacidad: 14,
  operadorId: 100 + n,
  disponible: true,
  cita: 240, // 04:00
  encierro: CENTRO,
  ...cambios,
});
const enRol = (
  u: UnidadMotor,
  secuencia: ServicioCalculado[] = [],
): UnidadEnRol => ({
  ...u,
  secuencia,
});
const servicio = (
  id: number,
  hora: number,
  origen = CUN,
  destino = ZH,
  cambios: { pasajeros?: number; modalidad?: Modalidad } = {},
): ServicioMotor => ({
  id,
  folio: `S-${id}`,
  hora,
  modalidad: cambios.modalidad ?? 'PRIVADO',
  pasajeros: cambios.pasajeros ?? 4,
  origen,
  destino,
});
/** Servicio con sus horas ya calculadas por el motor. */
const calculado = (...args: Parameters<typeof servicio>) =>
  calcularHoras([servicio(...args)], p)[0];
/** Secuencia (folios) de cada unidad del resultado. */
const secuencias = (unidades: UnidadEnRol[]) =>
  Object.fromEntries(
    unidades.map((u) => [u.numeroEconomico, u.secuencia.map((s) => s.folio)]),
  );

describe('calcularHoras', () => {
  it('inicio = hora − anticipación(modalidad); liberación = hora + tiempo(origen, destino)', () => {
    const [privado, grupo] = calcularHoras(
      [servicio(1, 480), servicio(2, 480, CUN, TULUM, { modalidad: 'GRUPO' })],
      p,
    );
    expect(privado).toMatchObject({ inicio: 470, liberacion: 510 });
    expect(grupo).toMatchObject({ inicio: 450, liberacion: 580 });
  });
});

describe('verificarRestricciones', () => {
  it('CAPACIDAD: más pasajeros que la capacidad de la unidad', () => {
    const s = calculado(1, 600, CUN, ZH, { pasajeros: 15 });
    expect(verificarRestricciones(enRol(unidad(1)), s, p)).toBe('CAPACIDAD');
    expect(
      verificarRestricciones(enRol(unidad(1, { capacidad: 20 })), s, p),
    ).toBeNull();
  });

  it('primer servicio: sale del encierro a la hora de cita (04:00 + 30 min al aeropuerto)', () => {
    const u = enRol(unidad(1));
    // inicio 270 (04:30): llega justo a tiempo.
    expect(verificarRestricciones(u, calculado(1, 280), p)).toBeNull();
    // inicio 269: un minuto antes de que pueda llegar.
    expect(verificarRestricciones(u, calculado(2, 279), p)).toBe('EMPALME');
  });

  it('EMPALME cuenta el traslado en vacío desde el destino anterior', () => {
    // Termina en Tulum a las 600; ir de Tulum al aeropuerto toma 100 min.
    const anterior = calculado(1, 500, CUN, TULUM);
    expect(anterior.liberacion).toBe(600);
    const u = enRol(unidad(1), [anterior]);
    // Sin contar el vacío (600 <= 690) parecería que sí cabe.
    expect(verificarRestricciones(u, calculado(2, 700), p)).toBe('EMPALME');
    expect(verificarRestricciones(u, calculado(3, 710), p)).toBeNull();
  });

  it('JORNADA: liberación − hora de cita <= jornada máxima (9.5 h desde las 04:00 = 13:30)', () => {
    const u = enRol(unidad(1));
    expect(verificarRestricciones(u, calculado(1, 780), p)).toBeNull(); // libera 810
    expect(verificarRestricciones(u, calculado(2, 781), p)).toBe('JORNADA'); // libera 811
  });
});

describe('costo', () => {
  it('espera + vacío + penalización por cada servicio ya asignado', () => {
    const s = calculado(9, 600); // inicio 590, origen CUN
    // Desde el encierro: llega a las 270 → espera 320 + vacío 30.
    expect(costo(enRol(unidad(1)), s, p)).toBe(350);
    // Después de un servicio que libera a las 560 en el aeropuerto: espera 20
    // + vacío 10 + 15 de penalización.
    const anterior = calculado(1, 530, ZH, CUN);
    expect(costo(enRol(unidad(2), [anterior]), s, p)).toBe(45);
  });
});

describe('motivoPorMayoria', () => {
  it('gana la restricción que lo rechazó en más unidades', () => {
    expect(motivoPorMayoria(['CAPACIDAD', 'EMPALME', 'EMPALME'])).toBe(
      'EMPALME',
    );
    expect(motivoPorMayoria(['JORNADA', 'JORNADA', 'CAPACIDAD'])).toBe(
      'JORNADA',
    );
  });

  it('en empate gana la que va primero en el orden de verificación', () => {
    expect(motivoPorMayoria(['JORNADA', 'EMPALME'])).toBe('EMPALME');
    expect(motivoPorMayoria(['JORNADA', 'CAPACIDAD', 'EMPALME'])).toBe(
      'CAPACIDAD',
    );
  });
});

describe('generarRol', () => {
  it('elige la unidad de menor costo', () => {
    // S-1 (inicio 520, sale de ZH): BL-01 (cita 04:00) llega a las 270 y
    // espera 250 → costo 280; BL-02 (cita 05:00) llega a las 330 y espera 190
    // → costo 220. Gana BL-02.
    // S-2 (inicio 590, sale de CUN): BL-02 ya está en CUN (libera 560): espera
    // 20 + vacío 10 + 15 de penalización = 45; BL-01 desde el encierro: 350.
    const { unidades } = generarRol(
      [servicio(1, 530, ZH, CUN), servicio(2, 600, CUN, ZH)],
      [unidad(1, { cita: 240 }), unidad(2, { cita: 300 })],
      p,
    );
    expect(secuencias(unidades)).toEqual({
      'BL-01': [],
      'BL-02': ['S-1', 'S-2'],
    });
  });

  it('la penalización por carga reparte los servicios entre unidades', () => {
    const servicios = [servicio(1, 300, CUN, ZH), servicio(2, 600, ZH, CUN)];
    const unidades = [unidad(1), unidad(2)];
    // Sin penalización, BL-01 hace los dos (275 − 15 = 260 < 350).
    expect(
      secuencias(
        generarRol(servicios, unidades, parametros({ penalizacionCarga: 0 }))
          .unidades,
      ),
    ).toEqual({ 'BL-01': ['S-1', 'S-2'], 'BL-02': [] });
    // Con 100 min por servicio asignado, el segundo pasa a BL-02 (360 > 350).
    expect(
      secuencias(
        generarRol(servicios, unidades, parametros({ penalizacionCarga: 100 }))
          .unidades,
      ),
    ).toEqual({ 'BL-01': ['S-1'], 'BL-02': ['S-2'] });
  });

  it('desempate reproducible: con el mismo costo gana el menor número económico', () => {
    const doce = { ...unidad(12), numeroEconomico: 'BL-12' };
    const dos = { ...unidad(2), numeroEconomico: 'BL-2' };
    for (const orden of [
      [doce, dos],
      [dos, doce],
    ]) {
      const { unidades } = generarRol([servicio(1, 600)], orden, p);
      // Numérico: BL-2 va antes que BL-12 (en texto "BL-12" < "BL-2").
      expect(secuencias(unidades)['BL-2']).toEqual(['S-1']);
    }
  });

  it('ordena los servicios por inicio, no por hora (un GRUPO empieza 30 min antes)', () => {
    const { unidades } = generarRol(
      [servicio(1, 600), servicio(2, 605, CUN, ZH, { modalidad: 'GRUPO' })],
      [unidad(1)],
      parametros({ penalizacionCarga: 0 }),
    );
    // S-2 empieza a las 575 y S-1 a las 590: solo cabe el primero que se revisa.
    expect(secuencias(unidades)['BL-01']).toEqual(['S-2']);
  });

  it('una unidad en mantenimiento o con operador no disponible no participa', () => {
    const resultado = generarRol(
      [servicio(1, 600)],
      [unidad(1, { disponible: false }), unidad(2)],
      p,
    );
    expect(resultado.unidades.map((u) => u.numeroEconomico)).toEqual(['BL-02']);
    expect(secuencias(resultado.unidades)).toEqual({ 'BL-02': ['S-1'] });
  });

  it('SIN_UNIDAD si no hay unidades disponibles', () => {
    const { noCubiertos } = generarRol(
      [servicio(1, 600), servicio(2, 700)],
      [unidad(1, { disponible: false })],
      p,
    );
    expect(noCubiertos.map((n) => [n.servicio.folio, n.motivo])).toEqual([
      ['S-1', 'SIN_UNIDAD'],
      ['S-2', 'SIN_UNIDAD'],
    ]);
  });

  it('el motivo del no cubierto es la restricción con más rechazos', () => {
    // 20 pasajeros: dos vans lo rechazan por CAPACIDAD; el autobús, por JORNADA.
    const { noCubiertos } = generarRol(
      [servicio(1, 790, CUN, ZH, { pasajeros: 20 })],
      [unidad(1), unidad(2), unidad(3, { capacidad: 45 })],
      p,
    );
    expect(noCubiertos).toEqual([
      expect.objectContaining({
        motivo: 'CAPACIDAD',
        servicio: expect.objectContaining({ folio: 'S-1' }),
      }),
    ]);
  });
});

describe('zona de término', () => {
  // Jornada corta (5 h) para que una unidad que termina en Tulum no alcance a
  // regresar a su encierro en Centro (Tulum → Centro tarda 100 min).
  const pz = parametros({ jornadaMaxima: 300 });
  // BL-02 lleva dos servicios con un hueco entre ellos: libera a las 330 en ZH
  // y el siguiente empieza a las 690 (sale de ZH).
  const conHueco = (siguienteHora: number) =>
    enRol(unidad(2), [
      calculado(10, 300, CUN, ZH),
      calculado(11, siguienteHora, ZH, CUN),
    ]);
  // BL-01 termina en Tulum (no es zona de término): libera a las 500 y
  // regresaría al encierro a las 600 (600 − 240 = 360 > 300).
  const terminaEnTulum = () =>
    enRol(unidad(1), [calculado(1, 400, CUN, TULUM)]);

  it('reubica el último servicio en el hueco de otra unidad', () => {
    const unidades = [terminaEnTulum(), conHueco(700)];
    const noCubiertos = reubicarPorZonaTermino(unidades, pz);

    expect(noCubiertos).toEqual([]);
    expect(secuencias(unidades)).toEqual({
      'BL-01': [],
      'BL-02': ['S-10', 'S-1', 'S-11'],
    });
  });

  it('si no cabe en ningún hueco queda como no cubierto por ZONA_TERMINO', () => {
    // El siguiente servicio de BL-02 empieza a las 590: S-1 libera a las 500
    // en Tulum y tarda 100 min a ZH (600 > 590).
    const unidades = [terminaEnTulum(), conHueco(600)];
    const noCubiertos = reubicarPorZonaTermino(unidades, pz);

    expect(noCubiertos.map((n) => [n.servicio.folio, n.motivo])).toEqual([
      ['S-1', 'ZONA_TERMINO'],
    ]);
    expect(secuencias(unidades)).toEqual({
      'BL-01': [],
      'BL-02': ['S-10', 'S-11'],
    });
  });

  it('quita servicios del final mientras la unidad siga terminando fuera de zona', () => {
    // BL-01: CUN→Tulum y luego Tulum→Centro; ninguno termina en zona de término
    // y ninguno deja tiempo para regresar al encierro.
    const u = enRol(unidad(1), [
      calculado(1, 500, CUN, TULUM),
      calculado(2, 700, TULUM, CENTRO),
    ]);
    const noCubiertos = reubicarPorZonaTermino([u], pz);

    expect(noCubiertos.map((n) => n.servicio.folio)).toEqual(['S-2', 'S-1']);
    expect(u.secuencia).toEqual([]);
  });

  it('no inserta en una unidad que todavía termina fuera de zona', () => {
    const otra = enRol(unidad(2), [
      calculado(10, 300, CUN, ZH),
      calculado(11, 700, ZH, TULUM),
    ]);
    // S-1 sí cabría en el hueco de BL-02 (entre S-10 y S-11)...
    expect(mejorHueco([otra], calculado(1, 400, CUN, TULUM), p)).not.toBeNull();
    // ...pero BL-02 todavía termina en Tulum, así que no se usa: S-1 queda no
    // cubierto y después se quita S-11 del final de BL-02.
    const unidades = [terminaEnTulum(), otra];
    const noCubiertos = reubicarPorZonaTermino(unidades, pz);
    expect(noCubiertos.map((n) => n.servicio.folio)).toEqual(['S-1', 'S-11']);
  });

  it('fuera de zona de término es válido si la unidad alcanza a regresar a su encierro', () => {
    // Con la jornada normal (570): S-1 libera a las 500 en Tulum y regresa a
    // Centro a las 600 (600 − 240 = 360 <= 570), así que BL-01 lo conserva.
    const u = terminaEnTulum();
    expect(cierreValido(u, p)).toBe(true);
    expect(reubicarPorZonaTermino([u], p)).toEqual([]);
    expect(u.secuencia.map((s) => s.folio)).toEqual(['S-1']);
  });

  it('el regreso al encierro respeta el límite de la jornada (extremo incluido)', () => {
    // CUN→Tulum a las 610 libera a las 710; regresa a las 810: 810 − 240 = 570.
    expect(
      cierreValido(enRol(unidad(1), [calculado(1, 610, CUN, TULUM)]), p),
    ).toBe(true);
    // Un minuto después (811 − 240 = 571) ya no alcanza.
    expect(
      cierreValido(enRol(unidad(1), [calculado(1, 611, CUN, TULUM)]), p),
    ).toBe(false);
    // En Zona Hotelera o en el aeropuerto no hace falta regresar.
    expect(
      cierreValido(enRol(unidad(1), [calculado(1, 780, CUN, ZH)]), p),
    ).toBe(true);
    // Una unidad sin servicios no tiene que cerrar nada.
    expect(cierreValido(enRol(unidad(1)), p)).toBe(true);
  });

  it('entre varios huecos elige el de menor costo', () => {
    const lejos = enRol(unidad(2), [
      calculado(10, 300, CUN, ZH),
      calculado(11, 700, ZH, CUN),
    ]);
    const cerca = enRol(unidad(3), [
      calculado(20, 360, CUN, CUN),
      calculado(21, 700, ZH, CUN),
    ]);
    // S-1 sale de CUN: desde BL-03 (libera 370 en CUN) espera menos que desde BL-02.
    expect(
      mejorHueco([lejos, cerca], calculado(1, 400, CUN, TULUM), p),
    ).toEqual({
      unidad: cerca,
      indice: 1,
    });
  });
});

describe('reinserción', () => {
  // BL-02 con un hueco: S-10 libera a las 330 en ZH y S-11 empieza a las 690 en ZH.
  const conHueco = () =>
    enRol(unidad(2), [
      calculado(10, 300, CUN, ZH),
      calculado(11, 700, ZH, CUN),
    ]);
  const folios = (n: { servicio: ServicioCalculado; motivo: string }[]) =>
    n.map((x) => [x.servicio.folio, x.motivo]);

  it('inserta en una unidad vacía cuando las demás están ocupadas', () => {
    // S-2 (inicio 595) se empalma con S-1 de BL-01 en cualquier posición.
    const ocupada = enRol(unidad(1), [calculado(1, 600, CUN, ZH)]);
    const vacia = enRol(unidad(2));
    const quedan = reinsertar(
      [ocupada, vacia],
      [{ servicio: calculado(2, 605, CUN, ZH), motivo: 'EMPALME' }],
      p,
    );
    expect(quedan).toEqual([]);
    expect(secuencias([ocupada, vacia])).toEqual({
      'BL-01': ['S-1'],
      'BL-02': ['S-2'],
    });
  });

  it('inserta en medio respetando el empalme con el servicio siguiente', () => {
    const u = conHueco();
    // S-3 (inicio 440, libera 460 en ZH): llega a S-11 a las 470 <= 690.
    const s = calculado(3, 450, ZH, ZH);
    expect(mejorInsercion([u], s, p)).toEqual({ unidad: u, indice: 1 });
    // Espera 440 − 340 = 100, vacío añadido 10 + 10 − 10 = 10, carga 2 × 15.
    expect(costoInsercion(u, 1, s, p)).toBe(140);
    // S-4 (inicio 670, libera 690 en ZH): llegaría a S-11 a las 700 > 690.
    expect(mejorInsercion([u], calculado(4, 680, ZH, ZH), p)).toBeNull();
  });

  it('rechaza la inserción que rompería la jornada o la zona de término', () => {
    const vacia = enRol(unidad(1));
    // Libera a las 820: 820 − 240 = 580 > 570 (JORNADA).
    const tarde = calculado(1, 790, CUN, ZH);
    expect(mejorInsercion([vacia], tarde, p)).toBeNull();
    // Terminaría en Tulum a las 800 y regresaría al encierro a las 900:
    // 900 − 240 = 660 > 570 (ZONA_TERMINO).
    const aTulum = calculado(2, 700, CUN, TULUM);
    expect(mejorInsercion([vacia], aTulum, p)).toBeNull();
    // Los que no caben conservan su motivo original.
    const quedan = reinsertar(
      [vacia],
      [
        { servicio: tarde, motivo: 'JORNADA' },
        { servicio: aTulum, motivo: 'ZONA_TERMINO' },
      ],
      p,
    );
    expect(folios(quedan)).toEqual([
      ['S-2', 'ZONA_TERMINO'],
      ['S-1', 'JORNADA'],
    ]);
    expect(vacia.secuencia).toEqual([]);
  });

  it('repite pasadas: un servicio cabe solo después de insertar otro', () => {
    // Unidad con encierro en Tulum (100 min de todo lo demás).
    const u = enRol(unidad(1, { encierro: TULUM }));
    // S-1 (CUN→Centro, inicio 690, libera 730) como último servicio no cierra
    // el día: regresaría a Tulum a las 830 (830 − 240 = 590 > 570). S-2
    // (Centro→CUN, inicio 740) sí, porque termina en el aeropuerto. En la
    // primera pasada entra S-2 y en la segunda S-1 antes que S-2 (730 + 10 <= 740).
    const quedan = reinsertar(
      [u],
      [
        { servicio: calculado(1, 700, CUN, CENTRO), motivo: 'ZONA_TERMINO' },
        { servicio: calculado(2, 750, CENTRO, CUN), motivo: 'EMPALME' },
      ],
      p,
    );
    expect(quedan).toEqual([]);
    expect(u.secuencia.map((s) => s.folio)).toEqual(['S-1', 'S-2']);
  });

  it('desempate reproducible: con el mismo costo gana el menor número económico', () => {
    const doce = enRol({ ...unidad(12), numeroEconomico: 'BL-12' });
    const dos = enRol({ ...unidad(2), numeroEconomico: 'BL-2' });
    const s = calculado(1, 600);
    expect(mejorInsercion([doce, dos], s, p)?.unidad).toBe(dos);
    expect(mejorInsercion([dos, doce], s, p)?.unidad).toBe(dos);
  });

  it('secuenciaValida revisa cada servicio contra los que lo preceden', () => {
    const u = enRol(unidad(1));
    const a = calculado(1, 300, CUN, ZH);
    const b = calculado(2, 700, ZH, CUN);
    expect(secuenciaValida(u, [a, b], p)).toBe(true);
    expect(secuenciaValida(u, [b, a], p)).toBe(false);
  });

  it('generarRol recupera un servicio que la etapa voraz rechazó por una unidad que luego se vació', () => {
    // BL-01 toma S-1 (CUN→Tulum, libera 800) y por eso rechaza S-2 (EMPALME);
    // la etapa de zona de término quita S-1 (regresaría al encierro a las 900:
    // 900 − 240 > 570). La reinserción coloca S-2 en BL-01, ya vacía.
    const servicios = [servicio(1, 700, CUN, TULUM), servicio(2, 730, CUN, ZH)];
    const base = generarRolBase(servicios, [unidad(1)], p);
    expect(base.unidades[0].secuencia).toEqual([]);
    expect(folios(base.noCubiertos)).toEqual([
      ['S-2', 'EMPALME'],
      ['S-1', 'ZONA_TERMINO'],
    ]);

    const final = generarRol(servicios, [unidad(1)], p);
    expect(secuencias(final.unidades)).toEqual({ 'BL-01': ['S-2'] });
    expect(folios(final.noCubiertos)).toEqual([['S-1', 'ZONA_TERMINO']]);
  });
});

describe('crearTiempo', () => {
  it('lanza un error si falta un par de zonas en la matriz', () => {
    expect(() => crearTiempo(new Map())(1, 2)).toThrow(
      'Falta el tiempo de la zona 1 a la zona 2',
    );
  });
});
