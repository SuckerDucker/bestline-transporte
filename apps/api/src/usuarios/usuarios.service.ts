import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { Prisma, RolUsuario } from '../generated/prisma/client.js';
import { type AccionBitacora, registrarBitacora } from '../comun/bitacora.js';
import { traducirErrorPrisma } from '../comun/errores-prisma.js';
import { type Paginado, rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarUsuarioDto,
  ConsultaUsuariosDto,
  CrearUsuarioDto,
} from './dto/usuario.dto.js';

const ENTIDAD = 'usuario';
/** Costo de bcrypt (2^10 rondas), el mismo que usa el seed. */
export const RONDAS_BCRYPT = 10;

/**
 * Columnas que se devuelven de un usuario. password_hash nunca sale de la API:
 * se usa un select explícito en todas las consultas.
 */
const CAMPOS_PUBLICOS = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
} satisfies Prisma.UsuarioSelect;

export interface UsuarioRespuesta {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    consulta: ConsultaUsuariosDto,
  ): Promise<Paginado<UsuarioRespuesta>> {
    const where: Prisma.UsuarioWhereInput = {
      rol: consulta.rol,
      activo: consulta.activo,
      ...(consulta.buscar && {
        OR: [
          { nombre: { contains: consulta.buscar, mode: 'insensitive' } },
          { email: { contains: consulta.buscar, mode: 'insensitive' } },
        ],
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where,
        select: CAMPOS_PUBLICOS,
        orderBy: { nombre: 'asc' },
        ...rango(consulta),
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return { datos, total, pagina: consulta.pagina, limite: consulta.limite };
  }

  async obtener(id: number): Promise<UsuarioRespuesta> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: CAMPOS_PUBLICOS,
    });
    if (!usuario) throw new NotFoundException(`No existe el usuario ${id}`);
    return usuario;
  }

  async crear(
    dto: CrearUsuarioDto,
    adminId: number,
  ): Promise<UsuarioRespuesta> {
    const { password, ...datos } = dto;
    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
          data: { ...datos, passwordHash },
          select: CAMPOS_PUBLICOS,
        });
        await registrarBitacora(tx, adminId, 'CREAR', ENTIDAD, usuario.id);
        return usuario;
      });
    } catch (error) {
      traducirErrorPrisma(error, {
        duplicado: `Ya existe un usuario con el correo ${dto.email}`,
      });
    }
  }

  /**
   * Edita nombre y rol. Un administrador no puede quitarse a sí mismo el rol
   * de ADMINISTRADOR: así siempre queda al menos uno que pueda administrar.
   */
  async actualizar(
    id: number,
    dto: ActualizarUsuarioDto,
    adminId: number,
  ): Promise<UsuarioRespuesta> {
    const actual = await this.obtener(id);
    if (id === adminId && dto.rol && dto.rol !== actual.rol) {
      throw new BadRequestException(
        'No puedes quitarte el rol de ADMINISTRADOR a ti mismo',
      );
    }
    const detalle =
      dto.rol && dto.rol !== actual.rol
        ? `rol ${actual.rol} → ${dto.rol}`
        : undefined;
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id },
        data: dto,
        select: CAMPOS_PUBLICOS,
      });
      await registrarBitacora(tx, adminId, 'ACTUALIZAR', ENTIDAD, id, detalle);
      return usuario;
    });
  }

  async cambiarPassword(
    id: number,
    password: string,
    adminId: number,
  ): Promise<UsuarioRespuesta> {
    await this.obtener(id);
    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id },
        data: { passwordHash },
        select: CAMPOS_PUBLICOS,
      });
      await registrarBitacora(tx, adminId, 'CAMBIAR_PASSWORD', ENTIDAD, id);
      return usuario;
    });
  }

  /** Un administrador no puede desactivarse a sí mismo (400). */
  async desactivar(id: number, adminId: number): Promise<UsuarioRespuesta> {
    if (id === adminId) {
      throw new BadRequestException('No puedes desactivar tu propio usuario');
    }
    return this.cambiarActivo(id, false, adminId);
  }

  reactivar(id: number, adminId: number): Promise<UsuarioRespuesta> {
    return this.cambiarActivo(id, true, adminId);
  }

  /** Si el usuario ya estaba en ese estado, no se modifica ni se registra. */
  private async cambiarActivo(
    id: number,
    activo: boolean,
    adminId: number,
  ): Promise<UsuarioRespuesta> {
    const actual = await this.obtener(id);
    if (actual.activo === activo) return actual;
    const accion: AccionBitacora = activo ? 'REACTIVAR' : 'DESACTIVAR';
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.update({
        where: { id },
        data: { activo },
        select: CAMPOS_PUBLICOS,
      });
      await registrarBitacora(tx, adminId, accion, ENTIDAD, id);
      return usuario;
    });
  }
}
