import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { ExportacionService } from './exportacion.service.js';

const FECHA = '2026-11-10';
const COORDINADOR: UsuarioAutenticado = { id: 4, rol: 'COORDINADOR' };
const OPERADOR: UsuarioAutenticado = { id: 6, rol: 'OPERADOR' };
const h = (hora: string) => new Date(`2026-11-10T${hora}:00-05:00`);

const asignacion = (vehiculoId: number, folio: string, hora: string) => ({
  vehiculoId,
  inicioEfectivo: h(hora),
  liberacion: h(hora),
  vehiculo: {
    numeroEconomico: `BL-0${vehiculoId}`,
    tipo: 'Van',
    capacidad: 14,
  },
  operador: { nombre: `Operador ${vehiculoId}`, horaCita: '04:00' },
  servicio: {
    folio,
    tipo: 'SALIDA',
    modalidad: 'PRIVADO',
    fechaHora: h(hora),
    pasajeros: 4,
    vuelo: null,
    estado: 'PROGRAMADO',
    zonaOrigen: { nombre: 'Zona Hotelera' },
    zonaDestino: { nombre: 'Aeropuerto CUN' },
    hotel: null,
  },
});
const ROL = {
  estado: 'AUTORIZADO',
  asignaciones: [
    asignacion(2, 'NEX-2', '06:00'),
    asignacion(1, 'NEX-1', '05:00'),
    asignacion(1, 'NEX-3', '09:00'),
  ],
};

describe('ExportacionService', () => {
  let prisma: PrismaSimulado;
  let exportacion: ExportacionService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    exportacion = new ExportacionService(comoPrisma(prisma));
  });

  it('agrupa por unidad, ordena las unidades y numera los servicios de cada una', async () => {
    prisma.rolDiario.findUnique.mockResolvedValue(ROL);
    const rol = await exportacion.leerRol(
      FECHA,
      { formato: 'csv' },
      COORDINADOR,
    );
    expect(
      rol.unidades.map((u) => [
        u.numeroEconomico,
        u.servicios.map((s) => `${s.orden}:${s.folio}`),
      ]),
    ).toEqual([
      ['BL-01', ['1:NEX-1', '2:NEX-3']],
      ['BL-02', ['1:NEX-2']],
    ]);
    const consulta = prisma.rolDiario.findUnique.mock.calls[0][0] as {
      include: { asignaciones: { where: unknown } };
    };
    expect(consulta.include.asignaciones.where).toEqual({});
  });

  it('con operadorId filtra por ese operador y el nombre del archivo lleva la unidad', async () => {
    prisma.rolDiario.findUnique.mockResolvedValue({
      ...ROL,
      asignaciones: [ROL.asignaciones[1]],
    });
    const archivo = await exportacion.exportar(
      FECHA,
      { formato: 'csv', operadorId: 1 },
      COORDINADOR,
    );
    const consulta = prisma.rolDiario.findUnique.mock.calls[0][0] as {
      include: { asignaciones: { where: unknown } };
    };
    expect(consulta.include.asignaciones.where).toEqual({ operadorId: 1 });
    expect(archivo).toMatchObject({
      tipo: 'text/csv; charset=utf-8',
      nombre: 'rol-2026-11-10-BL-01.csv',
    });
  });

  it('PDF: tipo application/pdf y nombre con la fecha', async () => {
    prisma.rolDiario.findUnique.mockResolvedValue(ROL);
    const archivo = await exportacion.exportar(
      FECHA,
      { formato: 'pdf' },
      COORDINADOR,
    );
    expect(archivo.tipo).toBe('application/pdf');
    expect(archivo.nombre).toBe('rol-2026-11-10.pdf');
    expect(archivo.contenido.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('404 sin rol y 404 si el operador pedido no tiene servicios', async () => {
    prisma.rolDiario.findUnique.mockResolvedValueOnce(null);
    await expect(
      exportacion.leerRol(FECHA, { formato: 'csv' }, COORDINADOR),
    ).rejects.toThrow(new NotFoundException(`No hay rol del ${FECHA}`));
    prisma.rolDiario.findUnique.mockResolvedValueOnce({
      ...ROL,
      asignaciones: [],
    });
    await expect(
      exportacion.leerRol(
        FECHA,
        { formato: 'csv', operadorId: 9 },
        COORDINADOR,
      ),
    ).rejects.toThrow(
      new NotFoundException(
        `El operador no tiene servicios en el rol del ${FECHA}`,
      ),
    );
  });

  describe('OPERADOR', () => {
    it('sin operadorId exporta el suyo', async () => {
      prisma.operador.findUnique.mockResolvedValue({ id: 1 });
      prisma.rolDiario.findUnique.mockResolvedValue({
        ...ROL,
        asignaciones: ROL.asignaciones.slice(1),
      });
      const archivo = await exportacion.exportar(
        FECHA,
        { formato: 'csv' },
        OPERADOR,
      );
      expect(prisma.operador.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: 6 } }),
      );
      expect(archivo.nombre).toBe('rol-2026-11-10-BL-01.csv');
    });

    it('403 si pide el rol de otro operador', async () => {
      prisma.operador.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        exportacion.leerRol(FECHA, { formato: 'pdf', operadorId: 2 }, OPERADOR),
      ).rejects.toThrow(
        new ForbiddenException('Solo puedes exportar tu propio rol'),
      );
      expect(prisma.rolDiario.findUnique).not.toHaveBeenCalled();
    });

    it('404 si el rol no está autorizado o si su usuario no está ligado a un operador', async () => {
      prisma.operador.findUnique.mockResolvedValueOnce({ id: 1 });
      prisma.rolDiario.findUnique.mockResolvedValueOnce({
        ...ROL,
        estado: 'PROPUESTO',
      });
      await expect(
        exportacion.leerRol(FECHA, { formato: 'csv' }, OPERADOR),
      ).rejects.toThrow(
        new NotFoundException(`No hay rol autorizado del ${FECHA}`),
      );
      prisma.operador.findUnique.mockResolvedValueOnce(null);
      await expect(
        exportacion.leerRol(FECHA, { formato: 'csv' }, OPERADOR),
      ).rejects.toThrow(
        new NotFoundException('Tu usuario no está ligado a un operador'),
      );
    });
  });
});
