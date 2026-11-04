import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { registrarBitacora } from '../comun/bitacora.js';
import { conCoordenadasNumericas } from '../comun/coordenadas.js';
import { traducirErrorPrisma } from '../comun/errores-prisma.js';
import { type Paginado, rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarHotelDto,
  ConsultaHotelesDto,
  CrearHotelDto,
} from './dto/hotel.dto.js';

const ENTIDAD = 'hotel';
// Cada hotel se devuelve con el id y el nombre de su zona.
const INCLUIR_ZONA = { zona: { select: { id: true, nombre: true } } } as const;

type HotelConZona = Prisma.HotelGetPayload<{ include: typeof INCLUIR_ZONA }>;
export type HotelRespuesta = ReturnType<
  typeof conCoordenadasNumericas<HotelConZona>
>;

@Injectable()
export class HotelesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    consulta: ConsultaHotelesDto,
  ): Promise<Paginado<HotelRespuesta>> {
    const where: Prisma.HotelWhereInput = {
      zonaId: consulta.zonaId,
      ...(consulta.buscar && {
        nombre: { contains: consulta.buscar, mode: 'insensitive' },
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.hotel.findMany({
        where,
        include: INCLUIR_ZONA,
        orderBy: { nombre: 'asc' },
        ...rango(consulta),
      }),
      this.prisma.hotel.count({ where }),
    ]);
    return {
      datos: datos.map(conCoordenadasNumericas),
      total,
      pagina: consulta.pagina,
      limite: consulta.limite,
    };
  }

  async obtener(id: number): Promise<HotelRespuesta> {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id },
      include: INCLUIR_ZONA,
    });
    if (!hotel) throw new NotFoundException(`No existe el hotel ${id}`);
    return conCoordenadasNumericas(hotel);
  }

  async crear(dto: CrearHotelDto, usuarioId: number): Promise<HotelRespuesta> {
    await this.validarZona(dto.zonaId);
    const hotel = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.hotel.create({
        data: dto,
        include: INCLUIR_ZONA,
      });
      await registrarBitacora(tx, usuarioId, 'CREAR', ENTIDAD, creado.id);
      return creado;
    });
    return conCoordenadasNumericas(hotel);
  }

  async actualizar(
    id: number,
    dto: ActualizarHotelDto,
    usuarioId: number,
  ): Promise<HotelRespuesta> {
    await this.obtener(id);
    if (dto.zonaId !== undefined) await this.validarZona(dto.zonaId);
    const hotel = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.hotel.update({
        where: { id },
        data: dto,
        include: INCLUIR_ZONA,
      });
      await registrarBitacora(tx, usuarioId, 'ACTUALIZAR', ENTIDAD, id);
      return actualizado;
    });
    return conCoordenadasNumericas(hotel);
  }

  /**
   * Los hoteles no tienen columna "activo": se eliminan físicamente, pero solo
   * si ningún servicio los referencia. Si los referencian, se responde 409.
   */
  async eliminar(id: number, usuarioId: number): Promise<{ id: number }> {
    const hotel = await this.obtener(id);
    const servicios = await this.prisma.servicio.count({
      where: { hotelId: id },
    });
    if (servicios > 0) {
      throw new ConflictException(
        `No se puede eliminar el hotel "${hotel.nombre}": está referenciado por ${servicios} servicio(s)`,
      );
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.hotel.delete({ where: { id } });
        await registrarBitacora(tx, usuarioId, 'ELIMINAR', ENTIDAD, id);
      });
    } catch (error) {
      traducirErrorPrisma(error, {
        referenciado: `No se puede eliminar el hotel "${hotel.nombre}": está referenciado por otros datos`,
      });
    }
    return { id };
  }

  /** La zona indicada debe existir; si no, es un dato inválido (400). */
  private async validarZona(zonaId: number): Promise<void> {
    const existe = await this.prisma.zona.count({ where: { id: zonaId } });
    if (!existe) throw new BadRequestException(`La zona ${zonaId} no existe`);
  }
}
