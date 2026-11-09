import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { rangoDelDia } from '../comun/fechas.js';
import { rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConsultaServiciosDto } from './dto/consulta-servicios.dto.js';

const NOMBRE = { select: { id: true, nombre: true } } as const;

/** Consulta de servicios (solo lectura). */
@Injectable()
export class ServiciosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Servicios ordenados por hora, con sus filtros y paginación. */
  async listar(consulta: ConsultaServiciosDto) {
    const dia = consulta.fecha ? rangoDelDia(consulta.fecha) : null;
    const where: Prisma.ServicioWhereInput = {
      mayoristaId: consulta.mayoristaId,
      tipo: consulta.tipo,
      modalidad: consulta.modalidad,
      estado: consulta.estado,
      importacionId: consulta.importacionId,
      ...(dia && { fechaHora: { gte: dia.inicio, lt: dia.fin } }),
      ...(consulta.zonaId && {
        OR: [
          { zonaOrigenId: consulta.zonaId },
          { zonaDestinoId: consulta.zonaId },
        ],
      }),
      ...(consulta.buscar && {
        AND: {
          OR: [
            { folio: { contains: consulta.buscar, mode: 'insensitive' } },
            { localizador: { contains: consulta.buscar, mode: 'insensitive' } },
            { vuelo: { contains: consulta.buscar, mode: 'insensitive' } },
          ],
        },
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.servicio.findMany({
        where,
        include: {
          mayorista: NOMBRE,
          zonaOrigen: NOMBRE,
          zonaDestino: NOMBRE,
          hotel: NOMBRE,
        },
        orderBy: [{ fechaHora: 'asc' }, { id: 'asc' }],
        ...rango(consulta),
      }),
      this.prisma.servicio.count({ where }),
    ]);
    return { datos, total, pagina: consulta.pagina, limite: consulta.limite };
  }
}
