import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  errorPrisma,
  type PrismaSimulado,
  registroBitacora,
} from '../comun/pruebas/prisma-simulado.js';
import {
  type ArchivoSubido,
  ImportacionesService,
} from './importaciones.service.js';

const USUARIO = 1;
const NEXUS = 2;
const lista = (nombres: string[]) =>
  nombres.map((nombre, i) => ({ id: i + 1, nombre }));

const archivo = (contenido: Buffer, nombre: string): ArchivoSubido => ({
  originalname: nombre,
  size: contenido.length,
  buffer: contenido,
});
const ejemplo = () => {
  const nombre = 'Layout_Servicios_Nexus.xlsx';
  return archivo(
    readFileSync(resolve(process.cwd(), '../../docs/ejemplos', nombre)),
    nombre,
  );
};
const ENCABEZADOS =
  'Folio,Localizador,Agencia,Fecha,Tipo de Servicio,Pasajeros,Hotel,Zona,Vuelo,Hora';
const csv = (...filas: string[]) =>
  archivo(Buffer.from([ENCABEZADOS, ...filas].join('\n')), 'prueba.csv');
const FILA =
  'NX-1,LOC-1,Nexus Tours,05/11/2026,LLEGADA PRIVADO,4,TRS Coral Hotel,Costa Mujeres,AM100,06:15';

