import { BadRequestException } from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../comun/pruebas/prisma-simulado.js';
import { diasDelRango, IndicadoresService } from './indicadores.service.js';

describe('IndicadoresService', () => {
  let prisma: PrismaSimulado;
  let indicadores: IndicadoresService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    indicadores = new IndicadoresService(comoPrisma(prisma));
    prisma.zona.findMany.mockResolvedValue([
      { id: 1, nombre: 'Aeropuerto CUN', esZonaTermino: true },
      { id: 3, nombre: 'Centro Cancún', esZonaTermino: false },
    ]);
    prisma.tiempoTraslado.findMany.mockResolvedValue([]);
    prisma.incidencia.findMany.mockResolvedValue([]);
  });

  it('diasDelRango incluye los dos extremos y cruza el fin de mes', () => {
    expect(diasDelRango('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('400 con fecha inexistente, desde > hasta o más de 31 días', () => {
    expect(() =>
      indicadores.validarRango({ desde: '2026-02-30', hasta: '2026-03-01' }),
    ).toThrow(BadRequestException);
    expect(() =>
      indicadores.validarRango({ desde: '2026-11-10', hasta: '2026-11-05' }),
    ).toThrow(new BadRequestException('desde no puede ser posterior a hasta'));
    expect(() =>
      indicadores.validarRango({ desde: '2026-10-01', hasta: '2026-11-01' }),
    ).toThrow(
      new BadRequestException('El rango puede tener como máximo 31 días'),
    );
    expect(
      indicadores.validarRango({ desde: '2026-10-01', hasta: '2026-10-31' }),
    ).toHaveLength(31);
  });

  it('agrupa servicios e incidencias por día de Cancún y arma cada día con su rol', async () => {
    prisma.servicio.findMany.mockResolvedValue([
      // 23:30 del 05/11 en Cancún (04:30 UTC del 06/11): cuenta el 05/11
      { estado: 'PROGRAMADO', fechaHora: new Date('2026-11-06T04:30:00Z') },
      { estado: 'PENDIENTE', fechaHora: new Date('2026-11-06T15:00:00Z') },
    ]);
    prisma.incidencia.findMany.mockResolvedValue([
      {
        tipo: 'RETRASO',
        servicio: { fechaHora: new Date('2026-11-06T04:30:00Z') },
      },
    ]);
    prisma.rolDiario.findMany.mockResolvedValue([
      {
        id: 14,
        fecha: new Date('2026-11-05T00:00:00Z'),
        estado: 'PROPUESTO',
        asignaciones: [
          {
            vehiculoId: 1,
            liberacion: new Date('2026-11-05T15:00:00Z'),
            servicio: { pasajeros: 7, zonaDestinoId: 1 },
            vehiculo: {
              numeroEconomico: 'BL-01',
              capacidad: 14,
              encierroBase: 'Centro Cancún',
            },
            operador: { horaCita: '04:00' },
          },
        ],
        noCubiertos: [{ motivo: 'EMPALME' }],
      },
    ]);

    const r = await indicadores.calcular({
      desde: '2026-11-05',
      hasta: '2026-11-06',
    });

    expect(
      r.dias.map((d) => [
        d.fecha,
        d.estadoRol,
        d.servicios,
        d.asignados,
        d.cobertura,
        d.empalmes,
        d.incidencias,
      ]),
    ).toEqual([
      // PROPUESTO: no se corre el verificador (empalmes null)
      ['2026-11-05', 'PROPUESTO', 1, 1, 50, null, 1],
      ['2026-11-06', null, 1, 0, null, null, 0],
    ]);
    // 04:00 a 10:00 (15:00 UTC), termina en CUN: 6 h
    expect(r.dias[0].unidades[0]).toMatchObject({
      numeroEconomico: 'BL-01',
      ocupacion: 0.5,
      horasJornada: 6,
    });
    expect(r.resumen).toMatchObject({
      dias: 2,
      diasConRol: 1,
      cobertura: 50,
      empalmes: null,
    });
  });
});
