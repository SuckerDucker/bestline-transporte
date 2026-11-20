import {
  conHotel,
  definicionPdf,
  NOMBRE_SISTEMA,
  type RolExportado,
  rolACsv,
  rolAPdf,
  type ServicioExportado,
} from './rol-exportado.js';

const h = (hora: string) => new Date(`2026-11-10T${hora}:00-05:00`);
const servicio = (
  folio: string,
  tipo: string,
  hotel: string | null,
): ServicioExportado => ({
  orden: 1,
  folio,
  tipo,
  modalidad: 'PRIVADO',
  presentarse: h('05:05'),
  hora: h('05:25'),
  libre: h('06:35'),
  origen: tipo === 'LLEGADA' ? 'Aeropuerto CUN' : 'Zona Hotelera',
  destino: tipo === 'LLEGADA' ? 'Zona Hotelera' : 'Aeropuerto CUN',
  hotel,
  pasajeros: 4,
  vuelo: null,
  estado: 'PROGRAMADO',
});
const ROL: RolExportado = {
  fecha: '2026-11-10',
  estado: 'AUTORIZADO',
  unidades: [
    {
      numeroEconomico: 'BL-01',
      tipo: 'Van',
      capacidad: 14,
      operador: 'José Hernández',
      cita: '04:00',
      servicios: [servicio('TUI-0016', 'SALIDA', 'Hyatt Ziva Cancun')],
    },
  ],
};

describe('rolACsv', () => {
  it('empieza con BOM, trae los encabezados y una fila por servicio con horas de Cancún y acentos', () => {
    const csv = rolACsv(ROL);
    expect(csv.startsWith('﻿')).toBe(true);
    const [encabezado, fila] = csv.slice(1).split('\r\n');
    expect(encabezado).toBe(
      'fecha,unidad,tipo_unidad,operador,cita,orden,folio,tipo,modalidad,presentarse,hora,libre,origen,destino,hotel,pasajeros,vuelo,estado',
    );
    expect(fila).toBe(
      '2026-11-10,BL-01,Van,José Hernández,04:00,1,TUI-0016,SALIDA,PRIVADO,05:05,05:25,06:35,Zona Hotelera,Aeropuerto CUN,Hyatt Ziva Cancun,4,,PROGRAMADO',
    );
  });
});

describe('conHotel', () => {
  it('en una SALIDA el hotel va con el origen; en una LLEGADA, con el destino', () => {
    const salida = servicio('S', 'SALIDA', 'Hotel A');
    expect(conHotel(salida, 'origen')).toBe('Zona Hotelera\nHotel A');
    expect(conHotel(salida, 'destino')).toBe('Aeropuerto CUN');
    const llegada = servicio('L', 'LLEGADA', 'Hotel B');
    expect(conHotel(llegada, 'origen')).toBe('Aeropuerto CUN');
    expect(conHotel(llegada, 'destino')).toBe('Zona Hotelera\nHotel B');
    expect(conHotel(servicio('T', 'TRASLADO', null), 'origen')).toBe(
      'Zona Hotelera',
    );
  });
});

describe('PDF', () => {
  it('la definición lleva el nombre del sistema, la fecha y una tabla por unidad', () => {
    const def = definicionPdf(ROL, new Date('2026-11-09T22:00:00Z'));
    const texto = JSON.stringify(def);
    expect(texto).toContain(NOMBRE_SISTEMA);
    expect(texto).toContain('Rol del 10/11/2026 · AUTORIZADO');
    expect(texto).toContain(
      'BL-01 · Van (14 pax) · José Hernández · Cita 04:00',
    );
    expect(def.pageOrientation).toBe('landscape');
  });

  it('sin unidades avisa que no hay servicios', () => {
    expect(
      JSON.stringify(
        definicionPdf({ ...ROL, unidades: [] }, new Date()).content,
      ),
    ).toContain('No hay servicios asignados.');
  });

  it('genera un PDF válido en memoria', async () => {
    const pdf = await rolAPdf(ROL);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
