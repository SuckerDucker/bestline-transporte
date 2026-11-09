import { ModalidadServicio, TipoServicio } from '../generated/prisma/enums.js';

/**
 * Reglas de mapeo del layout de los mayoristas, reunidas en un solo lugar para
 * poder ajustarlas cuando la empresa confirme los supuestos.
 */

/** Encabezados obligatorios del layout (se leen por nombre, no por posición). */
export const ENCABEZADOS = [
  'Folio',
  'Localizador',
  'Agencia',
  'Fecha',
  'Tipo de Servicio',
  'Pasajeros',
  'Hotel',
  'Zona',
  'Vuelo',
  'Hora',
] as const;
export type Encabezado = (typeof ENCABEZADOS)[number];

/**
 * Columnas opcionales: si el archivo no las trae, la fila las recibe vacías.
 * Cada una acepta varios nombres de encabezado.
 */
export const ENCABEZADOS_OPCIONALES = {
  Aeropuerto: ['Aeropuerto', 'Terminal'],
} as const;
export type EncabezadoOpcional = keyof typeof ENCABEZADOS_OPCIONALES;
/** Todas las columnas que se leen de cada fila. */
export type Columna = Encabezado | EncabezadoOpcional;

/** La fila de encabezados es la que contiene este texto (antes puede haber filas de título). */
export const ENCABEZADO_ANCLA: Encabezado = 'Folio';
/** Filas que se revisan para encontrar los encabezados. */
export const FILAS_MAXIMAS_ANTES_DE_ENCABEZADOS = 20;

/**
 * Aeropuertos que acepta la columna opcional "Aeropuerto" (o "Terminal") y la
 * zona del catálogo que corresponde a cada uno. LLEGADA sale de esa zona y
 * SALIDA termina en ella.
 */
export const ZONAS_AEROPUERTO = {
  CUN: 'Aeropuerto CUN',
  TQO: 'Aeropuerto TQO',
} as const;
export type Aeropuerto = keyof typeof ZONAS_AEROPUERTO;

/**
 * REGLA CONFIRMADA CON LA EMPRESA: LLEGADA y SALIDA usan el Aeropuerto CUN
 * cuando el archivo no indica el aeropuerto.
 */
export const AEROPUERTO_POR_OMISION: Aeropuerto = 'CUN';

/**
 * REGLA CONFIRMADA CON LA EMPRESA: si "Tipo de Servicio" no trae la
 * modalidad, se importa como COMPARTIDO y la fila queda como ADVERTENCIA.
 */
export const MODALIDAD_POR_OMISION: ModalidadServicio =
  ModalidadServicio.COMPARTIDO;

/** Textos que el layout usa para "sin dato". */
export const VALORES_VACIOS = ['', '—', '–', '-', 'N/A'];

/** Tamaños de las columnas de la tabla servicio. */
export const LARGO_MAXIMO = { folio: 30, localizador: 30, vuelo: 15 } as const;

/** Minúsculas, sin acentos y con un solo espacio: "  Zona  Hotelera " → "zona hotelera". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const esVacio = (texto: string) =>
  VALORES_VACIOS.some((v) => normalizar(v) === normalizar(texto));

export interface TipoInterpretado {
  tipo: TipoServicio;
  modalidad: ModalidadServicio;
  /** true si el archivo no traía la modalidad y se usó MODALIDAD_POR_OMISION. */
  modalidadAsumida: boolean;
}

/**
 * "Tipo de Servicio" = sentido + modalidad opcional, sin distinguir mayúsculas
 * ni acentos: "SALIDA COMPARTIDO", "llegada privado", "TRASLADO".
 * Devuelve null si el texto no encaja.
 */
export function interpretarTipo(texto: string): TipoInterpretado | null {
  const partes =
    /^(llegada|salida|traslado)(?: (privado|compartido|grupo))?$/.exec(
      normalizar(texto),
    );
  if (!partes) return null;
  const [, sentido, modalidad] = partes;
  return {
    tipo: sentido.toUpperCase() as TipoServicio,
    modalidad: modalidad
      ? (modalidad.toUpperCase() as ModalidadServicio)
      : MODALIDAD_POR_OMISION,
    modalidadAsumida: !modalidad,
  };
}

/**
 * Columna "Aeropuerto": CUN o TQO sin distinguir mayúsculas. Vacía (o sin la
 * columna) → AEROPUERTO_POR_OMISION. Cualquier otro valor → null (error de fila).
 */
export function interpretarAeropuerto(texto: string): Aeropuerto | null {
  if (esVacio(texto)) return AEROPUERTO_POR_OMISION;
  const codigo = texto.trim().toUpperCase();
  return Object.hasOwn(ZONAS_AEROPUERTO, codigo)
    ? (codigo as Aeropuerto)
    : null;
}

/**
 * Origen y destino según el sentido:
 * - LLEGADA: aeropuerto → zona del hotel.
 * - SALIDA: zona del hotel → aeropuerto.
 * - TRASLADO: zona indicada → la misma zona (REGLA CONFIRMADA CON LA EMPRESA:
 *   el layout no trae una segunda zona).
 */
export function rutaDelServicio(
  tipo: TipoServicio,
  zonaHotelId: number,
  aeropuertoId: number,
): { zonaOrigenId: number; zonaDestinoId: number } {
  if (tipo === TipoServicio.LLEGADA) {
    return { zonaOrigenId: aeropuertoId, zonaDestinoId: zonaHotelId };
  }
  if (tipo === TipoServicio.SALIDA) {
    return { zonaOrigenId: zonaHotelId, zonaDestinoId: aeropuertoId };
  }
  return { zonaOrigenId: zonaHotelId, zonaDestinoId: zonaHotelId };
}
