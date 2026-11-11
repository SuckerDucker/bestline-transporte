import { calcularHoras, crearTiempo } from '../motor/algoritmo.js';
import type {
  ParametrosMotor,
  ServicioCalculado,
  UnidadEnRol,
} from '../motor/tipos.js';
import { verificarRol } from '../motor/verificador.js';
import { revisarMovimiento } from './revalidacion.js';

// Mismo escenario pequeño que las pruebas del motor (horas en minutos):
// 1 = Aeropuerto CUN y 2 = Zona Hotelera (de término), 3 = Centro (encierro),
// 4 = Tulum. 10 min en la misma zona, 100 desde o hacia Tulum, 30 entre las demás.
const CUN = 1;
const ZH = 2;
const CENTRO = 3;
const TULUM = 4;
const matriz = new Map<string, number>();
for (const o of [CUN, ZH, CENTRO, TULUM]) {
  for (const d of [CUN, ZH, CENTRO, TULUM]) {
    matriz.set(`${o}-${d}`, o === d ? 10 : o === TULUM || d === TULUM ? 100 : 30);
  }
}
const nombreZona = new Map([
  [CUN, 'Aeropuerto CUN'],
  [ZH, 'Zona Hotelera'],
  [CENTRO, 'Centro'],
  [TULUM, 'Tulum'],
]);
const p: ParametrosMotor = {
  anticipacion: { PRIVADO: 10, COMPARTIDO: 20, GRUPO: 30 },
  jornadaMaxima: 570, // 9.5 h: con cita a las 04:00 termina a las 13:30
  penalizacionCarga: 15,
  zonasTermino: new Set([CUN, ZH]),
  tiempo: crearTiempo(matriz),
};
const s = (id: number, hora: number, origen: number, destino: number, pasajeros = 4): ServicioCalculado =>
  calcularHoras([{ id, folio: `S-${id}`, hora, modalidad: 'PRIVADO', pasajeros, origen, destino }], p)[0];
const unidad = (n: number, secuencia: ServicioCalculado[], cambios: Partial<UnidadEnRol> = {}): UnidadEnRol => ({
  vehiculoId: n,
  numeroEconomico: `BL-0${n}`,
  capacidad: 14,
  operadorId: 100 + n,
  disponible: true,
  cita: 240,
  encierro: CENTRO,
  secuencia,
  ...cambios,
});

