import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ENCABEZADO_ANCLA,
  ENCABEZADOS,
  type Encabezado,
  FILAS_MAXIMAS_ANTES_DE_ENCABEZADOS,
  normalizar,
} from './mapeo.js';

/** Una fila de datos del archivo, con sus valores por nombre de encabezado. */
export interface FilaArchivo {
  /** Número de fila en el archivo (como lo ve el usuario en Excel). */
  numero: number;
  valores: Record<Encabezado, string>;
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
      fila.some((c) => normalizar(String(c)) === normalizar(ENCABEZADO_ANCLA)),
    );
  if (indiceEncabezados < 0) {
    throw new ErrorArchivo(
      `No se encontró la fila de encabezados (debe contener "${ENCABEZADO_ANCLA}")`,
      [...ENCABEZADOS],
    );
  }

  // Columna de cada encabezado, buscada por nombre (sin mayúsculas ni acentos).
  const nombres = celdas[indiceEncabezados].map((c) => normalizar(String(c)));
  const columna = new Map(
    ENCABEZADOS.map((e) => [e, nombres.indexOf(normalizar(e))] as const),
  );
  const faltantes = ENCABEZADOS.filter((e) => columna.get(e) === -1);
  if (faltantes.length) {
    throw new ErrorArchivo(
      `Faltan encabezados: ${faltantes.join(', ')}`,
      faltantes,
    );
  }

  const filas: FilaArchivo[] = [];
  celdas.slice(indiceEncabezados + 1).forEach((fila, i) => {
    if (fila.every((c) => String(c ?? '').trim() === '')) return;
    const valores = Object.fromEntries(
      ENCABEZADOS.map((e) => [
        e,
        celdaComoTexto(e, fila[columna.get(e) as number]).trim(),
      ]),
    ) as Record<Encabezado, string>;
    filas.push({ numero: indiceEncabezados + i + 2, valores });
  });
  return filas;
}

function leerCsv(contenido: Buffer): string[][] {
  // Se quita el BOM que agrega Excel al guardar en UTF-8.
  const texto = contenido.toString('utf8').replace(/^﻿/, '');
  const { data } = Papa.parse<string[]>(texto, { skipEmptyLines: false });
  return data.map((fila) => fila.map((c) => String(c ?? '')));
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
function celdaComoTexto(encabezado: Encabezado, valor: unknown): string {
  if (typeof valor !== 'number') return String(valor ?? '');
  if (encabezado !== 'Fecha' && encabezado !== 'Hora') return String(valor);
  const f = XLSX.SSF.parse_date_code(valor);
  const dos = (n: number) => String(n).padStart(2, '0');
  return encabezado === 'Fecha'
    ? `${dos(f.d)}/${dos(f.m)}/${f.y}`
    : `${dos(f.H)}:${dos(f.M)}`;
}
