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
import { OperadoresService } from './operadores.service.js';

const ADMIN = 1;
const operador = (cambios = {}) => ({
  id: 3,
  nombre: 'Operador Ejemplo 03',
  licencia: 'LIC-03',
  telefono: '998-000-0003',
  disponible: true,
  ...cambios,
});

describe('OperadoresService', () => {
  let prisma: PrismaSimulado;
  let servicio: OperadoresService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new OperadoresService(comoPrisma(prisma));
  });

  it('listar filtra por disponibilidad y búsqueda', async () => {
    prisma.operador.findMany.mockResolvedValue([operador()]);
    prisma.operador.count.mockResolvedValue(1);

    const pagina = await servicio.listar({
      disponible: true,
      buscar: 'ejemplo',
      pagina: 1,
      limite: 10,
    });

    expect(pagina.total).toBe(1);
    expect(prisma.operador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
        where: expect.objectContaining({
          disponible: true,
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('obtener responde 404 si no existe', async () => {
    prisma.operador.findUnique.mockResolvedValue(null);
    await expect(servicio.obtener(99)).rejects.toThrow(NotFoundException);
  });

  it('crear guarda el operador y registra CREAR en la bitácora', async () => {
    const dto = {
      nombre: 'Operador Ejemplo 03',
      licencia: 'LIC-03',
      telefono: '998-000-0003',
    };
    prisma.operador.create.mockResolvedValue(operador());

    await expect(servicio.crear(dto, ADMIN)).resolves.toEqual(operador());
    expect(prisma.operador.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: dto }),
    );
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'CREAR', 'operador', 3),
    );
  });

  it('actualizar guarda los cambios y registra ACTUALIZAR', async () => {
    prisma.operador.findUnique.mockResolvedValue(operador());
    prisma.operador.update.mockResolvedValue(
      operador({ telefono: '998-111-2233' }),
    );

    await servicio.actualizar(3, { telefono: '998-111-2233' }, ADMIN);

    expect(prisma.operador.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: { telefono: '998-111-2233' },
      }),
    );
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'ACTUALIZAR', 'operador', 3),
    );
  });

  it('actualizar responde 404 si no existe', async () => {
    prisma.operador.findUnique.mockResolvedValue(null);
    await expect(
      servicio.actualizar(99, { nombre: 'X' }, ADMIN),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.bitacora.create).not.toHaveBeenCalled();
  });

  it('desactivar deja disponible = false y registra DESACTIVAR', async () => {
    prisma.operador.findUnique.mockResolvedValue(operador());
    prisma.operador.update.mockResolvedValue(operador({ disponible: false }));

    const resultado = await servicio.desactivar(3, ADMIN);

    expect(resultado.disponible).toBe(false);
    expect(prisma.operador.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: { disponible: false },
      }),
    );
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'DESACTIVAR', 'operador', 3),
    );
  });

  it('desactivar un operador ya inactivo no lo vuelve a registrar', async () => {
    prisma.operador.findUnique.mockResolvedValue(
      operador({ disponible: false }),
    );

    await servicio.desactivar(3, ADMIN);

    expect(prisma.operador.update).not.toHaveBeenCalled();
    expect(prisma.bitacora.create).not.toHaveBeenCalled();
  });

  describe('vehículo del operador', () => {
    const dto = {
      nombre: 'Operador Ejemplo 03',
      licencia: 'LIC-03',
      telefono: '998-000-0003',
    };

    it('asigna un vehículo libre y la hora de cita', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue({
        numeroEconomico: 'BL-03',
        operador: null,
      });
      prisma.operador.create.mockResolvedValue(operador({ vehiculoId: 3 }));

      await servicio.crear({ ...dto, vehiculoId: 3, horaCita: '04:15' }, ADMIN);

      expect(prisma.operador.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ...dto, vehiculoId: 3, horaCita: '04:15' },
        }),
      );
    });

    it('400 si el vehículo no existe', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue(null);
      await expect(
        servicio.crear({ ...dto, vehiculoId: 99 }, ADMIN),
      ).rejects.toThrow(new BadRequestException('No existe el vehículo 99'));
      expect(prisma.operador.create).not.toHaveBeenCalled();
    });

    it('409 si el vehículo ya tiene otro operador', async () => {
      prisma.operador.findUnique.mockResolvedValue(operador());
      prisma.vehiculo.findUnique.mockResolvedValue({
        numeroEconomico: 'BL-05',
        operador: { id: 8 },
      });
      await expect(
        servicio.actualizar(3, { vehiculoId: 5 }, ADMIN),
      ).rejects.toThrow(
        new ConflictException(
          'El vehículo BL-05 ya tiene un operador asignado',
        ),
      );
      expect(prisma.operador.update).not.toHaveBeenCalled();
    });

    it('puede conservar su propio vehículo y quitarlo con null', async () => {
      prisma.operador.findUnique.mockResolvedValue(operador({ vehiculoId: 3 }));
      prisma.vehiculo.findUnique.mockResolvedValue({
        numeroEconomico: 'BL-03',
        operador: { id: 3 },
      });
      prisma.operador.update.mockResolvedValue(operador());

      await servicio.actualizar(3, { vehiculoId: 3 }, ADMIN);
      await servicio.actualizar(3, { vehiculoId: null }, ADMIN);

      expect(prisma.operador.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { vehiculoId: null } }),
      );
    });

    it('409 si la base rechaza el vehículo repetido (P2002)', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue({
        numeroEconomico: 'BL-03',
        operador: null,
      });
      prisma.operador.create.mockRejectedValue(errorPrisma('P2002'));
      await expect(
        servicio.crear({ ...dto, vehiculoId: 3 }, ADMIN),
      ).rejects.toThrow(ConflictException);
    });
  });
});
