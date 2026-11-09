import type {
  ModalidadServicio,
  TipoServicio,
} from '../generated/prisma/enums.js';
import { instanteCancun } from '../comun/fechas.js';
import type { Encabezado } from './mapeo.js';
import {
  esVacio,
  interpretarTipo,
  LARGO_MAXIMO,
  normalizar,
  rutaDelServicio,
  ZONA_AEROPUERTO,
} from './mapeo.js';
import type { FilaArchivo } from './lectura.js';

export const ESTADOS_FILA = [
  'VALIDA',
  'ADVERTENCIA',
  'DUPLICADA',
  'ERROR',
] as const;
export type EstadoFila = (typeof ESTADOS_FILA)[number];

interface Registro {
  id: number;
  nombre: string;
}

/** Catálogos indexados por nombre normalizado (sin mayúsculas ni acentos). */
export interface Catalogos {
  mayoristas: Map<string, Registro>;
  zonas: Map<string, Registro>;
  hoteles: Map<string, Registro>;
}

/** Datos listos para crear el servicio (solo en filas VALIDA o ADVERTENCIA). */
export interface ServicioNuevo {
  mayoristaId: number;
  folio: string;
  localizador: string;
  tipo: TipoServicio;
  modalidad: ModalidadServicio;
  fechaHora: Date;
  pasajeros: number;
  zonaOrigenId: number;
  zonaDestinoId: number;
  hotelId: number | null;
  vuelo: string | null;
}

export interface FilaProcesada {
  /** Número de fila en el archivo. */
  fila: number;
  estado: EstadoFila;
  mensajes: string[];
  valores: Record<Encabezado, string>;
  servicio: ServicioNuevo | null;
}

/** Arma un catálogo indexado por nombre normalizado. */
export const indexarPorNombre = (registros: Registro[]) =>
  new Map(registros.map((r) => [normalizar(r.nombre), r]));

/** Llave de duplicados: folio + localizador (la misma de la restricción única). */
export const claveServicio = (folio: string, localizador: string) =>
  `${folio}|${localizador}`;

/**
 * Valida y convierte cada fila. El estado se decide por prioridad:
 * ERROR (algún dato inválido) > DUPLICADA (folio + localizador repetido en el
 * archivo o ya en la base) > ADVERTENCIA (se importa con un aviso) > VALIDA.
 */
export function procesarFilas(
  filas: FilaArchivo[],
  catalogos: Catalogos,
  existentesEnBase: Set<string>,
): FilaProcesada[] {
  // Primera fila importable de cada folio + localizador dentro del archivo.
  const vistas = new Map<string, number>();
  return filas.map(({ numero, valores }) => {
    const errores: string[] = [];
    const advertencias: string[] = [];
    const servicio = convertirFila(valores, catalogos, errores, advertencias);

    let estado: EstadoFila = 'VALIDA';
    if (errores.length || !servicio) {
      estado = 'ERROR';
    } else {
      const clave = claveServicio(servicio.folio, servicio.localizador);
      if (existentesEnBase.has(clave)) {
        estado = 'DUPLICADA';
        errores.push(
          'Ya existe en la base un servicio con ese folio y localizador',
        );
      } else if (vistas.has(clave)) {
        estado = 'DUPLICADA';
        errores.push(
          `Folio y localizador repetidos en el archivo (fila ${vistas.get(clave)})`,
        );
      } else {
        vistas.set(clave, numero);
        if (advertencias.length) estado = 'ADVERTENCIA';
      }
    }
    const importable = estado === 'VALIDA' || estado === 'ADVERTENCIA';
    return {
      fila: numero,
      estado,
      mensajes: [...errores, ...advertencias],
      valores,
      servicio: importable ? servicio : null,
    };
  });
}

const OBLIGATORIOS: Encabezado[] = [
  'Folio',
  'Localizador',
  'Agencia',
  'Fecha',
  'Tipo de Servicio',
  'Pasajeros',
  'Hotel',
  'Hora',
];

