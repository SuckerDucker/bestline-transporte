import { Injectable } from '@nestjs/common';
import { EstadoServicio, EstadoVehiculo } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fechaEnCancun, rangoDelDia } from './fechas.js';

export interface Resumen {
  vehiculos: { activos: number; disponibles: number; enMantenimiento: number };
  operadores: { disponibles: number; total: number };
  zonas: { total: number; deTermino: number };
  hoteles: { total: number };
  servicios: { fecha: string; pendientes: number; total: number };
}

/** Conteos de solo lectura para la pantalla de inicio. */
@Injectable()
export class ResumenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param fecha Día de operación (YYYY-MM-DD, hora de Cancún). Si no se indica,
   *   se usa el próximo día con servicios a partir de hoy; si no hay ninguno, hoy.
   * @param ahora Momento actual (se puede fijar en las pruebas).
   */
  async obtener(fecha?: string, ahora: Date = new Date()): Promise<Resumen> {
    const dia =
      fecha ??
      (await this.proximoDiaConServicios(ahora)) ??
      fechaEnCancun(ahora);
    const { inicio, fin } = rangoDelDia(dia);
    const delDia = { fechaHora: { gte: inicio, lt: fin } };

    // Todas las consultas en una sola transacción de lectura (datos consistentes).
    const [
      disponibles,
      enMantenimiento,
      operadoresDisponibles,
      operadoresTotal,
      zonas,
      zonasDeTermino,
      hoteles,
      pendientes,
      serviciosDelDia,
    ] = await this.prisma.$transaction([
      this.prisma.vehiculo.count({
        where: { estado: EstadoVehiculo.DISPONIBLE },
      }),
      this.prisma.vehiculo.count({
        where: { estado: EstadoVehiculo.MANTENIMIENTO },
      }),
      this.prisma.operador.count({ where: { disponible: true } }),
      this.prisma.operador.count(),
      this.prisma.zona.count(),
      this.prisma.zona.count({ where: { esZonaTermino: true } }),
      this.prisma.hotel.count(),
      this.prisma.servicio.count({
        where: { ...delDia, estado: EstadoServicio.PENDIENTE },
      }),
      this.prisma.servicio.count({ where: delDia }),
    ]);

    return {
      // "Activos" = todos los que no están dados de BAJA.
      vehiculos: {
        activos: disponibles + enMantenimiento,
        disponibles,
        enMantenimiento,
      },
      operadores: {
        disponibles: operadoresDisponibles,
        total: operadoresTotal,
      },
      zonas: { total: zonas, deTermino: zonasDeTermino },
      hoteles: { total: hoteles },
      servicios: { fecha: dia, pendientes, total: serviciosDelDia },
    };
  }

  /** Fecha (Cancún) del primer servicio desde el inicio de hoy, o null si no hay. */
  private async proximoDiaConServicios(ahora: Date): Promise<string | null> {
    const { inicio } = rangoDelDia(fechaEnCancun(ahora));
    const servicio = await this.prisma.servicio.findFirst({
      where: { fechaHora: { gte: inicio } },
      orderBy: { fechaHora: 'asc' },
      select: { fechaHora: true },
    });
    return servicio ? fechaEnCancun(servicio.fechaHora) : null;
  }
}