describe('revisarMovimiento', () => {
  // BL-01: S-1 (05:00, CUN→ZH, libera 05:30) y S-2 (10:00, ZH→CUN, inicio 09:50).
  // BL-02: S-3 (06:40, CUN→ZH, libera 07:10).
  const s1 = s(1, 300, CUN, ZH);
  const s2 = s(2, 600, ZH, CUN);
  const s3 = s(3, 400, CUN, ZH);

  it('acepta el servicio en su posición cronológica y lo revisa contra el anterior', () => {
    const origen = unidad(1, [s1, s2]);
    const destino = unidad(2, [s3]);
    // Desde S-3 (libera 430 en ZH) + 10 min = 440 <= 590: cabe después de S-3.
    expect(revisarMovimiento(s2, destino, origen, p, nombreZona)).toEqual({ valido: true, posicion: 1 });

    // Después de moverlo, el verificador independiente no encuentra violaciones.
    const rol = {
      asignaciones: [
        { vehiculoId: 1, servicios: [{ id: 1 }] },
        { vehiculoId: 2, servicios: [{ id: 3 }, { id: 2 }] },
      ],
      noCubiertos: [],
    };
    const datos = {
      servicios: [s1, s2, s3],
      unidades: [origen, destino],
      anticipacion: p.anticipacion,
      jornadaMaxima: p.jornadaMaxima,
      zonasTermino: p.zonasTermino,
      matriz,
    };
    expect(verificarRol(datos, rol)).toEqual([]);
  });

  it('EMPALME: revisa también al servicio siguiente del destino y dice con cuál choca', () => {
    // S-4 (10:10, inicio 10:00) sale de CUN; S-2 libera a las 10:30 en CUN.
    const destino = unidad(2, [s3, s(4, 610, CUN, ZH)]);
    expect(revisarMovimiento(s2, destino, unidad(1, [s1, s2]), p, nombreZona)).toEqual({
      valido: false,
      motivo: 'EMPALME',
      detalle: 'Empalma con el servicio S-4 de 10:10 en BL-02',
    });
  });

  it('EMPALME con el servicio anterior del destino', () => {
    // S-5 (06:50, CUN→ZH, inicio 06:40): S-3 libera a las 07:10.
    expect(revisarMovimiento(s(5, 410, CUN, ZH), unidad(2, [s3]), null, p, nombreZona)).toEqual({
      valido: false,
      motivo: 'EMPALME',
      detalle: 'Empalma con el servicio S-3 de 06:40 en BL-02',
    });
  });

  it('EMPALME desde el encierro: no alcanza a llegar con la hora de cita', () => {
    // Inicio 04:10; desde Centro a las 04:00 llega a CUN a las 04:30.
    const r = revisarMovimiento(s(6, 260, CUN, ZH), unidad(2, []), null, p, nombreZona);
    expect(r).toMatchObject({ valido: false, motivo: 'EMPALME' });
    expect(r.valido || r.detalle).toBe(
      'BL-02 no alcanza a llegar desde su encierro (Centro, cita a las 04:00) al servicio S-6 de 04:20',
    );
  });

  it('CAPACIDAD: más pasajeros que la unidad destino', () => {
    const grupo = s(7, 700, CUN, ZH, 16);
    expect(revisarMovimiento(grupo, unidad(2, []), null, p, nombreZona)).toEqual({
      valido: false,
      motivo: 'CAPACIDAD',
      detalle: 'S-7 lleva 16 pasajeros y BL-02 tiene capacidad para 14',
    });
  });

  it('JORNADA: libera después del fin de la jornada del destino', () => {
    // Libera a las 13:50; la jornada de BL-02 (cita 04:00) termina a las 13:30.
    expect(revisarMovimiento(s(8, 800, CUN, ZH), unidad(2, []), null, p, nombreZona)).toEqual({
      valido: false,
      motivo: 'JORNADA',
      detalle: 'S-8 libera a las 13:50, después del fin de la jornada de BL-02 (13:30)',
    });
  });

  it('ZONA_TERMINO en el destino: terminaría lejos sin tiempo para regresar', () => {
    // CUN→Tulum a las 11:40 libera a las 13:20; regresar a Centro: 15:00 > 13:30.
    const r = revisarMovimiento(s(9, 700, CUN, TULUM), unidad(2, []), null, p, nombreZona);
    expect(r).toEqual({
      valido: false,
      motivo: 'ZONA_TERMINO',
      detalle:
        'BL-02 terminaría el día en Tulum a las 13:20 y no alcanza a regresar a su encierro (Centro) antes de las 13:30',
    });
  });

  it('ZONA_TERMINO en el origen: su nuevo último servicio no cierra bien el día', () => {
    // BL-01 tiene su encierro en Tulum. S-10 (CUN→Centro) libera a las 12:10 y
    // regresar a Tulum toma 100 min (13:50 > 13:30); S-11 (Centro→CUN) sí cierra.
    const s10 = s(10, 700, CUN, CENTRO);
    const s11 = s(11, 750, CENTRO, CUN);
    const origen = unidad(1, [s10, s11], { encierro: TULUM });
    expect(revisarMovimiento(s11, unidad(2, []), origen, p, nombreZona)).toEqual({
      valido: false,
      motivo: 'ZONA_TERMINO',
      detalle:
        'Al quitarlo de BL-01: BL-01 terminaría el día en Centro a las 12:10 y no alcanza a regresar a su encierro (Tulum) antes de las 13:30',
    });
  });

  it('DISPONIBILIDAD: la unidad destino no participa', () => {
    const r = revisarMovimiento(s2, unidad(2, [], { disponible: false }), null, p, nombreZona);
    expect(r).toMatchObject({ valido: false, motivo: 'DISPONIBILIDAD' });
  });

  it('EMPALME en el origen: al quitar uno, los que quedan se empalman entre sí', () => {
    // Matriz sin desigualdad triangular: ZH → Tulum directo tarda 300 min,
    // pero pasando por CUN (S-13) sí da tiempo.
    const rara = new Map(matriz);
    rara.set(`${ZH}-${TULUM}`, 300);
    const q = { ...p, tiempo: crearTiempo(rara) };
    const a = calcularHoras([{ id: 12, folio: 'S-12', hora: 300, modalidad: 'PRIVADO', pasajeros: 4, origen: CUN, destino: ZH }], q)[0];
    const b = calcularHoras([{ id: 13, folio: 'S-13', hora: 360, modalidad: 'PRIVADO', pasajeros: 4, origen: ZH, destino: CUN }], q)[0];
    const c = calcularHoras([{ id: 14, folio: 'S-14', hora: 500, modalidad: 'PRIVADO', pasajeros: 4, origen: TULUM, destino: CUN }], q)[0];
    const origen = unidad(1, [a, b, c]);
    expect(revisarMovimiento(b, unidad(2, []), origen, q, nombreZona)).toEqual({
      valido: false,
      motivo: 'EMPALME',
      detalle: 'Al quitarlo de BL-01: el servicio S-12 de 05:00 y el servicio S-14 de 08:20 se empalmarían en BL-01',
    });
  });
});
