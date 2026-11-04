import { Injectable, NotFoundException } from '@nestjs/common';
import type { Operador, Prisma } from '../generated/prisma/client.js';
import { registrarBitacora } from '../comun/bitacora.js';
import { type Paginado, rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarOperadorDto,
  ConsultaOperadoresDto,
  CrearOperadorDto,
} from './dto/operador.dto.js';

const ENTIDAD = 'operador';

@Injectable()
export class OperadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(consulta: ConsultaOperadoresDto): Promise<Paginado<Operador>> {
    const where: Prisma.OperadorWhereInput = {
      disponible: consulta.disponible,
      ...(consulta.buscar && {
        OR: [
          { nombre: { contains: consulta.buscar, mode: 'insensitive' } },
          { licencia: { contains: consulta.buscar, mode: 'insensitive' } },
          { telefono: { contains: consulta.buscar } },
        ],
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.operador.findMany({
        where,
        orderBy: { nombre: 'asc' },
        ...rango(consulta),
      }),
      this.prisma.operador.count({ where }),
    ]);
    return { datos, total, pagina: consulta.pagina, limite: consulta.limite };
  }

  async obtener(id: number): Promise<Operador> {
    const operador = await this.prisma.operador.findUnique({ where: { id } });
    if (!operador) throw new NotFoundException(`No existe el operador ${id}`);
    return operador;
  }

  crear(dto: CrearOperadorDto, usuarioId: number): Promise<Operador> {
    return this.prisma.$transaction(async (tx) => {
      const operador = await tx.operador.create({ data: dto });
      await registrarBitacora(tx, usuarioId, 'CREAR', ENTIDAD, operador.id);
      return operador;
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarOperadorDto,
    usuarioId: number,
  ): Promise<Operador> {
    await this.obtener(id);
    return this.prisma.$transaction(async (tx) => {
      const operador = await tx.operador.update({ where: { id }, data: dto });
      await registrarBitacora(tx, usuarioId, 'ACTUALIZAR', ENTIDAD, id);
      return operador;
    });
  }

  /** Desactivación lógica: el operador queda con disponible = false. */
  async desactivar(id: number, usuarioId: number): Promise<Operador> {
    const actual = await this.obtener(id);
    if (!actual.disponible) return actual;
    return this.prisma.$transaction(async (tx) => {
      const operador = await tx.operador.update({
        where: { id },
        data: { disponible: false },
      });
      await registrarBitacora(tx, usuarioId, 'DESACTIVAR', ENTIDAD, id);
      return operador;
    });
  }
}
