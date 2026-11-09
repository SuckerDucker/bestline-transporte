import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { ErrorArchivo, leerArchivo } from './lectura.js';
import {
  interpretarAeropuerto,
  interpretarTipo,
  normalizar,
  rutaDelServicio,
} from './mapeo.js';
import {
  type Catalogos,
  contarFilas,
  indexarPorNombre,
  procesarFilas,
} from './procesar-filas.js';

// Jest corre desde apps/api; los ejemplos están en docs/ejemplos.
const ejemplo = (nombre: string) =>
  readFileSync(resolve(process.cwd(), '../../docs/ejemplos', nombre));

/** Catálogos como los del seed (zonas, mayoristas y los hoteles del layout). */
const ZONAS = [
  'Aeropuerto CUN',
  'Zona Hotelera',
  'Centro Cancún',
  'Costa Mujeres',
  'Puerto Morelos',
  'Playa del Carmen',
  'Tulum',
  'Aeropuerto TQO',
];
const HOTELES = [
  'Planet Hollywood Cancun',
  'TRS Coral Hotel',
  'Grand Velas Riviera Maya',
  'Hotel Xcaret Arte',
  'Barceló Maya Palace',
  'Iberostar Selection Cancun',
  'Hard Rock Hotel Cancun',
  'Moon Palace Sunrise',
];
const lista = (nombres: string[]) =>
  nombres.map((nombre, i) => ({ id: i + 1, nombre }));
const catalogos: Catalogos = {
  zonas: indexarPorNombre(lista(ZONAS)),
  hoteles: indexarPorNombre(lista(HOTELES)),
  mayoristas: indexarPorNombre([
    { id: 1, nombre: 'TUI' },
    { id: 2, nombre: 'Nexus Tours' },
  ]),
};
const ID_AEROPUERTO = 1;
const ID_COSTA_MUJERES = 4;

const ENCABEZADOS =
  'Folio,Localizador,Agencia,Fecha,Tipo de Servicio,Pasajeros,Hotel,Zona,Vuelo,Hora';
const csv = (...filas: string[]) =>
  Buffer.from([ENCABEZADOS, ...filas].join('\n'));
const FILA_BUENA =
  'NX-1,LOC-1,Nexus Tours,05/11/2026,LLEGADA PRIVADO,4,TRS Coral Hotel,Costa Mujeres,AM100,06:15';
/** Procesa un CSV de prueba y devuelve la primera fila. */
const procesarUna = (fila: string, existentes = new Set<string>()) =>
  procesarFilas(leerArchivo(csv(fila), 'prueba.csv'), catalogos, existentes)[0];

describe('Archivo de ejemplo de la empresa (Layout_Servicios_Nexus)', () => {
  it.each(['Layout_Servicios_Nexus.xlsx', 'Layout_Servicios_Nexus.csv'])(
    '%s: 65 filas, 2 duplicadas, 5 con error y 28 advertencias de modalidad',
    (archivo) => {
      const filas = leerArchivo(ejemplo(archivo), archivo);
      // Los encabezados están en la fila 4 (antes hay 3 de título).
      expect(filas[0].numero).toBe(5);
      const procesadas = procesarFilas(filas, catalogos, new Set());

      expect(contarFilas(procesadas)).toEqual({
        total: 65,
        validas: 30,
        advertencias: 28,
        duplicadas: 2,
        errores: 5,
        importables: 58,
        rechazadas: 7,
      });
      const conMensaje = (texto: string) =>
        procesadas.filter((f) => f.mensajes.some((m) => m.startsWith(texto)));
      expect(conMensaje('Zona no indicada')).toHaveLength(3);
      expect(conMensaje('Zona no registrada en el catálogo')).toHaveLength(2);
      // Las 28 advertencias de modalidad de las filas importables (las filas
      // con error o duplicadas también muestran el aviso, pero no se importan).
      expect(
        conMensaje('Modalidad no indicada; se asumió COMPARTIDO').filter(
          (f) => f.estado === 'ADVERTENCIA',
        ),
      ).toHaveLength(28);
      expect(
        procesadas
          .filter((f) => f.estado === 'DUPLICADA')
          .map((f) => f.valores.Folio),
      ).toEqual(['NX-15011', 'NX-15044']);
    },
  );

  it('el Excel y el CSV producen los mismos servicios', () => {
    const servicios = (archivo: string) =>
      procesarFilas(
        leerArchivo(ejemplo(archivo), archivo),
        catalogos,
        new Set(),
      )
        .filter((f) => f.servicio)
        .map((f) => f.servicio);
    expect(servicios('Layout_Servicios_Nexus.xlsx')).toEqual(
      servicios('Layout_Servicios_Nexus.csv'),
    );
  });

  it('convierte la primera fila: SALIDA COMPARTIDO de Costa Mujeres al aeropuerto, 06:15 de Cancún', () => {
    const [primera] = procesarFilas(
      leerArchivo(ejemplo('Layout_Servicios_Nexus.xlsx'), 'x.xlsx'),
      catalogos,
      new Set(),
    );
    expect(primera).toMatchObject({ fila: 5, estado: 'VALIDA', mensajes: [] });
    expect(primera.servicio).toEqual({
      mayoristaId: 2,
      folio: 'NX-15001',
      localizador: 'LOC85001A',
      tipo: 'SALIDA',
      modalidad: 'COMPARTIDO',
      fechaHora: new Date('2026-11-05T11:15:00.000Z'),
      pasajeros: 2,
      zonaOrigenId: ID_COSTA_MUJERES,
      zonaDestinoId: ID_AEROPUERTO,
      hotelId: 1,
      vuelo: 'AM691',
    });
  });
});

