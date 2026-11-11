import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { registrarBitacora } from '../comun/bitacora.js';
import { rangoDelDia } from '../comun/fechas.js';
import { calcularHoras } from '../motor/algoritmo.js';
import type { ServicioCalculado, UnidadEnRol } from '../motor/tipos.js';
import { verificarRol } from '../motor/verificador.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bloquearRolPropuesto } from './bloqueo-rol.js';
import { aInstante, aMinutos, fechaDelRol } from './conversion.js';
import {
  aServicioMotor,
  cargarDatosMotor,
  type ClientePrisma,
} from './datos-motor.js';
import { type Revision, revisarMovimiento } from './revalidacion.js';

/** Opción del selector "Mover a…" / "Asignar a…". */
export interface OpcionUnidad {
  vehiculoId: number;
  numeroEconomico: string;
  capacidad: number;
  /** Es la unidad que hoy tiene el servicio. */
  actual: boolean;
  valido: boolean;
  motivo?: string;
  detalle?: string;
  /** Posición (1, 2, …) que tendría el servicio en la unidad. */
  posicion?: number;
}

/**
 * Revisión manual del rol PROPUESTO (CU-15): opciones para mover un servicio,
 * mover, asignar un no cubierto y autorizar. Toda revalidación usa las mismas
 * funciones del motor (revalidacion.ts → revisarSecuencia).
 */
