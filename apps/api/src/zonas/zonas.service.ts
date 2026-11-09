import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Zona } from '../generated/prisma/client.js';
import { cambio, registrarBitacora } from '../comun/bitacora.js';
import { conCoordenadasNumericas } from '../comun/coordenadas.js';
import { traducirErrorPrisma } from '../comun/errores-prisma.js';
import { type Paginado, rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ActualizarZonaDto,
  ConsultaZonasDto,
  CrearZonaDto,
} from './dto/zona.dto.js';

const ENTIDAD = 'zona';
export const MENSAJE_SIN_ZONA_TERMINO =
  'Debe existir al menos una zona de término';
export type ZonaRespuesta = ReturnType<typeof conCoordenadasNumericas<Zona>>;

@Injectable()
export class ZonasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(consulta: ConsultaZonasDto): Promise<Paginado<ZonaRespuesta>> {
    const where: Prisma.ZonaWhereInput = {
      esZonaTermino: consulta.esZonaTermino,
      ...(consulta.buscar && {
        nombre: { contains: consulta.buscar, mode: 'insensitive' },
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.zona.findMany({
        where,
        orderBy: { nombre: 'asc' },
        ...rango(consulta),
      }),
      this.prisma.zona.count({ where }),
    ]);
    return {
      datos: datos.map(conCoordenadasNumericas),
      total,
      pagina: consulta.pagina,
      limite: consulta.limite,
    };
  }

  async obtener(id: number): Promise<ZonaRespuesta> {
    const zona = await this.prisma.zona.findUnique({ where: { id } });
    if (!zona) throw new NotFoundException(`No existe la zona ${id}`);
    return conCoordenadasNumericas(zona);
  }

  async crear(dto: CrearZonaDto, usuarioId: number): Promise<ZonaRespuesta> {
    try {
      const zona = await this.prisma.$transaction(async (tx) => {
        const creada = await tx.zona.create({ data: dto });
        await registrarBitacora(tx, usuarioId, 'CREAR', ENTIDAD, creada.id);
        return creada;
      });
      return conCoordenadasNumericas(zona);
    } catch (error) {
      traducirErrorPrisma(error, {
        duplicado: `Ya existe una zona con el nombre "${dto.nombre}"`,
      });
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarZonaDto,
    usuarioId: number,
  ): Promise<ZonaRespuesta> {
    const actual = await this.obtener(id);
    try {
      const zona = await this.prisma.$transaction(async (tx) => {
        if (actual.esZonaTermino && dto.esZonaTermino === false) {
          await this.exigirOtraZonaTermino(tx, id);
        }
        const actualizada = await tx.zona.update({ where: { id }, data: dto });
        await registrarBitacora(tx, usuarioId, 'ACTUALIZAR', ENTIDAD, id);
        return actualizada;
      });
      return conCoordenadasNumericas(zona);
    } catch (error) {
      traducirErrorPrisma(error, {
        duplicado: `Ya existe una zona con el nombre "${dto.nombre}"`,
      });
    }
  }

  /**
   * Marca o desmarca una zona de término (donde una unidad puede terminar su
   * jornada). Si ya tenía ese valor no se modifica ni se registra.
   */
  async marcarZonaTermino(
    id: number,
    esZonaTermino: boolean,
    usuarioId: number,
  ): Promise<ZonaRespuesta> {
    const actual = await this.obtener(id);
    if (actual.esZonaTermino === esZonaTermino) return actual;
    const zona = await this.prisma.$transaction(async (tx) => {
      if (!esZonaTermino) await this.exigirOtraZonaTermino(tx, id);
      const actualizada = await tx.zona.update({
        where: { id },
        data: { esZonaTermino },
      });
      await registrarBitacora(
        tx,
        usuarioId,
        'ACTUALIZAR',
        ENTIDAD,
        id,
        `es_zona_termino ${cambio(actual.esZonaTermino, esZonaTermino)}`,
      );
      return actualizada;
    });
    return conCoordenadasNumericas(zona);
  }

  /**
   * Las zonas no tienen columna "activo": se eliminan físicamente, pero solo si
   * nada las referencia (hoteles, tiempos de traslado o servicios). Si las
   * referencian, se responde 409 con el detalle.
   */
  async eliminar(id: number, usuarioId: number): Promise<{ id: number }> {
    const zona = await this.obtener(id);
    const [hoteles, tiempos, servicios] = await this.prisma.$transaction([
      this.prisma.hotel.count({ where: { zonaId: id } }),
      this.prisma.tiempoTraslado.count({
        where: { OR: [{ zonaOrigenId: id }, { zonaDestinoId: id }] },
      }),
      this.prisma.servicio.count({
        where: { OR: [{ zonaOrigenId: id }, { zonaDestinoId: id }] },
      }),
    ]);
    if (hoteles + tiempos + servicios > 0) {
      throw new ConflictException(
        `No se puede eliminar la zona "${zona.nombre}": está referenciada por ` +
          `${hoteles} hotel(es), ${tiempos} tiempo(s) de traslado y ${servicios} servicio(s)`,
      );
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        if (zona.esZonaTermino) await this.exigirOtraZonaTermino(tx, id);
        await tx.zona.delete({ where: { id } });
        await registrarBitacora(tx, usuarioId, 'ELIMINAR', ENTIDAD, id);
      });
    } catch (error) {
      // Por si otra petición agregó una referencia entre la revisión y el borrado.
      traducirErrorPrisma(error, {
        referenciado: `No se puede eliminar la zona "${zona.nombre}": está referenciada por otros datos`,
      });
    }
    return { id };
  }

  /**
   * Regla del motor: el último servicio de una unidad debe terminar en una zona
   * de término, así que siempre debe quedar al menos una. Se llama dentro de la
   * transacción del cambio (desmarcar, editar o eliminar una zona de término).
   */
  private async exigirOtraZonaTermino(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<void> {
    const otras = await tx.zona.count({
      where: { esZonaTermino: true, id: { not: id } },
    });
    if (otras === 0) throw new BadRequestException(MENSAJE_SIN_ZONA_TERMINO);
  }
}
