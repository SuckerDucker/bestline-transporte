import { BadRequestException, Injectable } from '@nestjs/common';
import { ParseFechaPipe } from '../comun/fecha.pipe.js';
import { fechaEnCancun, instanteCancun, rangoDelDia } from '../comun/fechas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fechaDelRol } from '../roles/conversion.js';
import { verificarRolGuardado } from '../roles/revision.service.js';
import {
  type AsignacionDia,
  indicadoresDelDia,
  type Motivo,
  resumenDelRango,
} from './calculo.js';
import type { RangoDto } from './dto/rango.dto.js';

/** Máximo de días por consulta (un mes). */
export const MAXIMO_DIAS = 31;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Días AAAA-MM-DD del rango, incluidos los dos extremos. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (
    let t = Date.parse(`${desde}T00:00:00Z`);
    t <= Date.parse(`${hasta}T00:00:00Z`);
    t += UN_DIA_MS
  ) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

/** Agrupa una lista por la fecha (en Cancún) que devuelve "fecha". */
function porFecha<T>(lista: T[], fecha: (x: T) => Date) {
  const grupos = new Map<string, T[]>();
  for (const x of lista) {
    const dia = fechaEnCancun(fecha(x));
    grupos.set(dia, [...(grupos.get(dia) ?? []), x]);
  }
  return grupos;
}

/**
 * Indicadores (Fase 14): por cada día del rango, servicios, asignados, no
 * cubiertos por motivo, cobertura, empalmes del verificador en los roles
 * AUTORIZADOS, completados, cancelados, no show, incidencias por tipo,
 * ocupación y horas de jornada por unidad; y los totales del rango.
 */
@Injectable()
export class IndicadoresService {
  constructor(private readonly prisma: PrismaService) {}

  /** 400 si una fecha no existe, si desde > hasta o si son más de 31 días. */
  validarRango({ desde, hasta }: RangoDto): string[] {
    const pipe = new ParseFechaPipe();
    pipe.transform(desde);
    pipe.transform(hasta);
    if (desde > hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    const dias = diasDelRango(desde, hasta);
    if (dias.length > MAXIMO_DIAS) {
      throw new BadRequestException(
        `El rango puede tener como máximo ${MAXIMO_DIAS} días`,
      );
    }
    return dias;
  }

  async calcular(rango: RangoDto) {
    const dias = this.validarRango(rango);
    const inicio = rangoDelDia(rango.desde).inicio;
    const fin = rangoDelDia(rango.hasta).fin;
    const enRango = { fechaHora: { gte: inicio, lt: fin } };

    const [servicios, roles, incidencias, zonas, tiempos] = await Promise.all([
      this.prisma.servicio.findMany({
        where: enRango,
        select: { estado: true, fechaHora: true },
      }),
      this.prisma.rolDiario.findMany({
        where: {
          fecha: {
            gte: fechaDelRol(rango.desde),
            lte: fechaDelRol(rango.hasta),
          },
        },
        include: {
          asignaciones: {
            include: {
              servicio: { select: { pasajeros: true, zonaDestinoId: true } },
              vehiculo: {
                select: {
                  numeroEconomico: true,
                  capacidad: true,
                  encierroBase: true,
                },
              },
              operador: { select: { horaCita: true } },
            },
          },
          noCubiertos: { select: { motivo: true } },
        },
      }),
      this.prisma.incidencia.findMany({
        where: { servicio: enRango },
        select: { tipo: true, servicio: { select: { fechaHora: true } } },
      }),
      this.prisma.zona.findMany({
        select: { id: true, nombre: true, esZonaTermino: true },
      }),
      this.prisma.tiempoTraslado.findMany(),
    ]);

    const zonasTermino = new Set(
      zonas.filter((z) => z.esZonaTermino).map((z) => z.id),
    );
    const zonaPorNombre = new Map(
      zonas.map((z) => [z.nombre.toLowerCase(), z.id]),
    );
    const minutos = new Map(
      tiempos.map((t) => [`${t.zonaOrigenId}-${t.zonaDestinoId}`, t.minutos]),
    );
    const tiempo = (o: number, d: number) => minutos.get(`${o}-${d}`);
    const serviciosPorDia = porFecha(servicios, (s) => s.fechaHora);
    const incidenciasPorDia = porFecha(
      incidencias,
      (i) => i.servicio.fechaHora,
    );
    const rolPorDia = new Map(
      roles.map((r) => [r.fecha.toISOString().slice(0, 10), r]),
    );

    const resultado = [];
    for (const fecha of dias) {
      const rol = rolPorDia.get(fecha) ?? null;
      const asignaciones: AsignacionDia[] = (rol?.asignaciones ?? []).map(
        (a) => ({
          vehiculoId: a.vehiculoId,
          numeroEconomico: a.vehiculo.numeroEconomico,
          capacidad: a.vehiculo.capacidad,
          pasajeros: a.servicio.pasajeros,
          cita: a.operador.horaCita
            ? instanteCancun(fecha, a.operador.horaCita)
            : null,
          liberacion: a.liberacion,
          destinoId: a.servicio.zonaDestinoId,
          encierroId:
            zonaPorNombre.get(a.vehiculo.encierroBase.toLowerCase()) ?? null,
        }),
      );
      const empalmes =
        rol?.estado === 'AUTORIZADO'
          ? (await verificarRolGuardado(this.prisma, rol.id, fecha)).length
          : null;
      resultado.push(
        indicadoresDelDia({
          fecha,
          rol: rol ? { estado: rol.estado } : null,
          estados: (serviciosPorDia.get(fecha) ?? []).map((s) => s.estado),
          asignaciones,
          noCubiertos: (rol?.noCubiertos ?? []).map((n) => n.motivo as Motivo),
          incidencias: (incidenciasPorDia.get(fecha) ?? []).map((i) => i.tipo),
          empalmes,
          zonasTermino,
          tiempo,
        }),
      );
    }
    return {
      desde: rango.desde,
      hasta: rango.hasta,
      resumen: resumenDelRango(resultado),
      dias: resultado,
    };
  }
}
