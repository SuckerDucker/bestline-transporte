import { jest } from '@jest/globals';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '../../generated/prisma/client.js';
import {
  comoPrisma,
  crearPrismaSimulado,
  type PrismaSimulado,
} from '../../comun/pruebas/prisma-simulado.js';
import type { PeticionAutenticada } from '../tipos.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

/** Contexto de ejecución mínimo con la petición indicada. */
const contexto = (peticion: PeticionAutenticada) =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => peticion }),
  }) as unknown as ExecutionContext;

/** Reflector simulado que devuelve el metadato indicado. */
const reflector = (valor: unknown) =>
  ({ getAllAndOverride: jest.fn(() => valor) }) as unknown as Reflector;

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: 'secreto-de-prueba' });
  let prisma: PrismaSimulado;

  beforeEach(() => {
    prisma = crearPrismaSimulado();
  });

  const guard = (esPublica = false) =>
    new JwtAuthGuard(reflector(esPublica), jwt, comoPrisma(prisma));
  const conToken = (token: string): PeticionAutenticada => ({
    headers: { authorization: `Bearer ${token}` },
  });

  it('deja pasar las rutas públicas sin token', async () => {
    await expect(
      guard(true).canActivate(contexto({ headers: {} })),
    ).resolves.toBe(true);
  });

  it('responde 401 si falta el token', async () => {
    await expect(
      guard().canActivate(contexto({ headers: {} })),
    ).rejects.toThrow(new UnauthorizedException('Falta el token de acceso'));
  });

  it('responde 401 si el token no es válido', async () => {
    await expect(
      guard().canActivate(contexto(conToken('a.b.c'))),
    ).rejects.toThrow(new UnauthorizedException('Token inválido o expirado'));
  });

  it('responde 401 si el usuario del token ya no está activo', async () => {
    const token = await jwt.signAsync({ sub: 2, rol: RolUsuario.SUPERVISOR });
    prisma.usuario.findUnique.mockResolvedValue({
      id: 2,
      rol: RolUsuario.SUPERVISOR,
      activo: false,
    });

    await expect(
      guard().canActivate(contexto(conToken(token))),
    ).rejects.toThrow(
      new UnauthorizedException('El usuario no existe o está inactivo'),
    );
  });

  it('responde 401 si el usuario del token ya no existe', async () => {
    const token = await jwt.signAsync({ sub: 2, rol: RolUsuario.SUPERVISOR });
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      guard().canActivate(contexto(conToken(token))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('con token válido deja el usuario en la petición con el rol de la base de datos', async () => {
    // El token dice COORDINADOR, pero en la base ya es SUPERVISOR: manda la base.
    const token = await jwt.signAsync({ sub: 2, rol: RolUsuario.COORDINADOR });
    prisma.usuario.findUnique.mockResolvedValue({
      id: 2,
      rol: RolUsuario.SUPERVISOR,
      activo: true,
    });
    const peticion = conToken(token);

    await expect(guard().canActivate(contexto(peticion))).resolves.toBe(true);
    expect(peticion.usuario).toEqual({ id: 2, rol: RolUsuario.SUPERVISOR });
  });
});

describe('RolesGuard', () => {
  const peticion = (rol: RolUsuario): PeticionAutenticada => ({
    headers: {},
    usuario: { id: 1, rol },
  });

  it('deja pasar si la ruta no exige roles', () => {
    const guard = new RolesGuard(reflector(undefined));
    expect(guard.canActivate(contexto(peticion(RolUsuario.OPERADOR)))).toBe(
      true,
    );
  });

  it('deja pasar si el usuario tiene uno de los roles exigidos', () => {
    const guard = new RolesGuard(reflector([RolUsuario.ADMINISTRADOR]));
    expect(
      guard.canActivate(contexto(peticion(RolUsuario.ADMINISTRADOR))),
    ).toBe(true);
  });

  it('responde 403 si el usuario no tiene el rol exigido', () => {
    const guard = new RolesGuard(reflector([RolUsuario.ADMINISTRADOR]));
    expect(() =>
      guard.canActivate(contexto(peticion(RolUsuario.COORDINADOR))),
    ).toThrow(ForbiddenException);
  });
});
