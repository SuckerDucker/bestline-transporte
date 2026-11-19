import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fechaDelRol } from '../roles/conversion.js';
import type { ExportarDto } from './dto/exportar.dto.js';
import {
  type RolExportado,
  rolACsv,
  rolAPdf,
  type UnidadExportada,
} from './rol-exportado.js';

const NOMBRE = { select: { nombre: true } } as const;

/** Archivo listo para enviar: contenido, tipo y nombre. */
export interface Archivo {
  contenido: Buffer;
  tipo: string;
  nombre: string;
}

/**
 * Exportación del rol de un día por operador (o de todos) en CSV o PDF.
 * El OPERADOR solo exporta su propio rol y solo si está AUTORIZADO.
 */
@Injectable()
export class ExportacionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Operador cuyo rol se exporta (o null = todos), según quién lo pide. */
  private async operadorPedido(
    dto: ExportarDto,
    usuario: UsuarioAutenticado,
  ): Promise<number | null> {
    if (usuario.rol !== 'OPERADOR') return dto.operadorId ?? null;
    const propio = await this.prisma.operador.findUnique({
      where: { usuarioId: usuario.id },
      select: { id: true },
    });
    if (!propio) {
      throw new NotFoundException('Tu usuario no está ligado a un operador');
    }
    if (dto.operadorId !== undefined && dto.operadorId !== propio.id) {
      throw new ForbiddenException('Solo puedes exportar tu propio rol');
    }
    return propio.id;
  }

  /** Rol del día agrupado por unidad, con los servicios en orden. */
  async leerRol(
    fecha: string,
    dto: ExportarDto,
    usuario: UsuarioAutenticado,
  ): Promise<RolExportado> {
    const operadorId = await this.operadorPedido(dto, usuario);
    const rol = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
      include: {
        asignaciones: {
          where: operadorId === null ? {} : { operadorId },
          orderBy: [{ inicioEfectivo: 'asc' }, { orden: 'asc' }],
          include: {
            servicio: {
              include: {
                zonaOrigen: NOMBRE,
                zonaDestino: NOMBRE,
                hotel: NOMBRE,
              },
            },
            vehiculo: {
              select: { numeroEconomico: true, tipo: true, capacidad: true },
            },
            operador: { select: { nombre: true, horaCita: true } },
          },
        },
      },
    });
    const soloAutorizado = usuario.rol === 'OPERADOR';
    if (!rol || (soloAutorizado && rol.estado !== 'AUTORIZADO')) {
      throw new NotFoundException(
        `No hay rol${soloAutorizado ? ' autorizado' : ''} del ${fecha}`,
      );
    }
    if (operadorId !== null && rol.asignaciones.length === 0) {
      throw new NotFoundException(
        `El operador no tiene servicios en el rol del ${fecha}`,
      );
    }

    const unidades = new Map<number, UnidadExportada>();
    for (const a of rol.asignaciones) {
      const u = unidades.get(a.vehiculoId) ?? {
        numeroEconomico: a.vehiculo.numeroEconomico,
        tipo: a.vehiculo.tipo,
        capacidad: a.vehiculo.capacidad,
        operador: a.operador.nombre,
        cita: a.operador.horaCita,
        servicios: [],
      };
      const s = a.servicio;
      u.servicios.push({
        orden: u.servicios.length + 1,
        folio: s.folio,
        tipo: s.tipo,
        modalidad: s.modalidad,
        presentarse: a.inicioEfectivo,
        hora: s.fechaHora,
        libre: a.liberacion,
        origen: s.zonaOrigen.nombre,
        destino: s.zonaDestino.nombre,
        hotel: s.hotel?.nombre ?? null,
        pasajeros: s.pasajeros,
        vuelo: s.vuelo,
        estado: s.estado,
      });
      unidades.set(a.vehiculoId, u);
    }
    return {
      fecha,
      estado: rol.estado,
      unidades: [...unidades.values()].sort((a, b) =>
        a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', {
          numeric: true,
        }),
      ),
    };
  }

  /** Archivo CSV o PDF del rol; el nombre lleva la fecha y la unidad si es una sola. */
  async exportar(
    fecha: string,
    dto: ExportarDto,
    usuario: UsuarioAutenticado,
  ): Promise<Archivo> {
    const rol = await this.leerRol(fecha, dto, usuario);
    const sufijo =
      rol.unidades.length === 1 &&
      (dto.operadorId || usuario.rol === 'OPERADOR')
        ? `-${rol.unidades[0].numeroEconomico}`
        : '';
    const nombre = `rol-${fecha}${sufijo}.${dto.formato}`;
    return dto.formato === 'csv'
      ? {
          contenido: Buffer.from(rolACsv(rol), 'utf8'),
          tipo: 'text/csv; charset=utf-8',
          nombre,
        }
      : { contenido: await rolAPdf(rol), tipo: 'application/pdf', nombre };
  }
}
