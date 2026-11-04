import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { RolUsuario } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { PayloadJwt } from './tipos.js';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'secreto-de-prueba' });
  let hash: string;

  // Simulación (mock) de Prisma: solo los métodos que usa AuthService.
  const findUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const crearBitacora = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const prisma = {
    usuario: { findUnique },
    bitacora: { create: crearBitacora },
  } as unknown as PrismaService;
  const servicio = new AuthService(prisma, jwt);

  const usuario = () => ({
    id: 7,
    nombre: 'Coordinador Prueba',
    email: 'coordinador@prueba.local',
    passwordHash: hash,
    rol: RolUsuario.COORDINADOR,
    activo: true,
  });

  beforeAll(async () => {
    hash = await bcrypt.hash('clave-correcta', 4);
  });

  beforeEach(() => {
    findUnique.mockReset();
    crearBitacora.mockReset();
    crearBitacora.mockResolvedValue({});
  });

  describe('login', () => {
    it('con credenciales correctas devuelve un JWT con id y rol, y los datos públicos', async () => {
      findUnique.mockResolvedValue(usuario());

      const respuesta = await servicio.login(
        'coordinador@prueba.local',
        'clave-correcta',
      );

      const payload = await jwt.verifyAsync<PayloadJwt>(respuesta.accessToken);
      expect(payload.sub).toBe(7);
      expect(payload.rol).toBe(RolUsuario.COORDINADOR);
      expect(respuesta.usuario).toEqual({
        id: 7,
        nombre: 'Coordinador Prueba',
        email: 'coordinador@prueba.local',
        rol: RolUsuario.COORDINADOR,
      });
      expect(respuesta.usuario).not.toHaveProperty('passwordHash');
    });

    it('registra el inicio de sesión en la bitácora', async () => {
      findUnique.mockResolvedValue(usuario());

      await servicio.login('coordinador@prueba.local', 'clave-correcta');

      expect(crearBitacora).toHaveBeenCalledWith({
        data: {
          usuarioId: 7,
          accion: 'INICIO_SESION',
          entidad: 'usuario',
          entidadId: 7,
        },
      });
    });

    it('con contraseña incorrecta responde 401 y no registra en bitácora', async () => {
      findUnique.mockResolvedValue(usuario());

      await expect(
        servicio.login('coordinador@prueba.local', 'otra-clave'),
      ).rejects.toThrow(
        new UnauthorizedException('Correo o contraseña incorrectos'),
      );
      expect(crearBitacora).not.toHaveBeenCalled();
    });

    it('con un correo que no existe responde 401 con el mismo mensaje', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        servicio.login('nadie@prueba.local', 'clave-correcta'),
      ).rejects.toThrow(
        new UnauthorizedException('Correo o contraseña incorrectos'),
      );
    });

    it('con un usuario inactivo responde 401 aunque la contraseña sea correcta', async () => {
      findUnique.mockResolvedValue({ ...usuario(), activo: false });

      await expect(
        servicio.login('coordinador@prueba.local', 'clave-correcta'),
      ).rejects.toThrow(UnauthorizedException);
      expect(crearBitacora).not.toHaveBeenCalled();
    });
  });

  describe('perfil', () => {
    it('devuelve los datos públicos del usuario activo', async () => {
      const { passwordHash: _hash, ...conActivo } = usuario();
      findUnique.mockResolvedValue(conActivo);

      await expect(servicio.perfil(7)).resolves.toEqual({
        id: 7,
        nombre: 'Coordinador Prueba',
        email: 'coordinador@prueba.local',
        rol: RolUsuario.COORDINADOR,
      });
    });

    it('responde 401 si el usuario ya no está activo', async () => {
      findUnique.mockResolvedValue({ ...usuario(), activo: false });

      await expect(servicio.perfil(7)).rejects.toThrow(UnauthorizedException);
    });
  });
});
