import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EstadoServicio, Prisma } from '../generated/prisma/client.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { registrarBitacora } from '../comun/bitacora.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fechaDelRol } from '../roles/conversion.js';
import { SERVICIO_CON_RUTA } from '../roles/roles.service.js';
import type { CambiarEstadoDto } from './dto/cambiar-estado.dto.js';
import type { IncidenciaDto } from './dto/incidencia.dto.js';
import { horasReales, validarTransicion } from './transiciones.js';

/** Estados que se cuentan en los totales del tablero (en este orden). */
export const ESTADOS_TABLERO: EstadoServicio[] = [
  'PROGRAMADO',
  'EN_RUTA',
  'EN_SERVICIO',
  'COMPLETADO',
  'CANCELADO',
  'NO_SHOW',
];
const LARGO_ACCION = 255;

/** Asignación con su servicio, unidad y operador, como la usa el tablero. */
const ASIGNACION_TABLERO = {
  servicio: {
    include: {
      ...SERVICIO_CON_RUTA,
      _count: { select: { incidencias: true } },
    },
  },
  vehiculo: { select: { id: true, numeroEconomico: true, tipo: true } },
  operador: { select: { id: true, nombre: true, usuarioId: true } },
} satisfies Prisma.AsignacionInclude;
type AsignacionTablero = Prisma.AsignacionGetPayload<{
  include: typeof ASIGNACION_TABLERO;
}>;

/** Un servicio está retrasado si su hora ya pasó y sigue PROGRAMADO. */
export const estaRetrasado = (
  s: { estado: EstadoServicio; fechaHora: Date },
  ahora: Date,
) => s.estado === 'PROGRAMADO' && s.fechaHora.getTime() < ahora.getTime();

/** Fila del tablero: servicio, unidad, operador y si va retrasado. */
function fila(a: AsignacionTablero, ahora: Date) {
  const { _count, ...servicio } = a.servicio;
  return {
    asignacionId: a.id,
    orden: a.orden,
    inicioEfectivo: a.inicioEfectivo,
    liberacion: a.liberacion,
    vehiculo: a.vehiculo,
    operador: { id: a.operador.id, nombre: a.operador.nombre },
    servicio,
    incidencias: _count.incidencias,
    retrasado: estaRetrasado(servicio, ahora),
  };
}

/** Totales por estado (todos los del tablero, también los que están en 0). */
export function totalesPorEstado(
  filas: { servicio: { estado: EstadoServicio }; retrasado: boolean }[],
) {
  const porEstado = Object.fromEntries(
    ESTADOS_TABLERO.map((e) => [e, 0]),
  ) as Record<EstadoServicio, number>;
  for (const f of filas)
    porEstado[f.servicio.estado] = (porEstado[f.servicio.estado] ?? 0) + 1;
  return {
    total: filas.length,
    retrasados: filas.filter((f) => f.retrasado).length,
    porEstado,
  };
}

/**
 * Monitoreo del día (Fase 13): tablero de los servicios del rol AUTORIZADO,
 * cambios de estado con transiciones válidas e incidencias. Todo cambio se
 * registra en la bitácora en la misma transacción.
 */