@Injectable()
export class RevisionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Para cada unidad: si acepta el servicio y, si no, por qué. */
  async opciones(fecha: string, servicioId: number): Promise<OpcionUnidad[]> {
    const rol = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
      select: { id: true },
    });
    if (!rol) throw new NotFoundException(`No hay rol del ${fecha}`);
    const e = await leerEstado(this.prisma, rol.id, fecha);
    const s = servicioDelRol(e, servicioId, fecha);
    const actual = e.asignaciones.find((a) => a.servicioId === servicioId);
    const origen = actual ? unidadDe(e, actual.vehiculoId) : null;

    const opciones = e.unidades.map((u): OpcionUnidad => {
      const datos = {
        vehiculoId: u.vehiculoId,
        numeroEconomico: u.numeroEconomico,
        capacidad: u.capacidad,
        actual: u.vehiculoId === actual?.vehiculoId,
      };
      if (datos.actual) {
        return {
          ...datos,
          valido: false,
          detalle: 'Es la unidad actual del servicio',
        };
      }
      const r = revisarMovimiento(
        s,
        u,
        origen,
        e.datos.parametros,
        e.datos.nombreZona,
      );
      return r.valido
        ? { ...datos, valido: true, posicion: r.posicion + 1 }
        : { ...datos, valido: false, motivo: r.motivo, detalle: r.detalle };
    });
    // Primero las válidas; dentro de cada grupo, por número económico.
    return opciones.sort(
      (a, b) =>
        Number(b.valido) - Number(a.valido) ||
        a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', {
          numeric: true,
        }),
    );
  }

  /** PATCH asignaciones/:id: mueve el servicio a otra unidad. */
  async mover(
    fecha: string,
    asignacionId: number,
    vehiculoId: number,
    usuarioId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rol = await bloquearRolPropuesto(tx, fecha);
      // Se lee todo DESPUÉS del bloqueo: si otro coordinador acaba de mover un
      // servicio, aquí ya se ve su cambio.
      const e = await leerEstado(tx, rol.id, fecha);
      const asignacion = e.asignaciones.find((a) => a.id === asignacionId);
      if (!asignacion) {
        throw new NotFoundException(
          `La asignación ${asignacionId} no es del rol del ${fecha}`,
        );
      }
      const s = e.calculados.get(asignacion.servicioId) as ServicioCalculado;
      const origen = unidadDe(e, asignacion.vehiculoId);
      if (asignacion.vehiculoId === vehiculoId) {
        throw new BadRequestException(
          `El servicio ${s.folio} ya está en ${origen?.numeroEconomico ?? `la unidad ${vehiculoId}`}`,
        );
      }
      const destino = await unidadDestino(tx, e, vehiculoId);
      const r = revisarMovimiento(
        s,
        destino,
        origen,
        e.datos.parametros,
        e.datos.nombreZona,
      );
      if (!r.valido) throw rechazo(r);

      const guardada = await tx.asignacion.update({
        where: { id: asignacionId },
        data: {
          vehiculoId,
          operadorId: destino.operadorId,
          inicioEfectivo: aInstante(e.inicioDia, s.inicio),
          liberacion: aInstante(e.inicioDia, s.liberacion),
        },
      });
      await renumerar(tx, rol.id, destino, s, r.posicion);
      if (origen) await renumerar(tx, rol.id, origen, s, null);
      const de = origen?.numeroEconomico ?? `vehículo ${asignacion.vehiculoId}`;
      await registrarBitacora(
        tx,
        usuarioId,
        'ACTUALIZAR',
        'asignacion',
        asignacionId,
        `${fecha}: ${s.folio} de ${de} a ${destino.numeroEconomico}`,
      );
      return {
        asignacion: { ...guardada, orden: r.posicion + 1 },
        de,
        a: destino.numeroEconomico,
      };
    });
  }

  /** POST no-cubiertos/:servicioId/asignar: asigna un no cubierto a una unidad. */
  async asignarNoCubierto(
    fecha: string,
    servicioId: number,
    vehiculoId: number,
    usuarioId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rol = await bloquearRolPropuesto(tx, fecha);
      const e = await leerEstado(tx, rol.id, fecha);
      const noCubierto = e.noCubiertos.find((n) => n.servicioId === servicioId);
      if (!noCubierto) {
        throw new NotFoundException(
          `El servicio ${servicioId} no está en los no cubiertos del rol del ${fecha}`,
        );
      }
      const s = e.calculados.get(servicioId) as ServicioCalculado;
      const destino = await unidadDestino(tx, e, vehiculoId);
      const r = revisarMovimiento(
        s,
        destino,
        null,
        e.datos.parametros,
        e.datos.nombreZona,
      );
      if (!r.valido) throw rechazo(r);

      await tx.servicioNoCubierto.delete({ where: { id: noCubierto.id } });
      const creada = await tx.asignacion.create({
        data: {
          rolId: rol.id,
          servicioId,
          vehiculoId,
          operadorId: destino.operadorId,
          orden: r.posicion + 1,
          inicioEfectivo: aInstante(e.inicioDia, s.inicio),
          liberacion: aInstante(e.inicioDia, s.liberacion),
        },
      });
      await renumerar(tx, rol.id, destino, s, r.posicion);
      await registrarBitacora(
        tx,
        usuarioId,
        'CREAR',
        'asignacion',
        creada.id,
        `${fecha}: ${s.folio} (no cubierto por ${noCubierto.motivo}) a ${destino.numeroEconomico}`,
      );
      return { asignacion: creada, a: destino.numeroEconomico };
    });
  }

  /**
   * Autoriza el rol: corre antes el verificador independiente sobre lo
   * guardado (red de seguridad) y, si pasa, en la misma transacción: rol
   * AUTORIZADO con usuario y fecha, servicios asignados → PROGRAMADO y bitácora.
   */
  async autorizar(fecha: string, usuarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const rol = await bloquearRolPropuesto(tx, fecha);
      const e = await leerEstado(tx, rol.id, fecha);
      const { parametros } = e.datos;
      const porUnidad = new Map<
        number,
        { id: number; inicio: number; liberacion: number }[]
      >();
      for (const a of e.asignaciones) {
        porUnidad.set(a.vehiculoId, [
          ...(porUnidad.get(a.vehiculoId) ?? []),
          {
            id: a.servicioId,
            inicio: aMinutos(e.inicioDia, a.inicioEfectivo),
            liberacion: aMinutos(e.inicioDia, a.liberacion),
          },
        ]);
      }
      const violaciones = verificarRol(
        {
          servicios: [...e.calculados.values()],
          unidades: e.datos.unidades,
          anticipacion: parametros.anticipacion,
          jornadaMaxima: parametros.jornadaMaxima,
          zonasTermino: parametros.zonasTermino,
          matriz: e.datos.matriz,
        },
        {
          asignaciones: [...porUnidad].map(([vehiculoId, servicios]) => ({
            vehiculoId,
            servicios,
          })),
          noCubiertos: e.noCubiertos.map((n) => n.servicioId),
        },
      );
      if (violaciones.length) {
        throw new BadRequestException({
          message:
            'El rol no pasa el verificador independiente; no se autorizó',
          violaciones,
          error: 'Bad Request',
          statusCode: 400,
        });
      }

      const autorizado = await tx.rolDiario.update({
        where: { id: rol.id },
        data: {
          estado: 'AUTORIZADO',
          autorizadoPor: usuarioId,
          autorizadoEn: new Date(),
        },
      });
      const { count } = await tx.servicio.updateMany({
        where: { id: { in: e.asignaciones.map((a) => a.servicioId) } },
        data: { estado: 'PROGRAMADO' },
      });
      await registrarBitacora(
        tx,
        usuarioId,
        'AUTORIZAR',
        'rol_diario',
        rol.id,
        `${fecha}: ${count} servicios PROGRAMADO, ${e.noCubiertos.length} no cubiertos`,
      );
      return {
        rol: { ...autorizado, fecha },
        programados: count,
        noCubiertos: e.noCubiertos.length,
      };
    });
  }
}

