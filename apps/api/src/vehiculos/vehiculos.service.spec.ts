import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoVehiculo } from '../generated/prisma/client.js';
import {
  comoPrisma,
  crearPrismaSimulado,
  errorPrisma,
  type PrismaSimulado,
  registroBitacora,
} from '../comun/pruebas/prisma-simulado.js';
import { VehiculosService } from './vehiculos.service.js';

const ADMIN = 1;
const vehiculo = (cambios = {}) => ({
  id: 5,
  numeroEconomico: 'BL-05',
  tipo: 'Van',
  capacidad: 14,
  estado: EstadoVehiculo.DISPONIBLE,
  encierroBase: 'Centro Cancún',
  ...cambios,
});

describe('VehiculosService', () => {
  let prisma: PrismaSimulado;
  let servicio: VehiculosService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new VehiculosService(comoPrisma(prisma));
  });

  describe('listar', () => {
    it('aplica búsqueda, filtros y paginación', async () => {
      prisma.vehiculo.findMany.mockResolvedValue([vehiculo()]);
      prisma.vehiculo.count.mockResolvedValue(11);

      const pagina = await servicio.listar({
        buscar: 'bl',
        tipo: 'Van',
        pagina: 2,
        limite: 10,
      });

      expect(pagina).toEqual({
        datos: [vehiculo()],
        total: 11,
        pagina: 2,
        limite: 10,
      });
      expect(prisma.vehiculo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          where: expect.objectContaining({
            tipo: 'Van',
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('obtener', () => {
    it('responde 404 si no existe', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue(null);
      await expect(servicio.obtener(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('crear', () => {
    const dto = {
      numeroEconomico: 'BL-05',
      tipo: 'Van',
      capacidad: 14,
      encierroBase: 'Centro Cancún',
    };

    beforeEach(() => {
      prisma.zona.findFirst.mockResolvedValue({ nombre: 'Centro Cancún' });
    });

    it('crea con estado DISPONIBLE y registra CREAR en la bitácora', async () => {
      prisma.vehiculo.create.mockResolvedValue(vehiculo());

      await expect(servicio.crear(dto, ADMIN)).resolves.toEqual(vehiculo());
      expect(prisma.vehiculo.create).toHaveBeenCalledWith({
        data: { ...dto, estado: EstadoVehiculo.DISPONIBLE },
      });
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'CREAR', 'vehiculo', 5),
      );
    });

    it('guarda el encierro con el nombre exacto de la zona del catálogo', async () => {
      prisma.vehiculo.create.mockResolvedValue(vehiculo());

      await servicio.crear({ ...dto, encierroBase: 'centro cancun' }, ADMIN);

      expect(prisma.zona.findFirst).toHaveBeenCalledWith({
        where: { nombre: { equals: 'centro cancun', mode: 'insensitive' } },
        select: { nombre: true },
      });
      expect(prisma.vehiculo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ encierroBase: 'Centro Cancún' }),
      });
    });

    it('responde 400 si el encierro no es una zona del catálogo', async () => {
      prisma.zona.findFirst.mockResolvedValue(null);
      await expect(
        servicio.crear({ ...dto, encierroBase: 'Bodega X' }, ADMIN),
      ).rejects.toThrow(
        'El encierro base "Bodega X" no es una zona del catálogo',
      );
      expect(prisma.vehiculo.create).not.toHaveBeenCalled();
    });

    it('responde 400 si la capacidad excede el máximo y no toca la base', async () => {
      await expect(
        servicio.crear({ ...dto, capacidad: 15 }, ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.vehiculo.create).not.toHaveBeenCalled();
      expect(prisma.bitacora.create).not.toHaveBeenCalled();
    });

    it('responde 409 si el número económico ya existe', async () => {
      prisma.vehiculo.create.mockRejectedValue(errorPrisma('P2002'));

      await expect(servicio.crear(dto, ADMIN)).rejects.toThrow(
        new ConflictException(
          'Ya existe un vehículo con el número económico BL-05',
        ),
      );
    });
  });

  describe('actualizar', () => {
    it('actualiza y registra ACTUALIZAR en la bitácora', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue(vehiculo());
      prisma.vehiculo.update.mockResolvedValue(vehiculo({ capacidad: 12 }));

      await servicio.actualizar(5, { capacidad: 12 }, ADMIN);

      expect(prisma.vehiculo.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { capacidad: 12 },
      });
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'ACTUALIZAR', 'vehiculo', 5),
      );
    });

    it('revisa la capacidad combinando con el tipo que ya tenía (Van 20 -> 400)', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue(vehiculo());

      await expect(
        servicio.actualizar(5, { capacidad: 20 }, ADMIN),
      ).rejects.toThrow(
        'La capacidad de un vehículo Van debe estar entre 1 y 14 pasajeros',
      );
      expect(prisma.vehiculo.update).not.toHaveBeenCalled();
    });

    it('responde 404 si no existe', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue(null);
      await expect(
        servicio.actualizar(99, { capacidad: 10 }, ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('responde 409 si el nuevo número económico ya existe', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue(vehiculo());
      prisma.vehiculo.update.mockRejectedValue(errorPrisma('P2002'));

      await expect(
        servicio.actualizar(5, { numeroEconomico: 'BL-01' }, ADMIN),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('desactivar', () => {
    it('cambia el estado a BAJA y registra DESACTIVAR', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue(vehiculo());
      prisma.vehiculo.update.mockResolvedValue(
        vehiculo({ estado: EstadoVehiculo.BAJA }),
      );

      const resultado = await servicio.desactivar(5, ADMIN);

      expect(resultado.estado).toBe(EstadoVehiculo.BAJA);
      expect(prisma.vehiculo.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { estado: EstadoVehiculo.BAJA },
      });
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'DESACTIVAR', 'vehiculo', 5),
      );
    });

    it('si ya estaba en BAJA no lo vuelve a registrar', async () => {
      prisma.vehiculo.findUnique.mockResolvedValue(
        vehiculo({ estado: EstadoVehiculo.BAJA }),
      );

      await servicio.desactivar(5, ADMIN);

      expect(prisma.vehiculo.update).not.toHaveBeenCalled();
      expect(prisma.bitacora.create).not.toHaveBeenCalled();
    });
  });
});
