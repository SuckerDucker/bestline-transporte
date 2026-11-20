// Archivos del rol por operador: CSV (para Excel) y PDF (para imprimir).
// Son funciones puras sobre el rol ya leído, para probarlas sin base de datos.
import Papa from 'papaparse';
import PdfPrinter from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js';
import { ZONA_HORARIA } from '../comun/fechas.js';

export const NOMBRE_SISTEMA = 'Best Line · Sistema de asignación y monitoreo';

export interface ServicioExportado {
  orden: number;
  folio: string;
  tipo: string;
  modalidad: string;
  presentarse: Date;
  hora: Date;
  libre: Date;
  origen: string;
  destino: string;
  hotel: string | null;
  pasajeros: number;
  vuelo: string | null;
  estado: string;
}

export interface UnidadExportada {
  numeroEconomico: string;
  tipo: string;
  capacidad: number;
  operador: string;
  cita: string | null;
  servicios: ServicioExportado[];
}

export interface RolExportado {
  fecha: string;
  estado: string;
  unidades: UnidadExportada[];
}

const HORA = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA_HORARIA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const hora = (d: Date) => HORA.format(d);
/** "2026-11-10" → "10/11/2026" */
const fechaLegible = (f: string) => f.split('-').reverse().join('/');

/** Una fila por servicio, con la unidad y el operador repetidos (fácil de filtrar en Excel). */
export function rolACsv(rol: RolExportado): string {
  const filas = rol.unidades.flatMap((u) =>
    u.servicios.map((s) => ({
      fecha: rol.fecha,
      unidad: u.numeroEconomico,
      tipo_unidad: u.tipo,
      operador: u.operador,
      cita: u.cita ?? '',
      orden: s.orden,
      folio: s.folio,
      tipo: s.tipo,
      modalidad: s.modalidad,
      presentarse: hora(s.presentarse),
      hora: hora(s.hora),
      libre: hora(s.libre),
      origen: s.origen,
      destino: s.destino,
      hotel: s.hotel ?? '',
      pasajeros: s.pasajeros,
      vuelo: s.vuelo ?? '',
      estado: s.estado,
    })),
  );
  // BOM al inicio: así Excel abre el archivo como UTF-8 y respeta los acentos.
  return '﻿' + Papa.unparse(filas, { newline: '\r\n' });
}

/** Tabla de servicios de una unidad para el PDF. */
function tablaUnidad(u: UnidadExportada): Content[] {
  const encabezado = [
    '#',
    'Presentarse',
    'Hora',
    'Libre',
    'Folio',
    'Tipo',
    'Origen',
    'Destino',
    'Pax',
    'Vuelo',
  ];
  // Título y tabla de la unidad en un bloque que no se parte entre páginas
  // (cada unidad tiene pocos servicios).
  return [
    {
      unbreakable: true,
      stack: [
        {
          text: `${u.numeroEconomico} · ${u.tipo} (${u.capacidad} pax) · ${u.operador} · Cita ${u.cita ?? '—'}`,
          style: 'unidad',
        },
        {
          table: {
            headerRows: 1,
            widths: [16, 52, 34, 34, 56, 116, '*', '*', 24, 44],
            body: [
              encabezado.map((t) => ({ text: t, style: 'encabezadoTabla' })),
              ...u.servicios.map((s) => [
                String(s.orden),
                hora(s.presentarse),
                { text: hora(s.hora), bold: true },
                hora(s.libre),
                s.folio,
                `${s.tipo} ${s.modalidad}`,
                conHotel(s, 'origen'),
                conHotel(s, 'destino'),
                { text: String(s.pasajeros), alignment: 'right' as const },
                s.vuelo ?? '',
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          fontSize: 9,
        },
      ],
    },
  ];
}

/**
 * Zona y, debajo, el hotel del lado que le toca: en una LLEGADA el hotel es el
 * destino; en SALIDA y TRASLADO, el origen (misma regla que Rutas sugeridas).
 */
export function conHotel(s: ServicioExportado, lado: 'origen' | 'destino') {
  const ladoHotel = s.tipo === 'LLEGADA' ? 'destino' : 'origen';
  const zona = lado === 'origen' ? s.origen : s.destino;
  return s.hotel && lado === ladoHotel ? `${zona}\n${s.hotel}` : zona;
}

/** Definición del PDF: hoja carta horizontal, encabezado con la fecha y una tabla por unidad. */
export function definicionPdf(
  rol: RolExportado,
  generado: Date,
): TDocumentDefinitions {
  return {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [36, 64, 36, 40],
    defaultStyle: { font: 'Helvetica', fontSize: 10 },
    info: {
      title: `Rol del ${fechaLegible(rol.fecha)}`,
      author: NOMBRE_SISTEMA,
    },
    header: {
      margin: [36, 24, 36, 0],
      columns: [
        { text: NOMBRE_SISTEMA, style: 'sistema' },
        {
          text: `Rol del ${fechaLegible(rol.fecha)} · ${rol.estado}`,
          alignment: 'right',
          style: 'titulo',
        },
      ],
    },
    footer: (pagina, paginas) => ({
      margin: [36, 12, 36, 0],
      fontSize: 8,
      color: '#64748b',
      columns: [
        `Generado el ${generado.toLocaleString('es-MX', { timeZone: ZONA_HORARIA })} (hora de Cancún)`,
        { text: `Página ${pagina} de ${paginas}`, alignment: 'right' },
      ],
    }),
    content: rol.unidades.length
      ? rol.unidades.flatMap(tablaUnidad)
      : [{ text: 'No hay servicios asignados.' }],
    styles: {
      sistema: { fontSize: 9, color: '#475569' },
      titulo: { fontSize: 13, bold: true },
      unidad: { fontSize: 11, bold: true, margin: [0, 12, 0, 4] },
      encabezadoTabla: { bold: true, color: '#334155' },
    },
  };
}

// Las 14 fuentes estándar de PDF vienen dentro de pdfkit: no hace falta
// incluir archivos de fuentes. Helvetica cubre los acentos del español.
const impresora = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

/** Genera el PDF en memoria. */
export function rolAPdf(
  rol: RolExportado,
  generado = new Date(),
): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const documento = impresora.createPdfKitDocument(
      definicionPdf(rol, generado),
    );
    const partes: Buffer[] = [];
    documento.on('data', (p: Buffer) => partes.push(p));
    documento.on('end', () => resolver(Buffer.concat(partes)));
    documento.on('error', rechazar);
    documento.end();
  });
}
