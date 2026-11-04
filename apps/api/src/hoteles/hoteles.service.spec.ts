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
import { HotelesService } from './hoteles.service.js';

const ADMIN = 1;
const hotelBd = (cambios = {}) => ({
  id: 6,
  nombre: 'Hotel Ejemplo Playa 1',
  zonaId: 6,
  latitud: '20.633500',
  longitud: '-87.070500',
  zona: { id: 6, nombre: 'Playa del Carmen' },
  ...cambios,
});
const dto = {
  nombre: 'Hotel Ejemplo Playa 1',
  zonaId: 6,
  latitud: 20.6335,
  longitud: -87.0705,
};

describe('HotelesService', () => {
  let prisma: PrismaSimulado;
  let servicio: HotelesService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new HotelesService(comoPrisma(prisma));
  });

  it('listar filtra por zona e incluye la zona con coordenadas numéricas', async () => {
    prisma.hotel.findMany.mockResolvedValue([hotelBd()]);
    prisma.hotel.count.mockResolvedValue(1);

    const pagina = await servicio.listar({ zonaId: 6, pagina: 1, limite: 10 });

    expect(pagina.datos[0]).toMatchObject({
      latitud: 20.6335,
      longitud: -87.0705,
      zona: { nombre: 'Playa del Carmen' },
    });
    expect(prisma.hotel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { zonaId: 6 } }),
    );
  });

  it('obtener responde 404 si no existe', async () => {
    prisma.hotel.findUnique.mockResolvedValue(null);
    await expect(servicio.obtener(99)).rejects.toThrow(NotFoundException);
  });

  describe('crear', () => {
    it('guarda el hotel y registra CREAR en la bitácora', async () => {
      prisma.zona.count.mockResolvedValue(1);
      prisma.hotel.create.mockResolvedValue(hotelBd());

      const hotel = await servicio.crear(dto, ADMIN);

      expect(hotel.latitud).toBe(20.6335);
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'CREAR', 'hotel', 6),
      );
    });

    it('responde 400 si la zona no existe y no crea nada', async () => {
      prisma.zona.count.mockResolvedValue(0);

      await expect(
        servicio.crear({ ...dto, zonaId: 99 }, ADMIN),
      ).rejects.toThrow(new BadRequestException('La zona 99 no existe'));
      expect(prisma.hotel.create).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('guarda los cambios y registra ACTUALIZAR (sin revisar zona si no cambia)', async () => {
      prisma.hotel.findUnique.mockResolvedValue(hotelBd());
      prisma.hotel.update.mockResolvedValue(
        hotelBd({ nombre: 'Hotel Ejemplo Playa 1B' }),
      );

      await servicio.actualizar(6, { nombre: 'Hotel Ejemplo Playa 1B' }, ADMIN);

      expect(prisma.zona.count).not.toHaveBeenCalled();
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'ACTUALIZAR', 'hotel', 6),
      );
    });

    it('responde 400 si se cambia a una zona que no existe', async () => {
      prisma.hotel.findUnique.mockResolvedValue(hotelBd());
      prisma.zona.count.mockResolvedValue(0);

      await expect(
        servicio.actualizar(6, { zonaId: 99 }, ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.hotel.update).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('responde 409 si algún servicio lo referencia, sin borrar', async () => {
      prisma.hotel.findUnique.mockResolvedValue(hotelBd());
      prisma.servicio.count.mockResolvedValue(5);

      await expect(servicio.eliminar(6, ADMIN)).rejects.toThrow(
        new ConflictException(
          'No se puede eliminar el hotel "Hotel Ejemplo Playa 1": está referenciado por 5 servicio(s)',
        ),
      );
      expect(prisma.hotel.delete).not.toHaveBeenCalled();
      expect(prisma.bitacora.create).not.toHaveBeenCalled();
    });

    it('borra el hotel sin referencias y registra ELIMINAR', async () => {
      prisma.hotel.findUnique.mockResolvedValue(hotelBd());
      prisma.servicio.count.mockResolvedValue(0);
      prisma.hotel.delete.mockResolvedValue(hotelBd());

      await expect(servicio.eliminar(6, ADMIN)).resolves.toEqual({ id: 6 });
      expect(prisma.bitacora.create).toHaveBeenCalledWith(
        registroBitacora(ADMIN, 'ELIMINAR', 'hotel', 6),
      );
    });

    it('responde 409 si la base rechaza el borrado por llave foránea (P2003)', async () => {
      prisma.hotel.findUnique.mockResolvedValue(hotelBd());
      prisma.servicio.count.mockResolvedValue(0);
      prisma.hotel.delete.mockRejectedValue(errorPrisma('P2003'));

      await expect(servicio.eliminar(6, ADMIN)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
