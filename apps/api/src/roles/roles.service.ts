import { performance } from 'node:perf_hooks';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { registrarBitacora } from '../comun/bitacora.js';
import { traducirErrorPrisma } from '../comun/errores-prisma.js';
import { rangoDelDia } from '../comun/fechas.js';
import { generarRol } from '../motor/algoritmo.js';
import type { Motivo } from '../motor/tipos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bloquearRol } from './bloqueo-rol.js';
import { aInstante, fechaDelRol, horaAMinutos } from './conversion.js';
import { aServicioMotor, cargarDatosMotor } from './datos-motor.js';

const ENTIDAD = 'rol_diario';
const MOTIVOS: Motivo[] = [
  'CAPACIDAD',
  'EMPALME',
  'JORNADA',
  'ZONA_TERMINO',
  'SIN_UNIDAD',
];
const NOMBRE = { select: { id: true, nombre: true } } as const;
export const SERVICIO_CON_RUTA = {
  zonaOrigen: NOMBRE,
  zonaDestino: NOMBRE,
  hotel: NOMBRE,
  mayorista: NOMBRE,
} satisfies Prisma.ServicioInclude;
const MINUTO = 60_000;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera el rol de una fecha con los servicios PENDIENTE de ese día y lo
   * guarda en una sola transacción (rol_diario, asignacion, servicio_no_cubierto
   * y bitácora). Si ya hay un rol PROPUESTO de esa fecha lo reemplaza; si está
   * AUTORIZADO responde 409 (se revisa otra vez dentro de la transacción, con
   * la fila bloqueada, por si alguien lo autorizó mientras tanto). Los
   * servicios siguen en PENDIENTE.
   */
  async generar(fecha: string, usuarioId: number) {
    const comienzo = performance.now();
    const existente = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
    });
    if (existente?.estado === 'AUTORIZADO') throw rolAutorizado(fecha);
    const { inicio: inicioDia, fin } = rangoDelDia(fecha);
    const servicios = await this.prisma.servicio.findMany({
      where: { estado: 'PENDIENTE', fechaHora: { gte: inicioDia, lt: fin } },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
    });
    if (servicios.length === 0) {
      throw new BadRequestException(`No hay servicios PENDIENTE el ${fecha}`);
    }

    const { unidades, parametros } = await cargarDatosMotor(
      this.prisma,
      servicios,
    );
    const resultado = generarRol(
      servicios.map((s) => aServicioMotor(inicioDia, s)),
      unidades,
      parametros,
    );
    const tiempoMs = Math.round(performance.now() - comienzo);

    const asignaciones = resultado.unidades.flatMap((u) =>
      u.secuencia.map((s, i) => ({
        servicioId: s.id,
        vehiculoId: u.vehiculoId,
        operadorId: u.operadorId,
        orden: i + 1,
        inicioEfectivo: aInstante(inicioDia, s.inicio),
        liberacion: aInstante(inicioDia, s.liberacion),
      })),
    );
    const noCubiertos = resultado.noCubiertos.map((n) => ({
      servicioId: n.servicio.id,
      motivo: n.motivo,
    }));
    const resumen = {
      servicios: servicios.length,
      asignados: asignaciones.length,
      noCubiertos: noCubiertos.length,
      unidadesDisponibles: resultado.unidades.length,
      unidadesUsadas: resultado.unidades.filter((u) => u.secuencia.length > 0)
        .length,
      tiempoMs,
      porMotivo: Object.fromEntries(
        MOTIVOS.map((m) => [
          m,
          noCubiertos.filter((n) => n.motivo === m).length,
        ]),
      ),
    };

    try {
      const rol = await this.prisma.$transaction(async (tx) => {
        let guardado;
        // Con la fila bloqueada nadie puede autorizar el rol a medio reemplazo.
        const bloqueado = existente ? await bloquearRol(tx, fecha) : null;
        if (bloqueado?.estado === 'AUTORIZADO') throw rolAutorizado(fecha);
        if (existente) {
          // Se reemplaza el rol PROPUESTO anterior dentro de la misma transacción.
          await tx.asignacion.deleteMany({ where: { rolId: existente.id } });
          await tx.servicioNoCubierto.deleteMany({
            where: { rolId: existente.id },
          });
          guardado = await tx.rolDiario.update({
            where: { id: existente.id },
            data: { estado: 'PROPUESTO', generadoEn: new Date() },
          });
        } else {
          guardado = await tx.rolDiario.create({
            data: { fecha: fechaDelRol(fecha), estado: 'PROPUESTO' },
          });
        }
        await tx.asignacion.createMany({
          data: asignaciones.map((a) => ({ ...a, rolId: guardado.id })),
        });
        await tx.servicioNoCubierto.createMany({
          data: noCubiertos.map((n) => ({ ...n, rolId: guardado.id })),
        });
        await registrarBitacora(
          tx,
          usuarioId,
          existente ? 'ACTUALIZAR' : 'CREAR',
          ENTIDAD,
          guardado.id,
          `${fecha}: ${resumen.asignados} asignados, ${resumen.noCubiertos} no cubiertos, ${tiempoMs} ms`,
        );
        return guardado;
      });
      return { rol: { ...rol, fecha }, reemplazado: !!existente, resumen };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // Dos generaciones simultáneas de la misma fecha (fecha es única).
      traducirErrorPrisma(error, {
        duplicado: `Se está generando otro rol del ${fecha}; inténtalo de nuevo`,
      });
    }
  }

  /**
   * Rol de una fecha para la pantalla de revisión: estado y autorización,
   * cada unidad que participa (también las que no tienen servicios) con su
   * operador, hora de cita y fin de jornada, sus asignaciones por inicio
   * efectivo con el traslado en vacío previo, y los no cubiertos con motivo.
   */
  async obtener(fecha: string) {
    const rol = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
      include: {
        autorizador: NOMBRE,
        asignaciones: {
          orderBy: [{ inicioEfectivo: 'asc' }, { orden: 'asc' }],
          include: { servicio: { include: SERVICIO_CON_RUTA } },
        },
        noCubiertos: {
          include: { servicio: { include: SERVICIO_CON_RUTA } },
          orderBy: [{ servicio: { fechaHora: 'asc' } }, { id: 'asc' }],
        },
      },
    });
    if (!rol) throw new NotFoundException(`No hay rol del ${fecha}`);

    const [vehiculos, zonas, tiempos, jornada] = await Promise.all([
      this.prisma.vehiculo.findMany({
        where: {
          OR: [
            { operador: { isNot: null } },
            { id: { in: rol.asignaciones.map((a) => a.vehiculoId) } },
          ],
        },
        include: {
          operador: {
            select: {
              id: true,
              nombre: true,
              horaCita: true,
              disponible: true,
            },
          },
        },
      }),
      this.prisma.zona.findMany({ select: { id: true, nombre: true } }),
      this.prisma.tiempoTraslado.findMany(),
      this.prisma.parametroOperacion.findUnique({
        where: { clave: 'jornada_maxima_horas' },
      }),
    ]);
    const { inicio: inicioDia } = rangoDelDia(fecha);
    const jornadaMin = Number(jornada?.valor ?? 0) * 60;
    const minutos = new Map(
      tiempos.map((t) => [`${t.zonaOrigenId}-${t.zonaDestinoId}`, t.minutos]),
    );
    const zonaPorNombre = new Map(
      zonas.map((z) => [z.nombre.toLowerCase(), z]),
    );

    const unidades = vehiculos
      .map((v) => {
        const encierro = zonaPorNombre.get(v.encierroBase.toLowerCase());
        const cita = v.operador?.horaCita
          ? horaAMinutos(v.operador.horaCita)
          : null;
        // Traslado en vacío antes de cada servicio: desde el encierro a la
        // hora de cita o desde el destino y la liberación del anterior.
        let zona = encierro?.id;
        let libre = cita === null ? null : aInstante(inicioDia, cita);
        const asignaciones = rol.asignaciones
          .filter((a) => a.vehiculoId === v.id)
          .map((a) => {
            const t =
              zona === undefined
                ? undefined
                : minutos.get(`${zona}-${a.servicio.zonaOrigenId}`);
            const vacio =
              libre && t !== undefined
                ? {
                    minutos: t,
                    desde: libre,
                    hasta: new Date(libre.getTime() + t * MINUTO),
                  }
                : null;
            zona = a.servicio.zonaDestinoId;
            libre = a.liberacion;
            return { ...a, vacio };
          });
        return {
          vehiculo: {
            id: v.id,
            numeroEconomico: v.numeroEconomico,
            tipo: v.tipo,
            capacidad: v.capacidad,
          },
          operador: v.operador
            ? {
                id: v.operador.id,
                nombre: v.operador.nombre,
                horaCita: v.operador.horaCita,
              }
            : null,
          disponible:
            v.estado === 'DISPONIBLE' &&
            !!v.operador?.disponible &&
            cita !== null,
          encierro: encierro ?? null,
          cita: cita === null ? null : aInstante(inicioDia, cita),
          finJornada:
            cita === null ? null : aInstante(inicioDia, cita + jornadaMin),
          asignaciones,
        };
      })
      // Solo las unidades que participan (disponibles) o que tienen servicios.
      .filter((u) => u.disponible || u.asignaciones.length > 0)
      .sort((a, b) =>
        a.vehiculo.numeroEconomico.localeCompare(
          b.vehiculo.numeroEconomico,
          'es',
          { numeric: true },
        ),
      );

    const { asignaciones, noCubiertos, ...datos } = rol;
    return {
      ...datos,
      fecha,
      resumen: {
        servicios: asignaciones.length + noCubiertos.length,
        asignados: asignaciones.length,
        noCubiertos: noCubiertos.length,
        unidadesUsadas: unidades.filter((u) => u.asignaciones.length > 0)
          .length,
      },
      unidades,
      noCubiertos,
    };
  }

  /** Servicios no cubiertos del rol de una fecha, con su motivo (CU-14). */
  async noCubiertos(fecha: string) {
    const rol = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
      select: { id: true },
    });
    if (!rol) throw new NotFoundException(`No hay rol del ${fecha}`);
    return this.prisma.servicioNoCubierto.findMany({
      where: { rolId: rol.id },
      include: { servicio: { include: SERVICIO_CON_RUTA } },
      orderBy: [{ servicio: { fechaHora: 'asc' } }, { id: 'asc' }],
    });
  }
}

const rolAutorizado = (fecha: string) =>
  new ConflictException(
    `El rol del ${fecha} ya está AUTORIZADO; no se puede volver a generar`,
  );