type Estado = Awaited<ReturnType<typeof leerEstado>>;

/**
 * Estado actual del rol leído de la base: asignaciones (por unidad y orden),
 * no cubiertos, datos del motor y cada servicio con sus horas calculadas por
 * el motor (calcularHoras). Las unidades llevan su secuencia actual.
 */
async function leerEstado(prisma: ClientePrisma, rolId: number, fecha: string) {
  const [asignaciones, noCubiertos] = await Promise.all([
    prisma.asignacion.findMany({
      where: { rolId },
      orderBy: [{ vehiculoId: 'asc' }, { orden: 'asc' }],
      include: { servicio: true },
    }),
    prisma.servicioNoCubierto.findMany({
      where: { rolId },
      include: { servicio: true },
    }),
  ]);
  const filas = [
    ...asignaciones.map((a) => a.servicio),
    ...noCubiertos.map((n) => n.servicio),
  ];
  const datos = await cargarDatosMotor(prisma, filas);
  const { inicio: inicioDia } = rangoDelDia(fecha);
  const calculados = new Map(
    calcularHoras(
      filas.map((s) => aServicioMotor(inicioDia, s)),
      datos.parametros,
    ).map((s) => [s.id, s]),
  );
  const unidades: UnidadEnRol[] = datos.unidades.map((u) => ({
    ...u,
    secuencia: asignaciones
      .filter((a) => a.vehiculoId === u.vehiculoId)
      .map((a) => calculados.get(a.servicioId) as ServicioCalculado),
  }));
  return { asignaciones, noCubiertos, datos, calculados, unidades, inicioDia };
}

const unidadDe = (e: Estado, vehiculoId: number) =>
  e.unidades.find((u) => u.vehiculoId === vehiculoId) ?? null;

function servicioDelRol(e: Estado, servicioId: number, fecha: string) {
  const s = e.calculados.get(servicioId);
  if (!s)
    throw new NotFoundException(
      `El servicio ${servicioId} no es del rol del ${fecha}`,
    );
  return s;
}

/** Unidad destino: 404 si el vehículo no existe; DISPONIBILIDAD si no tiene operador. */
async function unidadDestino(
  prisma: ClientePrisma,
  e: Estado,
  vehiculoId: number,
) {
  const destino = unidadDe(e, vehiculoId);
  if (destino) return destino;
  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id: vehiculoId },
  });
  if (!vehiculo)
    throw new NotFoundException(`No existe el vehículo ${vehiculoId}`);
  throw rechazo({
    valido: false,
    motivo: 'DISPONIBILIDAD',
    detalle: `${vehiculo.numeroEconomico} no tiene operador asignado`,
  });
}

/** 400 con el motivo y el detalle de la revalidación. */
const rechazo = (r: Extract<Revision, { valido: false }>) =>
  new BadRequestException({
    message: r.detalle,
    motivo: r.motivo,
    detalle: r.detalle,
    error: 'Bad Request',
    statusCode: 400,
  });

/**
 * Vuelve a numerar `orden` (1, 2, …) en la unidad: con s en `posicion` si es
 * el destino, o sin s si es el origen (posicion = null).
 */
async function renumerar(
  prisma: ClientePrisma,
  rolId: number,
  u: UnidadEnRol,
  s: ServicioCalculado,
  posicion: number | null,
) {
  const sin = u.secuencia.filter((x) => x.id !== s.id);
  const secuencia =
    posicion === null
      ? sin
      : [...sin.slice(0, posicion), s, ...sin.slice(posicion)];
  for (const [i, x] of secuencia.entries()) {
    await prisma.asignacion.updateMany({
      where: { rolId, servicioId: x.id },
      data: { orden: i + 1 },
    });
  }
}
