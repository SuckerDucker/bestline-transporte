import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { RolUsuario } from '../generated/prisma/client.js';
import {
  comoPrisma,
  crearPrismaSimulado,
  errorPrisma,
  type PrismaSimulado,
  registroBitacora,
} from '../comun/pruebas/prisma-simulado.js';
import { UsuariosService } from './usuarios.service.js';

const ADMIN = 1;
const usuario = (cambios = {}) => ({
  id: 5,
  nombre: 'Coordinadora de turno',
  email: 'turno@bestline.local',
  rol: RolUsuario.COORDINADOR,
  activo: true,
  ...cambios,
});

describe('UsuariosService', () => {
  let prisma: PrismaSimulado;
  let servicio: UsuariosService;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
    servicio = new UsuariosService(comoPrisma(prisma));
  });

  it('listar filtra por rol, activo y búsqueda, y nunca pide password_hash', async () => {
    prisma.usuario.findMany.mockResolvedValue([usuario()]);
    prisma.usuario.count.mockResolvedValue(1);

    const pagina = await servicio.listar({
      rol: RolUsuario.COORDINADOR,
      activo: true,
      buscar: 'turno',
      pagina: 2,
      limite: 5,
    });

    expect(pagina).toMatchObject({ total: 1, pagina: 2, limite: 5 });
    const [args] = prisma.usuario.findMany.mock.calls[0] as [
      { where: object; select: Record<string, boolean>; skip: number },
    ];
    expect(args.where).toMatchObject({
      rol: 'COORDINADOR',
      activo: true,
      OR: expect.any(Array),
    });
    expect(args.skip).toBe(5);
    expect(args.select).not.toHaveProperty('passwordHash');
  });

  it('obtener responde 404 si no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(servicio.obtener(99)).rejects.toThrow(NotFoundException);
  });

  it('crear cifra la contraseña con bcrypt y registra CREAR', async () => {
    prisma.usuario.create.mockResolvedValue(usuario());

    const creado = await servicio.crear(
      {
        nombre: 'Coordinadora de turno',
        email: 'turno@bestline.local',
        password: 'Contraseña-segura',
        rol: RolUsuario.COORDINADOR,
      },
      ADMIN,
    );

    expect(creado).not.toHaveProperty('passwordHash');
    const [args] = prisma.usuario.create.mock.calls[0] as [
      { data: { passwordHash: string; password?: string } },
    ];
    expect(args.data.password).toBeUndefined();
    expect(args.data.passwordHash).not.toBe('Contraseña-segura');
    await expect(
      bcrypt.compare('Contraseña-segura', args.data.passwordHash),
    ).resolves.toBe(true);
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'CREAR', 'usuario', 5),
    );
  });

  it('crear con correo repetido responde 409', async () => {
    prisma.usuario.create.mockRejectedValue(errorPrisma('P2002'));
    await expect(
      servicio.crear(
        {
          nombre: 'X',
          email: 'turno@bestline.local',
          password: 'Contraseña-segura',
          rol: RolUsuario.OPERADOR,
        },
        ADMIN,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('actualizar cambia el rol y lo deja en el texto de la bitácora', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario());
    prisma.usuario.update.mockResolvedValue(
      usuario({ rol: RolUsuario.SUPERVISOR }),
    );

    await servicio.actualizar(5, { rol: RolUsuario.SUPERVISOR }, ADMIN);

    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(
        ADMIN,
        'ACTUALIZAR: rol COORDINADOR → SUPERVISOR',
        'usuario',
        5,
      ),
    );
  });

  it('actualizar el nombre registra ACTUALIZAR sin detalle', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario());
    prisma.usuario.update.mockResolvedValue(usuario({ nombre: 'Nuevo' }));

    await servicio.actualizar(5, { nombre: 'Nuevo' }, ADMIN);

    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'ACTUALIZAR', 'usuario', 5),
    );
  });

  it('un administrador no puede quitarse el rol de ADMINISTRADOR (400)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(
      usuario({ id: ADMIN, rol: RolUsuario.ADMINISTRADOR }),
    );

    await expect(
      servicio.actualizar(ADMIN, { rol: RolUsuario.COORDINADOR }, ADMIN),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('un administrador sí puede cambiar su propio nombre', async () => {
    const yo = usuario({ id: ADMIN, rol: RolUsuario.ADMINISTRADOR });
    prisma.usuario.findUnique.mockResolvedValue(yo);
    prisma.usuario.update.mockResolvedValue({ ...yo, nombre: 'Admin' });

    await expect(
      servicio.actualizar(
        ADMIN,
        { nombre: 'Admin', rol: RolUsuario.ADMINISTRADOR },
        ADMIN,
      ),
    ).resolves.toMatchObject({ nombre: 'Admin' });
  });

  it('cambiarPassword guarda el nuevo hash y registra CAMBIAR_PASSWORD', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario());
    prisma.usuario.update.mockResolvedValue(usuario());

    await servicio.cambiarPassword(5, 'Otra-contraseña', ADMIN);

    const [args] = prisma.usuario.update.mock.calls[0] as [
      { data: { passwordHash: string } },
    ];
    await expect(
      bcrypt.compare('Otra-contraseña', args.data.passwordHash),
    ).resolves.toBe(true);
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'CAMBIAR_PASSWORD', 'usuario', 5),
    );
  });

  it('desactivar deja activo = false y registra DESACTIVAR', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario());
    prisma.usuario.update.mockResolvedValue(usuario({ activo: false }));

    await expect(servicio.desactivar(5, ADMIN)).resolves.toMatchObject({
      activo: false,
    });
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activo: false } }),
    );
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'DESACTIVAR', 'usuario', 5),
    );
  });

  it('un administrador no puede desactivarse a sí mismo (400)', async () => {
    await expect(servicio.desactivar(ADMIN, ADMIN)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('reactivar deja activo = true y registra REACTIVAR', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario({ activo: false }));
    prisma.usuario.update.mockResolvedValue(usuario());

    await servicio.reactivar(5, ADMIN);

    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      registroBitacora(ADMIN, 'REACTIVAR', 'usuario', 5),
    );
  });

  it('reactivar un usuario ya activo no lo modifica ni lo registra', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario());

    await servicio.reactivar(5, ADMIN);

    expect(prisma.usuario.update).not.toHaveBeenCalled();
    expect(prisma.bitacora.create).not.toHaveBeenCalled();
  });
});
