import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  type Columna,
  ENCABEZADO_ANCLA,
  ENCABEZADOS,
  ENCABEZADOS_OPCIONALES,
  type EncabezadoOpcional,
  FILAS_MAXIMAS_ANTES_DE_ENCABEZADOS,
  normalizar,
} from './mapeo.js';

/** Una fila de datos del archivo, con sus valores por nombre de encabezado. */
export interface FilaArchivo {
  /** Número de fila en el archivo (como lo ve el usuario en Excel). */
  numero: number;
  /** Valores por columna; las opcionales que no vienen en el archivo quedan vacías. */
  valores: Record<Columna, string>;
}

/** Problema con el archivo completo (no con una fila). Se responde como 400. */
export class ErrorArchivo extends Error {
  constructor(
    mensaje: string,
    readonly faltantes: string[] = [],
  ) {
    super(mensaje);
  }
}

export const EXTENSIONES = ['.xlsx', '.csv'] as const;

/**
 * Lee un .xlsx (SheetJS) o un .csv (PapaParse) con el layout de la empresa.
 * Busca la fila de encabezados (la que contiene "Folio"), revisa que estén
 * todos y devuelve las filas de datos no vacías.
 */
export function leerArchivo(contenido: Buffer, nombre: string): FilaArchivo[] {
  const extension = nombre.slice(nombre.lastIndexOf('.')).toLowerCase();
  if (!(EXTENSIONES as readonly string[]).includes(extension)) {
    throw new ErrorArchivo('Solo se aceptan archivos .xlsx o .csv');
  }
  const celdas: unknown[][] =
    extension === '.csv' ? leerCsv(contenido) : leerXlsx(contenido);

  const indiceEncabezados = celdas
    .slice(0, FILAS_MAXIMAS_ANTES_DE_ENCABEZADOS)
    .findIndex((fila) =>
      fila.some((c) => normalizar(aTexto(c)) === normalizar(ENCABEZADO_ANCLA)),
    );
  if (indiceEncabezados < 0) {
    throw new ErrorArchivo(
      `No se encontró la fila de encabezados (debe contener "${ENCABEZADO_ANCLA}")`,
      [...ENCABEZADOS],
    );
  }

  // Columna de cada encabezado, buscada por nombre (sin mayúsculas ni acentos).
  const nombres = celdas[indiceEncabezados].map((c) => normalizar(aTexto(c)));
  const columna = new Map<Columna, number>(
    ENCABEZADOS.map((e) => [e, nombres.indexOf(normalizar(e))]),
  );
  const faltantes = ENCABEZADOS.filter((e) => columna.get(e) === -1);
  // Opcionales: la primera de sus variantes que aparezca ("Aeropuerto" o "Terminal").
  for (const [opcional, variantes] of Object.entries(ENCABEZADOS_OPCIONALES)) {
    const indice = variantes
      .map((v) => nombres.indexOf(normalizar(v)))
      .find((i) => i >= 0);
    columna.set(opcional as EncabezadoOpcional, indice ?? -1);
  }
  if (faltantes.length) {
    throw new ErrorArchivo(
      `Faltan encabezados: ${faltantes.join(', ')}`,
      faltantes,
    );
  }

  const filas: FilaArchivo[] = [];
  celdas.slice(indiceEncabezados + 1).forEach((fila, i) => {
    if (fila.every((c) => aTexto(c).trim() === '')) return;
    const valores = Object.fromEntries(
      [...columna].map(([nombre, indice]) => [
        nombre,
        indice < 0 ? '' : celdaComoTexto(nombre, fila[indice]).trim(),
      ]),
    ) as Record<Columna, string>;
    filas.push({ numero: indiceEncabezados + i + 2, valores });
  });
  return filas;
}

function leerCsv(contenido: Buffer): string[][] {
  // Se quita el BOM que agrega Excel al guardar en UTF-8.
  const BOM = String.fromCharCode(0xfeff);
  const leido = contenido.toString('utf8');
  const texto = leido.startsWith(BOM) ? leido.slice(1) : leido;
  const { data } = Papa.parse<string[]>(texto, { skipEmptyLines: false });
  return data;
}

function leerXlsx(contenido: Buffer): unknown[][] {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(contenido, { type: 'buffer' });
  } catch {
    throw new ErrorArchivo('No se pudo leer el archivo de Excel');
  }
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new ErrorArchivo('El archivo de Excel no tiene hojas');
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: true,
  });
  return filas;
}

/**
 * Las celdas de texto se usan tal cual. Si Excel guardó la Fecha o la Hora
 * como fecha real (número de serie), se convierte al formato del layout:
 * dd/mm/aaaa o HH:mm. Las demás columnas numéricas (Pasajeros) quedan igual.
 */
function celdaComoTexto(encabezado: Columna, valor: unknown): string {
  if (typeof valor !== 'number') return aTexto(valor);
  if (encabezado !== 'Fecha' && encabezado !== 'Hora') return aTexto(valor);
  const f = XLSX.SSF.parse_date_code(valor);
  const dos = (n: number) => String(n).padStart(2, '0');
  return encabezado === 'Fecha'
    ? `${dos(f.d)}/${dos(f.m)}/${f.y}`
    : `${dos(f.H)}:${dos(f.M)}`;
}

/** Texto de una celda: texto, número o booleano; cualquier otra cosa cuenta como vacía. */
function aTexto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  return '';
}
