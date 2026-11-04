import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
  errorPrisma,
  type PrismaSimulado,
  registroBitacora,
} from '../comun/pruebas/prisma-simulado.js';
import { ZonasService } from './zonas.service.js';

const ADMIN = 1;
// Prisma devuelve los Decimal como objetos; aquí basta con texto para simularlos.
const zonaBd = (cambios = {}) => ({
  id: 4,
  nombre: 'Costa Mujeres',
  latitud: '21.236000',
  longitud: '-86.806000',
  esZonaTermino: false,
  ...cambios,
});
const dto = {
  nombre: 'Costa Mujeres',
  latitud: 21.236,
  longitud: -86.806,
  esZonaTermino: false,
};

describe('ZonasService', () => {
  let prisma: PrismaSimulado;
  let servicio: ZonasService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new ZonasService(comoPrisma(prisma));
  });

  it('listar devuelve las coordenadas como números', async () => {
    prisma.zona.findMany.mockResolvedValue([zonaBd()]);
    prisma.zona.count.mockResolvedValue(1);

    const pagina = await servicio.listar({
      esZonaTermino: false,
      pagina: 1,
      limite: 10,
    });

    expect(pagina.datos[0]).toEqual({
      ...zonaBd(),
      latitud: 21.236,
      longitud: -86.806,
    });
    expect(prisma.zona.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { esZonaTermino: false } }),
    );
  });

  it('obtener responde 404 si no existe', async () => {
    prisma.zona.findUnique.mockResolvedValue(null);
    await expect(servicio.obtener(99)).rejects.toThrow(NotFoundException);
  });

  describe('crear', () => {
    it('guarda la zona y registra CREAR en la bitácora', async () => {
      prisma.zona.create.mockResolvedValue(zonaBd());

      const zona = await servicio.crear(dto, ADMIN);

      expect(zona.latitud).toBe(21.236);
      expect(prisma.zona.create).toHaveBeenCalledWith({ data: dto });
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'CREAR', 'zona', 4),
      );
    });

    it('responde 409 si el nombre ya existe', async () => {
      prisma.zona.create.mockRejectedValue(errorPrisma('P2002'));

      await expect(servicio.crear(dto, ADMIN)).rejects.toThrow(
        new ConflictException(
          'Ya existe una zona con el nombre "Costa Mujeres"',
        ),
      );
    });
  });

  describe('actualizar', () => {
    it('guarda los cambios y registra ACTUALIZAR', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaBd());
      prisma.zona.update.mockResolvedValue(zonaBd({ esZonaTermino: true }));

      const zona = await servicio.actualizar(4, { esZonaTermino: true }, ADMIN);

      expect(zona.esZonaTermino).toBe(true);
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'ACTUALIZAR', 'zona', 4),
      );
    });

    it('responde 409 si el nuevo nombre ya existe', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaBd());
      prisma.zona.update.mockRejectedValue(errorPrisma('P2002'));

      await expect(
        servicio.actualizar(4, { nombre: 'Tulum' }, ADMIN),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('eliminar', () => {
    const referencias = (
      hoteles: number,
      tiempos: number,
      servicios: number,
    ) => {
      prisma.hotel.count.mockResolvedValue(hoteles);
      prisma.tiempoTraslado.count.mockResolvedValue(tiempos);
      prisma.servicio.count.mockResolvedValue(servicios);
    };

    it('responde 409 con el detalle si la zona está referenciada, sin borrar', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaBd());
      referencias(1, 15, 9);

      await expect(servicio.eliminar(4, ADMIN)).rejects.toThrow(
        new ConflictException(
          'No se puede eliminar la zona "Costa Mujeres": está referenciada por 1 hotel(es), 15 tiempo(s) de traslado y 9 servicio(s)',
        ),
      );
      expect(prisma.zona.delete).not.toHaveBeenCalled();
      expect(prisma.bitacora.create).not.toHaveBeenCalled();
    });

    it('borra la zona sin referencias y registra ELIMINAR', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaBd());
      referencias(0, 0, 0);
      prisma.zona.delete.mockResolvedValue(zonaBd());

      await expect(servicio.eliminar(4, ADMIN)).resolves.toEqual({ id: 4 });
      expect(prisma.zona.delete).toHaveBeenCalledWith({ where: { id: 4 } });
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'ELIMINAR', 'zona', 4),
      );
    });

    it('responde 409 si la base rechaza el borrado por llave foránea (P2003)', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaBd());
      referencias(0, 0, 0);
      prisma.zona.delete.mockRejectedValue(errorPrisma('P2003'));

      await expect(servicio.eliminar(4, ADMIN)).rejects.toThrow(
        ConflictException,
      );
    });

    it('responde 404 si la zona no existe', async () => {
      prisma.zona.findUnique.mockResolvedValue(null);
      await expect(servicio.eliminar(99, ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
