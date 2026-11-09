import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
  registroBitacora,
} from '../comun/pruebas/prisma-simulado.js';
import { ParametrosService } from './parametros.service.js';
import { validarParametro } from './reglas.js';

const ADMIN = 1;
const PARAMETROS = [
  { id: 1, clave: 'hora_cita.turno_1', valor: '04:00', descripcion: '' },
  { id: 3, clave: 'jornada_maxima_horas', valor: '9.5', descripcion: '' },
  { id: 4, clave: 'anticipacion.PRIVADO', valor: '10', descripcion: '' },
];

describe('validarParametro', () => {
  it.each([
    ['hora_cita.turno_1', '00:00'],
    ['hora_cita.turno_2', '23:59'],
    ['jornada_maxima_horas', '1'],
    ['jornada_maxima_horas', '9.5'],
    ['jornada_maxima_horas', '12'],
    ['anticipacion.GRUPO', '0'],
    ['anticipacion.GRUPO', '120'],
  ])('%s = "%s" es válido', (clave, valor) => {
    expect(validarParametro(clave, valor)).toBeNull();
  });

  it.each([
    ['hora_cita.turno_1', '4:00'],
    ['hora_cita.turno_1', '24:00'],
    ['hora_cita.turno_1', '12:60'],
    ['jornada_maxima_horas', '0.5'],
    ['jornada_maxima_horas', '12.5'],
    ['jornada_maxima_horas', 'diez'],
    ['anticipacion.PRIVADO', '121'],
    ['anticipacion.PRIVADO', '-5'],
    ['anticipacion.PRIVADO', '10.5'],
    ['otra.clave', '1'],
  ])('%s = "%s" es inválido', (clave, valor) => {
    expect(validarParametro(clave, valor)).toEqual(expect.any(String));
  });
});

describe('ParametrosService', () => {
  let prisma: PrismaSimulado;
  let servicio: ParametrosService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new ParametrosService(comoPrisma(prisma));
    prisma.parametroOperacion.findMany.mockImplementation((arg: unknown) => {
      const claves = (arg as { where?: { clave: { in: string[] } } }).where
        ?.clave.in;
      return Promise.resolve(
        claves
          ? PARAMETROS.filter((p) => claves.includes(p.clave))
          : PARAMETROS,
      );
    });
  });

  it('listar devuelve los parámetros ordenados por clave', async () => {
    await expect(servicio.listar()).resolves.toHaveLength(3);
    expect(prisma.parametroOperacion.findMany).toHaveBeenCalledWith({
      orderBy: { clave: 'asc' },
    });
  });

  it('actualiza solo lo que cambió y registra el valor anterior y el nuevo', async () => {
    await servicio.actualizar(
      [
        { clave: 'jornada_maxima_horas', valor: '10' },
        // Sin cambio: no se actualiza ni se registra.
        { clave: 'hora_cita.turno_1', valor: '04:00' },
      ],
      ADMIN,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.parametroOperacion.update).toHaveBeenCalledTimes(1);
    expect(prisma.parametroOperacion.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { valor: '10' },
    });
    expect(prisma.bitacora.create).toHaveBeenCalledTimes(1);
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'ACTUALIZAR: 9.5 → 10', 'parametro_operacion', 3),
    );
  });

  it('400 con el error de cada clave y sin guardar nada', async () => {
    let respuesta: unknown;
    try {
      await servicio.actualizar(
        [
          { clave: 'jornada_maxima_horas', valor: '15' },
          { clave: 'anticipacion.PRIVADO', valor: '15' },
          { clave: 'hora_cita.turno_1', valor: '4:30' },
        ],
        ADMIN,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      respuesta = (error as BadRequestException).getResponse();
    }

    const { errores } = respuesta as { errores: { clave: string }[] };
    expect(errores.map((e) => e.clave)).toEqual([
      'jornada_maxima_horas',
      'hora_cita.turno_1',
    ]);
    expect(prisma.parametroOperacion.update).not.toHaveBeenCalled();
  });

  it('404 si alguna clave no existe', async () => {
    await expect(
      servicio.actualizar(
        [{ clave: 'hora_cita.turno_9', valor: '06:00' }],
        ADMIN,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('400 si una clave viene repetida', async () => {
    await expect(
      servicio.actualizar(
        [
          { clave: 'jornada_maxima_horas', valor: '10' },
          { clave: 'jornada_maxima_horas', valor: '11' },
        ],
        ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