@Injectable()
export class MonitoreoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Rol AUTORIZADO de la fecha con sus asignaciones; 404 si no lo hay. */
  private async rolAutorizado(
    fecha: string,
    where: Prisma.AsignacionWhereInput = {},
  ) {
    const rol = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
      include: {
        asignaciones: {
          where,
          include: ASIGNACION_TABLERO,
          orderBy: [{ servicio: { fechaHora: 'asc' } }, { orden: 'asc' }],
        },
      },
    });
    if (!rol || rol.estado !== 'AUTORIZADO') {
      throw new NotFoundException(`No hay rol autorizado del ${fecha}`);
    }
    return rol;
  }

  /** Tablero del día: servicios asignados del rol AUTORIZADO y totales. */
  async tablero(fecha: string) {
    const rol = await this.rolAutorizado(fecha);
    const ahora = new Date();
    const servicios = rol.asignaciones.map((a) => fila(a, ahora));
    return {
      fecha,
      rol: { id: rol.id, estado: rol.estado, autorizadoEn: rol.autorizadoEn },
      totales: totalesPorEstado(servicios),
      servicios,
    };
  }

  /** Servicios del operador que tiene sesión, en el orden en que los hace. */
  async misServicios(fecha: string, usuario: UsuarioAutenticado) {
    const operador = await this.prisma.operador.findUnique({
      where: { usuarioId: usuario.id },
      include: {
        vehiculo: { select: { id: true, numeroEconomico: true, tipo: true } },
      },
    });
    if (!operador) {
      throw new NotFoundException('Tu usuario no está ligado a un operador');
    }
    const rol = await this.rolAutorizado(fecha, { operadorId: operador.id });
    const ahora = new Date();
    const servicios = rol.asignaciones
      .map((a) => fila(a, ahora))
      .sort((a, b) => a.inicioEfectivo.getTime() - b.inicioEfectivo.getTime());
    return {
      fecha,
      operador: {
        id: operador.id,
        nombre: operador.nombre,
        horaCita: operador.horaCita,
      },
      vehiculo: operador.vehiculo,
      totales: totalesPorEstado(servicios),
      servicios,
    };
  }

  /**
   * Asignación del servicio en un rol AUTORIZADO. 404 si el servicio no
   * existe; 400 si no está en un rol autorizado.
   */
  private async asignacionAutorizada(servicioId: number) {
    const servicio = await this.prisma.servicio.findUnique({
      where: { id: servicioId },
      include: {
        asignaciones: {
          where: { rol: { estado: 'AUTORIZADO' } },
          include: { operador: { select: { usuarioId: true } } },
        },
      },
    });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    const asignacion = servicio.asignaciones[0];
    if (!asignacion) {
      throw new BadRequestException(
        `El servicio ${servicio.folio} no está asignado en un rol autorizado`,
      );
    }
    return { servicio, asignacion };
  }

  /**
   * Cambia el estado de un servicio. Revisa el permiso del rol y la tabla de
   * transiciones; el OPERADOR solo en sus servicios. Guarda la hora real de
   * inicio (EN_RUTA) o de término (COMPLETADO). El cambio es condicional al
   * estado leído: si otro usuario lo cambió antes, responde 409.
   */
  async cambiarEstado(
    servicioId: number,
    dto: CambiarEstadoDto,
    usuario: UsuarioAutenticado,
  ) {
    const { servicio, asignacion } =
      await this.asignacionAutorizada(servicioId);
    // Primero si el servicio es suyo: a un operador no se le dice nada del
    // estado de un servicio ajeno.
    if (
      usuario.rol === 'OPERADOR' &&
      asignacion.operador.usuarioId !== usuario.id
    ) {
      throw new ForbiddenException('Solo puedes actualizar tus servicios');
    }
    const resultado = validarTransicion(
      servicio.estado,
      dto.estado,
      usuario.rol,
    );
    if (!resultado.valida) {
      throw resultado.codigo === 403
        ? new ForbiddenException(resultado.mensaje)
        : new BadRequestException(resultado.mensaje);
    }

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.servicio.updateMany({
        where: { id: servicioId, estado: servicio.estado },
        data: { estado: dto.estado, ...horasReales(dto.estado, new Date()) },
      });
      if (count === 0) {
        throw new ConflictException(
          'El servicio cambió de estado mientras tanto; vuelve a cargar el tablero',
        );
      }
      const detalle = `${servicio.folio}: ${servicio.estado} → ${dto.estado}${dto.nota ? ` · ${dto.nota}` : ''}`;
      await registrarBitacora(
        tx,
        usuario.id,
        'CAMBIAR_ESTADO',
        'servicio',
        servicioId,
        detalle.slice(0, LARGO_ACCION - 'CAMBIAR_ESTADO: '.length),
      );
      return tx.servicio.findUniqueOrThrow({
        where: { id: servicioId },
        include: SERVICIO_CON_RUTA,
      });
    });
  }

  /** Registra una incidencia sobre un servicio de un rol autorizado. */
  async registrarIncidencia(
    servicioId: number,
    dto: IncidenciaDto,
    usuario: UsuarioAutenticado,
  ) {
    const { servicio } = await this.asignacionAutorizada(servicioId);
    const descripcion = dto.descripcion.trim();
    if (!descripcion) {
      throw new BadRequestException('descripcion es obligatoria');
    }
    return this.prisma.$transaction(async (tx) => {
      const incidencia = await tx.incidencia.create({
        data: {
          servicioId,
          usuarioId: usuario.id,
          tipo: dto.tipo,
          descripcion,
        },
        include: { usuario: { select: { id: true, nombre: true } } },
      });
      await registrarBitacora(
        tx,
        usuario.id,
        'CREAR',
        'incidencia',
        incidencia.id,
        `${servicio.folio}: ${dto.tipo}`,
      );
      return incidencia;
    });
  }

  /** Incidencias de los servicios del día (rol autorizado), las más nuevas primero. */
  async incidenciasDelDia(fecha: string) {
    const rol = await this.rolAutorizado(fecha);
    const incidencias = await this.prisma.incidencia.findMany({
      where: { servicioId: { in: rol.asignaciones.map((a) => a.servicioId) } },
      orderBy: { fecha: 'desc' },
      include: {
        usuario: { select: { id: true, nombre: true } },
        servicio: {
          select: {
            id: true,
            folio: true,
            asignaciones: {
              where: { rolId: rol.id },
              select: {
                vehiculo: { select: { id: true, numeroEconomico: true } },
              },
            },
          },
        },
      },
    });
    return incidencias.map(
      ({ servicio: { asignaciones, ...servicio }, ...i }) => ({
        ...i,
        servicio,
        vehiculo: asignaciones[0]?.vehiculo ?? null,
      }),
    );
  }
}
