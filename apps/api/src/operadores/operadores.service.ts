import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { registrarBitacora } from '../comun/bitacora.js';
import { traducirErrorPrisma } from '../comun/errores-prisma.js';
import { type Paginado, rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarOperadorDto,
  ConsultaOperadoresDto,
  CrearOperadorDto,
} from './dto/operador.dto.js';

const ENTIDAD = 'operador';

/** El operador se devuelve con los datos básicos de su vehículo. */
const CON_VEHICULO = {
  vehiculo: {
    select: {
      id: true,
      numeroEconomico: true,
      tipo: true,
      capacidad: true,
      estado: true,
    },
  },
} satisfies Prisma.OperadorInclude;

export type OperadorRespuesta = Prisma.OperadorGetPayload<{
  include: typeof CON_VEHICULO;
}>;

@Injectable()
export class OperadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    consulta: ConsultaOperadoresDto,
  ): Promise<Paginado<OperadorRespuesta>> {
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
        include: CON_VEHICULO,
        orderBy: { nombre: 'asc' },
        ...rango(consulta),
      }),
      this.prisma.operador.count({ where }),
    ]);
    return { datos, total, pagina: consulta.pagina, limite: consulta.limite };
  }

  async obtener(id: number): Promise<OperadorRespuesta> {
    const operador = await this.prisma.operador.findUnique({
      where: { id },
      include: CON_VEHICULO,
    });
    if (!operador) throw new NotFoundException(`No existe el operador ${id}`);
    return operador;
  }

  async crear(
    dto: CrearOperadorDto,
    usuarioId: number,
  ): Promise<OperadorRespuesta> {
    const numero = await this.revisarVehiculo(dto.vehiculoId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const operador = await tx.operador.create({
          data: dto,
          include: CON_VEHICULO,
        });
        await registrarBitacora(tx, usuarioId, 'CREAR', ENTIDAD, operador.id);
        return operador;
      });
    } catch (error) {
      traducirErrorPrisma(error, { duplicado: yaTieneOperador(numero) });
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarOperadorDto,
    usuarioId: number,
  ): Promise<OperadorRespuesta> {
    await this.obtener(id);
    const numero = await this.revisarVehiculo(dto.vehiculoId, id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const operador = await tx.operador.update({
          where: { id },
          data: dto,
          include: CON_VEHICULO,
        });
        await registrarBitacora(tx, usuarioId, 'ACTUALIZAR', ENTIDAD, id);
        return operador;
      });
    } catch (error) {
      // Por si otra petición asignó el mismo vehículo entre la revisión y el guardado.
      traducirErrorPrisma(error, { duplicado: yaTieneOperador(numero) });
    }
  }

  /** Desactivación lógica: el operador queda con disponible = false. */
  async desactivar(id: number, usuarioId: number): Promise<OperadorRespuesta> {
    const actual = await this.obtener(id);
    if (!actual.disponible) return actual;
    return this.prisma.$transaction(async (tx) => {
      const operador = await tx.operador.update({
        where: { id },
        data: { disponible: false },
        include: CON_VEHICULO,
      });
      await registrarBitacora(tx, usuarioId, 'DESACTIVAR', ENTIDAD, id);
      return operador;
    });
  }

  /**
   * Un vehículo solo puede tener un operador: 400 si el vehículo no existe y
   * 409 si ya lo maneja otro operador. Devuelve su número económico.
   */
  private async revisarVehiculo(
    vehiculoId: number | null | undefined,
    operadorId?: number,
  ): Promise<string | undefined> {
    if (vehiculoId === undefined || vehiculoId === null) return undefined;
    const vehiculo = await this.prisma.vehiculo.findUnique({
      where: { id: vehiculoId },
      select: { numeroEconomico: true, operador: { select: { id: true } } },
    });
    if (!vehiculo) {
      throw new BadRequestException(`No existe el vehículo ${vehiculoId}`);
    }
    if (vehiculo.operador && vehiculo.operador.id !== operadorId) {
      throw new ConflictException(yaTieneOperador(vehiculo.numeroEconomico));
    }
    return vehiculo.numeroEconomico;
  }
}

const yaTieneOperador = (numero = '') =>
  `El vehículo ${numero} ya tiene un operador asignado`;
