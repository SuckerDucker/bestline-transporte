import { Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoVehiculo,
  type Prisma,
  type Vehiculo,
} from '../generated/prisma/client.js';
import { registrarBitacora } from '../comun/bitacora.js';
import { traducirErrorPrisma } from '../comun/errores-prisma.js';
import { type Paginado, rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validarCapacidad } from './capacidad.js';
import type {
  ActualizarVehiculoDto,
  ConsultaVehiculosDto,
  CrearVehiculoDto,
} from './dto/vehiculo.dto.js';

const ENTIDAD = 'vehiculo';

@Injectable()
export class VehiculosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(consulta: ConsultaVehiculosDto): Promise<Paginado<Vehiculo>> {
    const where: Prisma.VehiculoWhereInput = {
      tipo: consulta.tipo,
      estado: consulta.estado,
      ...(consulta.buscar && {
        OR: [
          {
            numeroEconomico: { contains: consulta.buscar, mode: 'insensitive' },
          },
          { encierroBase: { contains: consulta.buscar, mode: 'insensitive' } },
        ],
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.vehiculo.findMany({
        where,
        orderBy: { numeroEconomico: 'asc' },
        ...rango(consulta),
      }),
      this.prisma.vehiculo.count({ where }),
    ]);
    return { datos, total, pagina: consulta.pagina, limite: consulta.limite };
  }

  async obtener(id: number): Promise<Vehiculo> {
    const vehiculo = await this.prisma.vehiculo.findUnique({ where: { id } });
    if (!vehiculo) throw new NotFoundException(`No existe el vehículo ${id}`);
    return vehiculo;
  }

  async crear(dto: CrearVehiculoDto, usuarioId: number): Promise<Vehiculo> {
    validarCapacidad(dto.tipo, dto.capacidad);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const vehiculo = await tx.vehiculo.create({
          data: {
            numeroEconomico: dto.numeroEconomico,
            tipo: dto.tipo,
            capacidad: dto.capacidad,
            encierroBase: dto.encierroBase,
            estado: dto.estado ?? EstadoVehiculo.DISPONIBLE,
          },
        });
        await registrarBitacora(tx, usuarioId, 'CREAR', ENTIDAD, vehiculo.id);
        return vehiculo;
      });
    } catch (error) {
      traducirErrorPrisma(error, {
        duplicado: `Ya existe un vehículo con el número económico ${dto.numeroEconomico}`,
      });
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarVehiculoDto,
    usuarioId: number,
  ): Promise<Vehiculo> {
    const actual = await this.obtener(id);
    // La regla se revisa con los valores finales: si solo cambia el tipo o solo
    // la capacidad, se combina con el valor que ya tenía.
    validarCapacidad(
      dto.tipo ?? actual.tipo,
      dto.capacidad ?? actual.capacidad,
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const vehiculo = await tx.vehiculo.update({ where: { id }, data: dto });
        await registrarBitacora(tx, usuarioId, 'ACTUALIZAR', ENTIDAD, id);
        return vehiculo;
      });
    } catch (error) {
      traducirErrorPrisma(error, {
        duplicado: `Ya existe un vehículo con el número económico ${dto.numeroEconomico}`,
      });
    }
  }

  /** Desactivación lógica: el vehículo pasa a estado BAJA (no se borra). */
  async desactivar(id: number, usuarioId: number): Promise<Vehiculo> {
    const actual = await this.obtener(id);
    if (actual.estado === EstadoVehiculo.BAJA) return actual;
    return this.prisma.$transaction(async (tx) => {
      const vehiculo = await tx.vehiculo.update({
        where: { id },
        data: { estado: EstadoVehiculo.BAJA },
      });
      await registrarBitacora(tx, usuarioId, 'DESACTIVAR', ENTIDAD, id);
      return vehiculo;
    });
  }
}
