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

/** La fila de encabezados es la que contiene este texto (antes puede haber filas de título). */
export const ENCABEZADO_ANCLA: Encabezado = 'Folio';
/** Filas que se revisan para encontrar los encabezados. */
export const FILAS_MAXIMAS_ANTES_DE_ENCABEZADOS = 20;

/** Zona del aeropuerto para LLEGADA (origen) y SALIDA (destino). */
export const ZONA_AEROPUERTO = 'Aeropuerto CUN';

/**
 * SUPUESTO POR CONFIRMAR CON LA EMPRESA: si "Tipo de Servicio" no trae la
 * modalidad, se asume COMPARTIDO y la fila queda como ADVERTENCIA.
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
 * Origen y destino según el sentido:
 * - LLEGADA: aeropuerto → zona del hotel.
 * - SALIDA: zona del hotel → aeropuerto.
 * - TRASLADO: zona del hotel → zona del hotel (SUPUESTO POR CONFIRMAR: el
 *   layout no trae una segunda zona).
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