describe('Lectura del archivo', () => {
  it('400 si falta un encabezado, con la lista de faltantes', () => {
    const sinZonaNiHora = Buffer.from(
      'Folio,Localizador,Agencia,Fecha,Tipo de Servicio,Pasajeros,Hotel,Vuelo\n',
    );
    let error: unknown;
    try {
      leerArchivo(sinZonaNiHora, 'prueba.csv');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorArchivo);
    expect((error as ErrorArchivo).faltantes).toEqual(['Zona', 'Hora']);
    expect((error as ErrorArchivo).message).toBe(
      'Faltan encabezados: Zona, Hora',
    );
  });

  it('rechaza extensiones que no sean .xlsx o .csv', () => {
    expect(() => leerArchivo(Buffer.from('x'), 'servicios.pdf')).toThrow(
      'Solo se aceptan archivos .xlsx o .csv',
    );
  });

  it('sin la fila de "Folio" avisa que no encontró los encabezados', () => {
    expect(() =>
      leerArchivo(Buffer.from('a,b,c\n1,2,3'), 'prueba.csv'),
    ).toThrow('No se encontró la fila de encabezados');
  });

  it('lee por nombre de encabezado aunque cambie el orden de las columnas', () => {
    const desordenado = Buffer.from(
      'Hora,Zona,Folio,Localizador,Agencia,Fecha,Tipo de Servicio,Pasajeros,Hotel,Vuelo\n' +
        '06:15,Costa Mujeres,NX-9,LOC-9,Nexus Tours,05/11/2026,SALIDA,2,TRS Coral Hotel,AM1',
    );
    const [fila] = leerArchivo(desordenado, 'prueba.csv');
    expect(fila.valores).toMatchObject({
      Folio: 'NX-9',
      Zona: 'Costa Mujeres',
      Hora: '06:15',
    });
  });

  it('acepta fecha y hora guardadas como fecha real de Excel', () => {
    // Excel guarda las fechas como días desde el 30/12/1899 (sin zona horaria).
    const SERIE_5_NOV_2026 =
      (Date.UTC(2026, 10, 5) - Date.UTC(1899, 11, 30)) / 86_400_000;
    const hoja = XLSX.utils.aoa_to_sheet([
      ENCABEZADOS.split(','),
      [
        'NX-2',
        'LOC-2',
        'Nexus Tours',
        SERIE_5_NOV_2026,
        'LLEGADA',
        3,
        'TRS Coral Hotel',
        'Costa Mujeres',
        'AM2',
        0.5,
      ],
    ]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Servicios');
    const contenido = XLSX.write(libro, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    const [fila] = leerArchivo(contenido, 'prueba.xlsx');
    expect(fila.valores).toMatchObject({
      Fecha: '05/11/2026',
      Hora: '12:00',
      Pasajeros: '3',
    });
  });

  it('un archivo que no es Excel responde con un error claro', () => {
    expect(() => leerArchivo(Buffer.from([1, 2, 3, 4]), 'roto.xlsx')).toThrow(
      ErrorArchivo,
    );
  });
});

describe('Validación de cada fila', () => {
  it('una fila completa y correcta es VALIDA', () => {
    expect(procesarUna(FILA_BUENA)).toMatchObject({
      estado: 'VALIDA',
      mensajes: [],
    });
  });

  it('fecha inválida (31 de febrero) → ERROR', () => {
    const fila = procesarUna(FILA_BUENA.replace('05/11/2026', '31/02/2026'));
    expect(fila.estado).toBe('ERROR');
    expect(fila.mensajes).toContain(
      'Fecha inválida: "31/02/2026" (formato dd/mm/aaaa)',
    );
    expect(fila.servicio).toBeNull();
  });

  it('hora inválida → ERROR', () => {
    expect(
      procesarUna(FILA_BUENA.replace('06:15', '25:00')).mensajes,
    ).toContain('Hora inválida: "25:00" (formato HH:mm)');
  });

  it.each(['0', '-2', '2.5', 'dos'])('pasajeros "%s" → ERROR', (pasajeros) => {
    const fila = procesarUna(FILA_BUENA.replace(',4,', `,${pasajeros},`));
    expect(fila.estado).toBe('ERROR');
    expect(fila.mensajes).toContain(
      'Pasajeros debe ser un número entero mayor que 0',
    );
  });

  it('tipo de servicio que no encaja → ERROR', () => {
    const fila = procesarUna(
      FILA_BUENA.replace('LLEGADA PRIVADO', 'TOUR PRIVADO'),
    );
    expect(fila.estado).toBe('ERROR');
    expect(fila.mensajes[0]).toMatch(
      /^Tipo de servicio no reconocido: "TOUR PRIVADO"/,
    );
  });

  it('duplicado contra la base → DUPLICADA', () => {
    const fila = procesarUna(FILA_BUENA, new Set(['NX-1|LOC-1']));
    expect(fila.estado).toBe('DUPLICADA');
    expect(fila.mensajes).toEqual([
      'Ya existe en la base un servicio con ese folio y localizador',
    ]);
    expect(fila.servicio).toBeNull();
  });

  it('obligatorios, largos y agencia desconocida', () => {
    const fila = procesarUna(
      `${'F'.repeat(31)},,Agencia X,05/11/2026,SALIDA,2,,Costa Mujeres,${'V'.repeat(16)},06:15`,
    );
    expect(fila.estado).toBe('ERROR');
    expect(fila.mensajes).toEqual(
      expect.arrayContaining([
        'Localizador es obligatorio',
        'Hotel es obligatorio',
        'Folio supera 30 caracteres',
        'Vuelo supera 15 caracteres',
        'Agencia "Agencia X" no registrada como mayorista',
      ]),
    );
  });

  it('hotel no registrado y LLEGADA sin vuelo → ADVERTENCIA con hotel nulo', () => {
    const fila = procesarUna(
      FILA_BUENA.replace('TRS Coral Hotel', 'Hotel Nuevo').replace(
        'AM100',
        '—',
      ),
    );
    expect(fila.estado).toBe('ADVERTENCIA');
    expect(fila.mensajes).toEqual([
      'Hotel no registrado en el catálogo',
      'Vuelo no indicado',
    ]);
    expect(fila.servicio).toMatchObject({ hotelId: null, vuelo: null });
  });

  it('una fila con error no "ocupa" el folio: la siguiente igual sí se importa', () => {
    const filas = procesarFilas(
      leerArchivo(csv(FILA_BUENA.replace(',4,', ',0,'), FILA_BUENA), 'p.csv'),
      catalogos,
      new Set(),
    );
    expect(filas.map((f) => f.estado)).toEqual(['ERROR', 'VALIDA']);
  });
});

describe('Columna opcional Aeropuerto (o Terminal)', () => {
  const ID_TULUM = 7;
  const ID_AEROPUERTO_TQO = 8;
  /** Una fila a Tulum con la columna de aeropuerto indicada (o sin ella). */
  const filaTulum = (tipo: string, columna?: string, valor = '') => {
    const encabezados = columna ? `${ENCABEZADOS},${columna}` : ENCABEZADOS;
    const fila = `NX-7,LOC-7,Nexus Tours,05/11/2026,${tipo},2,TRS Coral Hotel,Tulum,AM7,10:00`;
    const contenido = Buffer.from(
      `${encabezados}
${columna ? `${fila},${valor}` : fila}`,
    );
    return procesarFilas(
      leerArchivo(contenido, 'prueba.csv'),
      catalogos,
      new Set(),
    )[0];
  };

  it('LLEGADA a Tulum sin la columna → sale del Aeropuerto CUN', () => {
    const fila = filaTulum('LLEGADA PRIVADO');
    expect(fila.estado).toBe('VALIDA');
    expect(fila.valores.Aeropuerto).toBe('');
    expect(fila.servicio).toMatchObject({
      zonaOrigenId: ID_AEROPUERTO,
      zonaDestinoId: ID_TULUM,
    });
  });

  it('LLEGADA a Tulum con "tqo" → sale del Aeropuerto TQO', () => {
    const fila = filaTulum('LLEGADA PRIVADO', 'Aeropuerto', 'tqo');
    expect(fila.estado).toBe('VALIDA');
    expect(fila.servicio).toMatchObject({
      zonaOrigenId: ID_AEROPUERTO_TQO,
      zonaDestinoId: ID_TULUM,
    });
  });

  it('SALIDA con TQO (encabezado "Terminal") → termina en el Aeropuerto TQO', () => {
    const fila = filaTulum('SALIDA GRUPO', 'Terminal', 'TQO');
    expect(fila.servicio).toMatchObject({
      zonaOrigenId: ID_TULUM,
      zonaDestinoId: ID_AEROPUERTO_TQO,
    });
  });

  it('con la columna vacía o con "—" se usa CUN', () => {
    for (const valor of ['', '—']) {
      expect(
        filaTulum('LLEGADA PRIVADO', 'Aeropuerto', valor).servicio,
      ).toMatchObject({ zonaOrigenId: ID_AEROPUERTO });
    }
  });

  it('un valor que no es CUN ni TQO → ERROR', () => {
    const fila = filaTulum('LLEGADA PRIVADO', 'Aeropuerto', 'MEX');
    expect(fila.estado).toBe('ERROR');
    expect(fila.mensajes).toEqual(['Aeropuerto no válido (CUN o TQO)']);
    expect(fila.servicio).toBeNull();
  });

  it('en un TRASLADO el aeropuerto no cambia la ruta (zona indicada → misma zona)', () => {
    expect(
      filaTulum('TRASLADO PRIVADO', 'Aeropuerto', 'TQO').servicio,
    ).toMatchObject({
      zonaOrigenId: ID_TULUM,
      zonaDestinoId: ID_TULUM,
    });
  });

  it.each([
    ['CUN', 'CUN'],
    ['tqo', 'TQO'],
    [' Tqo ', 'TQO'],
    ['', 'CUN'],
    ['N/A', 'CUN'],
    ['MEX', null],
    ['Aeropuerto CUN', null],
  ])('interpretarAeropuerto("%s") → %s', (texto, esperado) => {
    expect(interpretarAeropuerto(texto)).toBe(esperado);
  });
});

describe('Reglas de mapeo', () => {
  it.each([
    ['SALIDA COMPARTIDO', 'SALIDA', 'COMPARTIDO', false],
    ['llegada privado', 'LLEGADA', 'PRIVADO', false],
    ['  Traslado   Grupo ', 'TRASLADO', 'GRUPO', false],
    ['LLEGADA', 'LLEGADA', 'COMPARTIDO', true],
  ])(
    '"%s" → %s %s (asumida: %s)',
    (texto, tipo, modalidad, modalidadAsumida) => {
      expect(interpretarTipo(texto)).toEqual({
        tipo,
        modalidad,
        modalidadAsumida,
      });
    },
  );

  it.each(['TOUR', 'SALIDA VIP', 'COMPARTIDO SALIDA', ''])(
    '"%s" no encaja',
    (texto) => {
      expect(interpretarTipo(texto)).toBeNull();
    },
  );

  it('normaliza sin acentos ni mayúsculas', () => {
    expect(normalizar('  Centro  CANCÚN ')).toBe('centro cancun');
  });

  it('origen y destino según el sentido', () => {
    expect(rutaDelServicio('LLEGADA', 4, 1)).toEqual({
      zonaOrigenId: 1,
      zonaDestinoId: 4,
    });
    expect(rutaDelServicio('SALIDA', 4, 1)).toEqual({
      zonaOrigenId: 4,
      zonaDestinoId: 1,
    });
    expect(rutaDelServicio('TRASLADO', 4, 1)).toEqual({
      zonaOrigenId: 4,
      zonaDestinoId: 4,
    });
  });
});
