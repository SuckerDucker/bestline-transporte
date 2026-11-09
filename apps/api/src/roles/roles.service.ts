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
import { crearTiempo, generarRol } from '../motor/algoritmo.js';
import type {
  Modalidad,
  Motivo,
  ParametrosMotor,
  UnidadMotor,
} from '../motor/tipos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  aInstante,
  aMinutos,
  fechaDelRol,
  horaAMinutos,
} from './conversion.js';

const ENTIDAD = 'rol_diario';
const MOTIVOS: Motivo[] = [
  'CAPACIDAD',
  'EMPALME',
  'JORNADA',
  'ZONA_TERMINO',
  'SIN_UNIDAD',
];
const NOMBRE = { select: { id: true, nombre: true } } as const;
const SERVICIO_CON_RUTA = {
  zonaOrigen: NOMBRE,
  zonaDestino: NOMBRE,
  hotel: NOMBRE,
  mayorista: NOMBRE,
} satisfies Prisma.ServicioInclude;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera el rol de una fecha con los servicios PENDIENTE de ese día y lo
   * guarda en una sola transacción (rol_diario, asignacion, servicio_no_cubierto
   * y bitácora). Si ya hay un rol PROPUESTO de esa fecha lo reemplaza; si está
   * AUTORIZADO responde 409. Los servicios siguen en PENDIENTE.
   */
  async generar(fecha: string, usuarioId: number) {
    const comienzo = performance.now();
    const existente = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
    });
    if (existente?.estado === 'AUTORIZADO') {
      throw new ConflictException(
        `El rol del ${fecha} ya está AUTORIZADO; no se puede volver a generar`,
      );
    }
    const { inicio: inicioDia, fin } = rangoDelDia(fecha);
    const servicios = await this.prisma.servicio.findMany({
      where: { estado: 'PENDIENTE', fechaHora: { gte: inicioDia, lt: fin } },
      orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
    });
    if (servicios.length === 0) {
      throw new BadRequestException(`No hay servicios PENDIENTE el ${fecha}`);
    }

    const { unidades, parametros } = await this.cargarDatos(servicios);
    const resultado = generarRol(
      servicios.map((s) => ({
        id: s.id,
        folio: s.folio,
        hora: aMinutos(inicioDia, s.fechaHora),
        modalidad: s.modalidad as Modalidad,
        pasajeros: s.pasajeros,
        origen: s.zonaOrigenId,
        destino: s.zonaDestinoId,
      })),
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
      // Dos generaciones simultáneas de la misma fecha (fecha es única).
      traducirErrorPrisma(error, {
        duplicado: `Se está generando otro rol del ${fecha}; inténtalo de nuevo`,
      });
    }
  }

  /** Rol de una fecha con sus asignaciones agrupadas por unidad. */
  async obtener(fecha: string) {
    const rol = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
      include: {
        asignaciones: {
          orderBy: [{ vehiculoId: 'asc' }, { orden: 'asc' }],
          include: {
            servicio: { include: SERVICIO_CON_RUTA },
            vehiculo: {
              select: {
                id: true,
                numeroEconomico: true,
                tipo: true,
                capacidad: true,
              },
            },
            operador: { select: { id: true, nombre: true, horaCita: true } },
          },
        },
        _count: { select: { noCubiertos: true } },
      },
    });
    if (!rol) throw new NotFoundException(`No hay rol del ${fecha}`);

    const porUnidad = new Map<number, (typeof rol.asignaciones)[number][]>();
    for (const a of rol.asignaciones) {
      porUnidad.set(a.vehiculoId, [...(porUnidad.get(a.vehiculoId) ?? []), a]);
    }
    const unidades = [...porUnidad.values()]
      .map((lista) => ({
        vehiculo: lista[0].vehiculo,
        operador: lista[0].operador,
        asignaciones: lista.map(({ vehiculo: _v, operador: _o, ...a }) => a),
      }))
      .sort((a, b) =>
        a.vehiculo.numeroEconomico.localeCompare(
          b.vehiculo.numeroEconomico,
          'es',
          { numeric: true },
        ),
      );
    const { asignaciones, _count, ...datos } = rol;
    return {
      ...datos,
      fecha,
      resumen: {
        servicios: asignaciones.length + _count.noCubiertos,
        asignados: asignaciones.length,
        noCubiertos: _count.noCubiertos,
        unidadesUsadas: unidades.length,
      },
      unidades,
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

  /**
   * Unidades (vehículo con su operador) y parámetros del motor. Responde 400 si
   * falta un parámetro, si el encierro de una unidad no es una zona o si la
   * matriz no tiene algún tiempo que el motor necesita.
   */
  private async cargarDatos(
    servicios: { zonaOrigenId: number; zonaDestinoId: number }[],
  ): Promise<{ unidades: UnidadMotor[]; parametros: ParametrosMotor }> {
    const [vehiculos, zonas, tiempos, filas] = await Promise.all([
      // Un vehículo sin operador no participa.
      this.prisma.vehiculo.findMany({
        where: { operador: { isNot: null } },
        include: { operador: true },
      }),
      this.prisma.zona.findMany(),
      this.prisma.tiempoTraslado.findMany(),
      this.prisma.parametroOperacion.findMany(),
    ]);
    const valor = (clave: string) => {
      const fila = filas.find((p) => p.clave === clave);
      if (!fila) throw new BadRequestException(`Falta el parámetro ${clave}`);
      return fila.valor;
    };
    const turno1 = valor('hora_cita.turno_1');
    const zonaPorNombre = new Map(
      zonas.map((z) => [z.nombre.toLowerCase(), z]),
    );
    const nombreZona = new Map(zonas.map((z) => [z.id, z.nombre]));

    const unidades: UnidadMotor[] = vehiculos.flatMap((v) => {
      const operador = v.operador;
      if (!operador) return [];
      const disponible = v.estado === 'DISPONIBLE' && operador.disponible;
      const encierro = zonaPorNombre.get(v.encierroBase.toLowerCase());
      if (disponible && !encierro) {
        throw new BadRequestException(
          `El encierro base de ${v.numeroEconomico} ("${v.encierroBase}") no es una zona del catálogo`,
        );
      }
      const unidad: UnidadMotor = {
        vehiculoId: v.id,
        numeroEconomico: v.numeroEconomico,
        capacidad: v.capacidad,
        operadorId: operador.id,
        disponible,
        cita: horaAMinutos(operador.horaCita ?? turno1),
        encierro: encierro?.id ?? 0,
      };
      return [unidad];
    });

    // La matriz debe tener todos los tiempos entre las zonas que se usarán:
    // encierros, orígenes y destinos de los servicios del día.
    const matriz = new Map(
      tiempos.map((t) => [`${t.zonaOrigenId}-${t.zonaDestinoId}`, t.minutos]),
    );
    const usadas = [
      ...new Set([
        ...unidades.filter((u) => u.disponible).map((u) => u.encierro),
        ...servicios.flatMap((s) => [s.zonaOrigenId, s.zonaDestinoId]),
      ]),
    ];
    const faltantes = usadas.flatMap((o) =>
      usadas
        .filter((d) => !matriz.has(`${o}-${d}`))
        .map((d) => `${nombreZona.get(o)} → ${nombreZona.get(d)}`),
    );
    if (faltantes.length) {
      throw new BadRequestException({
        message: `La matriz de tiempos está incompleta: faltan ${faltantes.length} combinaciones`,
        faltantes,
        error: 'Bad Request',
        statusCode: 400,
      });
    }

    return {
      unidades,
      parametros: {
        anticipacion: {
          PRIVADO: Number(valor('anticipacion.PRIVADO')),
          COMPARTIDO: Number(valor('anticipacion.COMPARTIDO')),
          GRUPO: Number(valor('anticipacion.GRUPO')),
        },
        jornadaMaxima: Number(valor('jornada_maxima_horas')) * 60,
        penalizacionCarga: Number(valor('motor.penalizacion_carga_min')),
        zonasTermino: new Set(
          zonas.filter((z) => z.esZonaTermino).map((z) => z.id),
        ),
        tiempo: crearTiempo(matriz),
      },
    };
  }
}
