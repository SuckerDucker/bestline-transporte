import { Injectable, NotFoundException } from '@nestjs/common';
import { conCoordenadasNumericas } from '../comun/coordenadas.js';
import { instanteCancun } from '../comun/fechas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fechaDelRol } from '../roles/conversion.js';
import { armarParadas } from './armado-ruta.js';
import { OsrmCliente } from './osrm.cliente.js';

const ZONA = {
  select: {
    id: true,
    nombre: true,
    latitud: true,
    longitud: true,
    esZonaTermino: true,
  },
} as const;

/** Rutas sugeridas: el recorrido de una unidad en el rol del día (CU-17). */
@Injectable()
export class RutasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly osrm: OsrmCliente,
  ) {}

  async obtener(fecha: string, vehiculoId: number) {
    const rol = await this.prisma.rolDiario.findUnique({
      where: { fecha: fechaDelRol(fecha) },
      select: { id: true, estado: true },
    });
    if (!rol) throw new NotFoundException(`No hay rol del ${fecha}`);

    const filas = await this.prisma.asignacion.findMany({
      where: { rolId: rol.id, vehiculoId },
      orderBy: [{ inicioEfectivo: 'asc' }, { orden: 'asc' }],
      include: {
        vehiculo: true,
        operador: { select: { id: true, nombre: true, horaCita: true } },
        servicio: {
          include: {
            zonaOrigen: ZONA,
            zonaDestino: ZONA,
            hotel: {
              select: {
                id: true,
                nombre: true,
                zonaId: true,
                latitud: true,
                longitud: true,
              },
            },
          },
        },
      },
    });
    if (filas.length === 0) {
      throw new NotFoundException(
        `La unidad no tiene servicios en el rol del ${fecha}`,
      );
    }
    const { vehiculo, operador } = filas[0];

    const [encierroBd, tiempos] = await Promise.all([
      this.prisma.zona.findFirst({
        where: {
          nombre: { equals: vehiculo.encierroBase, mode: 'insensitive' },
        },
        ...ZONA,
      }),
      this.prisma.tiempoTraslado.findMany(),
    ]);
    if (!encierroBd) {
      throw new NotFoundException(
        `El encierro "${vehiculo.encierroBase}" no es una zona del catálogo`,
      );
    }
    const minutos = new Map(
      tiempos.map((t) => [`${t.zonaOrigenId}-${t.zonaDestinoId}`, t.minutos]),
    );

    const paradas = armarParadas({
      encierro: conCoordenadasNumericas(encierroBd),
      // Sin hora de cita el operador no entra al rol; por si acaso, se usa
      // el inicio efectivo del primer servicio.
      cita: operador.horaCita
        ? instanteCancun(fecha, operador.horaCita)
        : filas[0].inicioEfectivo,
      tiempo: (o, d) => minutos.get(`${o}-${d}`),
      asignaciones: filas.map((a) => ({
        inicioEfectivo: a.inicioEfectivo,
        liberacion: a.liberacion,
        servicio: {
          ...a.servicio,
          zonaOrigen: conCoordenadasNumericas(a.servicio.zonaOrigen),
          zonaDestino: conCoordenadasNumericas(a.servicio.zonaDestino),
          hotel: a.servicio.hotel
            ? conCoordenadasNumericas(a.servicio.hotel)
            : null,
        },
      })),
    });
    const trazado = await this.osrm.trazar(paradas);

    return {
      fecha,
      estadoRol: rol.estado,
      vehiculo: {
        id: vehiculo.id,
        numeroEconomico: vehiculo.numeroEconomico,
        tipo: vehiculo.tipo,
        capacidad: vehiculo.capacidad,
      },
      operador,
      servicios: filas.length,
      paradas,
      ...trazado,
    };
  }
}
