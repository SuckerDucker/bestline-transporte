import { NotFoundException } from '@nestjs/common';
import {
  comoPrisma,
  crearPrismaSimulado,
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
    expect(prisma.operador.create).toHaveBeenCalledWith({ data: dto });
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

    expect(prisma.operador.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { telefono: '998-111-2233' },
    });
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
    expect(prisma.operador.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { disponible: false },
    });
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
});