/** Convierte una fila; deja en `errores` y `advertencias` lo que encuentre. */
function convertirFila(
  v: Record<Encabezado, string>,
  catalogos: Catalogos,
  errores: string[],
  advertencias: string[],
): ServicioNuevo | null {
  for (const campo of OBLIGATORIOS) {
    if (esVacio(v[campo])) errores.push(`${campo} es obligatorio`);
  }
  const vacio = (campo: Encabezado) => esVacio(v[campo]);

  if (v.Folio.length > LARGO_MAXIMO.folio) {
    errores.push(`Folio supera ${LARGO_MAXIMO.folio} caracteres`);
  }
  if (v.Localizador.length > LARGO_MAXIMO.localizador) {
    errores.push(`Localizador supera ${LARGO_MAXIMO.localizador} caracteres`);
  }

  const fecha = vacio('Fecha') ? null : leerFecha(v.Fecha);
  if (!vacio('Fecha') && !fecha) {
    errores.push(`Fecha inválida: "${v.Fecha}" (formato dd/mm/aaaa)`);
  }
  const hora = vacio('Hora') ? null : leerHora(v.Hora);
  if (!vacio('Hora') && !hora) {
    errores.push(`Hora inválida: "${v.Hora}" (formato HH:mm)`);
  }

  const pasajeros = /^\d+$/.test(v.Pasajeros) ? Number(v.Pasajeros) : NaN;
  if (!vacio('Pasajeros') && !(pasajeros > 0)) {
    errores.push('Pasajeros debe ser un número entero mayor que 0');
  }

  const tipo = vacio('Tipo de Servicio')
    ? null
    : interpretarTipo(v['Tipo de Servicio']);
  if (!vacio('Tipo de Servicio') && !tipo) {
    errores.push(
      `Tipo de servicio no reconocido: "${v['Tipo de Servicio']}" (LLEGADA, SALIDA o TRASLADO y opcionalmente PRIVADO, COMPARTIDO o GRUPO)`,
    );
  }
  if (tipo?.modalidadAsumida) {
    advertencias.push(`Modalidad no indicada; se asumió ${tipo.modalidad}`);
  }

  const mayorista = vacio('Agencia')
    ? undefined
    : catalogos.mayoristas.get(normalizar(v.Agencia));
  if (!vacio('Agencia') && !mayorista) {
    errores.push(`Agencia "${v.Agencia}" no registrada como mayorista`);
  }

  let zona: Registro | undefined;
  if (vacio('Zona')) {
    errores.push('Zona no indicada');
  } else {
    zona = catalogos.zonas.get(normalizar(v.Zona));
    if (!zona) errores.push(`Zona no registrada en el catálogo: "${v.Zona}"`);
  }
  const aeropuerto = catalogos.zonas.get(normalizar(ZONA_AEROPUERTO));
  if (tipo && tipo.tipo !== 'TRASLADO' && !aeropuerto) {
    errores.push(`La zona "${ZONA_AEROPUERTO}" no está en el catálogo`);
  }

  const hotel = vacio('Hotel')
    ? undefined
    : catalogos.hoteles.get(normalizar(v.Hotel));
  if (!vacio('Hotel') && !hotel) {
    advertencias.push('Hotel no registrado en el catálogo');
  }

  const vuelo = vacio('Vuelo') ? null : v.Vuelo;
  if (vuelo && vuelo.length > LARGO_MAXIMO.vuelo) {
    errores.push(`Vuelo supera ${LARGO_MAXIMO.vuelo} caracteres`);
  }
  // SUPUESTO POR CONFIRMAR: una LLEGADA o SALIDA normalmente trae vuelo.
  if (!vuelo && tipo && tipo.tipo !== 'TRASLADO') {
    advertencias.push('Vuelo no indicado');
  }

  if (errores.length || !tipo || !zona || !mayorista || !fecha || !hora) {
    return null;
  }
  return {
    mayoristaId: mayorista.id,
    folio: v.Folio,
    localizador: v.Localizador,
    tipo: tipo.tipo,
    modalidad: tipo.modalidad,
    fechaHora: instanteCancun(fecha, hora),
    pasajeros,
    ...rutaDelServicio(tipo.tipo, zona.id, aeropuerto?.id ?? zona.id),
    hotelId: hotel?.id ?? null,
    vuelo,
  };
}

/** "05/11/2026" → "2026-11-05", o null si no es una fecha real. */
function leerFecha(texto: string): string | null {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  if (!partes) return null;
  const [, d, m, a] = partes.map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  const valida =
    fecha.getUTCFullYear() === a &&
    fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d;
  const dos = (n: number) => String(n).padStart(2, '0');
  return valida ? `${a}-${dos(m)}-${dos(d)}` : null;
}

/** "6:15" o "06:15" → "06:15", o null si no es una hora válida. */
function leerHora(texto: string): string | null {
  const partes = /^(\d{1,2}):(\d{2})$/.exec(texto);
  if (!partes) return null;
  const [h, m] = [Number(partes[1]), Number(partes[2])];
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${partes[2]}`;
}

/** Contadores de la vista previa. */
export function contarFilas(filas: FilaProcesada[]) {
  const cuenta = (estado: EstadoFila) =>
    filas.filter((f) => f.estado === estado).length;
  const validas = cuenta('VALIDA');
  const advertencias = cuenta('ADVERTENCIA');
  return {
    total: filas.length,
    validas,
    advertencias,
    duplicadas: cuenta('DUPLICADA'),
    errores: cuenta('ERROR'),
    /** VALIDA + ADVERTENCIA: las que se guardan al confirmar. */
    importables: validas + advertencias,
    /** ERROR + DUPLICADA: las que no se guardan. */
    rechazadas: filas.length - validas - advertencias,
  };
}
