import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { rangoDelDia } from '../comun/fechas.js';
import { type Paginado, rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConsultaBitacoraDto } from './dto/consulta-bitacora.dto.js';

export interface RegistroBitacora {
  id: number;
  fecha: Date;
  accion: string;
  entidad: string;
  entidadId: number;
  usuario: { id: number; nombre: string; email: string };
}

@Injectable()
export class BitacoraService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registros del más reciente al más antiguo, con el usuario que hizo cada acción. */
  async listar(
    consulta: ConsultaBitacoraDto,
  ): Promise<Paginado<RegistroBitacora>> {
    if (consulta.desde && consulta.hasta && consulta.desde > consulta.hasta) {
      throw new BadRequestException(
        'La fecha "desde" no puede ser posterior a "hasta"',
      );
    }
    const where: Prisma.BitacoraWhereInput = {
      usuarioId: consulta.usuarioId,
      entidad: consulta.entidad,
      // startsWith: "ACTUALIZAR" también encuentra "ACTUALIZAR: 9.5 → 10".
      ...(consulta.accion && { accion: { startsWith: consulta.accion } }),
      ...((consulta.desde || consulta.hasta) && {
        fecha: {
          ...(consulta.desde && { gte: rangoDelDia(consulta.desde).inicio }),
          ...(consulta.hasta && { lt: rangoDelDia(consulta.hasta).fin }),
        },
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.bitacora.findMany({
        where,
        select: {
          id: true,
          fecha: true,
          accion: true,
          entidad: true,
          entidadId: true,
          usuario: { select: { id: true, nombre: true, email: true } },
        },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        ...rango(consulta),
      }),
      this.prisma.bitacora.count({ where }),
    ]);
    return { datos, total, pagina: consulta.pagina, limite: consulta.limite };
  }
}