describe('ImportacionesService', () => {
  let prisma: PrismaSimulado;
  let servicio: ImportacionesService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new ImportacionesService(comoPrisma(prisma));
    prisma.mayorista.findUnique.mockResolvedValue({
      id: NEXUS,
      nombre: 'Nexus Tours',
    });
    prisma.mayorista.findMany.mockResolvedValue([
      { id: 1, nombre: 'TUI' },
      { id: NEXUS, nombre: 'Nexus Tours' },
    ]);
    prisma.zona.findMany.mockResolvedValue(
      lista([
        'Aeropuerto CUN',
        'Zona Hotelera',
        'Centro Cancún',
        'Costa Mujeres',
        'Puerto Morelos',
        'Playa del Carmen',
      ]),
    );
    prisma.hotel.findMany.mockResolvedValue(
      lista([
        'Planet Hollywood Cancun',
        'TRS Coral Hotel',
        'Grand Velas Riviera Maya',
        'Hotel Xcaret Arte',
        'Barceló Maya Palace',
        'Iberostar Selection Cancun',
        'Hard Rock Hotel Cancun',
        'Moon Palace Sunrise',
      ]),
    );
    prisma.servicio.findMany.mockResolvedValue([]);
  });

  describe('vistaPrevia', () => {
    it('procesa el archivo de ejemplo sin guardar nada', async () => {
      const vista = await servicio.vistaPrevia(ejemplo(), NEXUS);

      expect(vista.totales).toMatchObject({
        total: 65,
        importables: 58,
        duplicadas: 2,
        errores: 5,
      });
      expect(vista.mayorista).toEqual({ id: NEXUS, nombre: 'Nexus Tours' });
      expect(vista.avisos).toEqual([]);
      expect(vista.filas[0].servicio).toMatchObject({
        zonaOrigen: 'Costa Mujeres',
        zonaDestino: 'Aeropuerto CUN',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.servicio.createMany).not.toHaveBeenCalled();
    });

    it('busca duplicados en la base solo con los folios del archivo', async () => {
      prisma.servicio.findMany.mockResolvedValue([
        { folio: 'NX-15001', localizador: 'LOC85001A' },
      ]);

      const vista = await servicio.vistaPrevia(ejemplo(), NEXUS);

      expect(vista.totales.duplicadas).toBe(3);
      expect(vista.filas[0].estado).toBe('DUPLICADA');
      const [args] = prisma.servicio.findMany.mock.calls[0] as [
        { where: { folio: { in: string[] } } },
      ];
      expect(args.where.folio.in).toHaveLength(63);
    });

    it('avisa si hay filas de otra agencia', async () => {
      const vista = await servicio.vistaPrevia(
        csv(FILA, FILA.replace('NX-1,', 'NX-2,').replace('Nexus Tours', 'TUI')),
        NEXUS,
      );

      expect(vista.avisos).toEqual([
        '1 fila(s) traen la agencia "TUI", distinta del mayorista elegido (Nexus Tours); esos servicios se guardarán con su propia agencia',
      ]);
    });

    it('400 sin archivo, con más de 5 MB o con encabezados faltantes', async () => {
      await expect(servicio.vistaPrevia(undefined, NEXUS)).rejects.toThrow(
        'Adjunta el archivo en el campo "archivo"',
      );
      await expect(
        servicio.vistaPrevia(
          { ...csv(FILA), size: 5 * 1024 * 1024 + 1 },
          NEXUS,
        ),
      ).rejects.toThrow('El archivo supera el máximo de 5 MB');

      let respuesta: unknown;
      try {
        await servicio.vistaPrevia(
          archivo(Buffer.from('Folio,Localizador\nA,B'), 'x.csv'),
          NEXUS,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        respuesta = (error as BadRequestException).getResponse();
      }
      expect(respuesta).toMatchObject({
        faltantes: [
          'Agencia',
          'Fecha',
          'Tipo de Servicio',
          'Pasajeros',
          'Hotel',
          'Zona',
          'Vuelo',
          'Hora',
        ],
      });
    });

    it('404 si el mayorista no existe', async () => {
      prisma.mayorista.findUnique.mockResolvedValue(null);
      await expect(servicio.vistaPrevia(csv(FILA), 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('confirmar', () => {
    beforeEach(() => {
      prisma.importacion.create.mockResolvedValue({ id: 7 });
      prisma.servicio.createMany.mockResolvedValue({ count: 58 });
    });

    it('guarda en una transacción la importación, los servicios y la bitácora', async () => {
      const resultado = await servicio.confirmar(ejemplo(), NEXUS, USUARIO);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.importacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            archivo: 'Layout_Servicios_Nexus.xlsx',
            mayoristaId: NEXUS,
            usuarioId: USUARIO,
            filasValidas: 58,
            filasRechazadas: 7,
          },
        }),
      );
      const [{ data }] = prisma.servicio.createMany.mock.calls[0] as [
        { data: { importacionId: number; folio: string }[] },
      ];
      expect(data).toHaveLength(58);
      expect(data.every((s) => s.importacionId === 7)).toBe(true);
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(
          USUARIO,
          'CREAR: Layout_Servicios_Nexus.xlsx: 58 servicios importados, 7 filas rechazadas',
          'importacion',
          7,
        ),
      );
      expect(resultado?.totales.importables).toBe(58);
    });

    it('400 si no queda ninguna fila para importar (todo duplicado en la base)', async () => {
      prisma.servicio.findMany.mockResolvedValue([
        { folio: 'NX-1', localizador: 'LOC-1' },
      ]);
      await expect(
        servicio.confirmar(csv(FILA), NEXUS, USUARIO),
      ).rejects.toThrow('El archivo no tiene filas válidas para importar');
      expect(prisma.importacion.create).not.toHaveBeenCalled();
    });

    it('409 si otra importación guardó el mismo folio y localizador mientras tanto', async () => {
      prisma.servicio.createMany.mockRejectedValue(errorPrisma('P2002'));
      await expect(
        servicio.confirmar(csv(FILA), NEXUS, USUARIO),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('consultas', () => {
    it('listar ordena de la más reciente a la más antigua y filtra', async () => {
      prisma.importacion.findMany.mockResolvedValue([]);
      prisma.importacion.count.mockResolvedValue(0);

      await servicio.listar({
        mayoristaId: NEXUS,
        buscar: 'nexus',
        pagina: 2,
        limite: 5,
      });

      expect(prisma.importacion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            mayoristaId: NEXUS,
            archivo: { contains: 'nexus', mode: 'insensitive' },
          },
          orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
          skip: 5,
          take: 5,
        }),
      );
    });

    it('obtener responde 404 si no existe', async () => {
      prisma.importacion.findUnique.mockResolvedValue(null);
      await expect(servicio.obtener(99)).rejects.toThrow(NotFoundException);
    });
  });
});
