import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { registrarBitacora } from '../comun/bitacora.js';
import { traducirErrorPrisma } from '../comun/errores-prisma.js';
import { type Paginado, rango } from '../comun/paginacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConsultaImportacionesDto } from './dto/importacion.dto.js';
import { ErrorArchivo, leerArchivo } from './lectura.js';
import {
  claveServicio,
  contarFilas,
  type EstadoFila,
  indexarPorNombre,
  procesarFilas,
} from './procesar-filas.js';

const ENTIDAD = 'importacion';
export const TAMANO_MAXIMO = 5 * 1024 * 1024;

/** Lo mínimo que se necesita del archivo subido (multer). */
export interface ArchivoSubido {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/** Una fila de la vista previa, lista para mostrarse. */
export interface FilaVistaPrevia {
  fila: number;
  estado: EstadoFila;
  mensajes: string[];
  valores: Record<string, string>;
  /** Cómo se guardará el servicio (solo filas VALIDA o ADVERTENCIA). */
  servicio: {
    tipo: string;
    modalidad: string;
    fechaHora: Date;
    zonaOrigen: string;
    zonaDestino: string;
  } | null;
}

export interface VistaPrevia {
  archivo: string;
  mayorista: { id: number; nombre: string };
  totales: ReturnType<typeof contarFilas>;
  /** Avisos del archivo completo (por ejemplo, filas de otra agencia). */
  avisos: string[];
  filas: FilaVistaPrevia[];
}

const RELACIONES_IMPORTACION = {
  mayorista: { select: { id: true, nombre: true } },
  usuario: { select: { id: true, nombre: true } },
} satisfies Prisma.ImportacionInclude;

@Injectable()
export class ImportacionesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Procesa el archivo sin guardar nada. */
  async vistaPrevia(
    archivo: ArchivoSubido | undefined,
    mayoristaId: number,
  ): Promise<VistaPrevia> {
    const { vista } = await this.procesar(archivo, mayoristaId);
    return vista;
  }

  /**
   * Vuelve a procesar el archivo (así se revisan otra vez los duplicados
   * contra la base) y guarda en una sola transacción la importación, los
   * servicios VALIDA y ADVERTENCIA (estado PENDIENTE) y su registro en la bitácora.
   */
  async confirmar(
    archivo: ArchivoSubido | undefined,
    mayoristaId: number,
    usuarioId: number,
  ) {
    const { vista, servicios } = await this.procesar(archivo, mayoristaId);
    const { importables, rechazadas } = vista.totales;
    if (importables === 0) {
      throw new BadRequestException(
        'El archivo no tiene filas válidas para importar',
      );
    }
    try {
      const importacion = await this.prisma.$transaction(async (tx) => {
        const creada = await tx.importacion.create({
          data: {
            archivo: vista.archivo,
            mayoristaId,
            usuarioId,
            filasValidas: importables,
            filasRechazadas: rechazadas,
          },
          include: RELACIONES_IMPORTACION,
        });
        await tx.servicio.createMany({
          data: servicios.map((s) => ({ ...s, importacionId: creada.id })),
        });
        await registrarBitacora(
          tx,
          usuarioId,
          'CREAR',
          ENTIDAD,
          creada.id,
          `${vista.archivo}: ${importables} servicios importados, ${rechazadas} filas rechazadas`,
        );
        return creada;
      });
      return { importacion, totales: vista.totales, avisos: vista.avisos };
    } catch (error) {
      // Otra importación guardó el mismo folio + localizador entre la
      // revisión y el guardado (restricción única de la tabla servicio).
      traducirErrorPrisma(error, {
        duplicado:
          'Algunos servicios ya fueron importados mientras tanto; genera de nuevo la vista previa',
      });
    }
  }

  async listar(consulta: ConsultaImportacionesDto) {
    const where: Prisma.ImportacionWhereInput = {
      mayoristaId: consulta.mayoristaId,
      ...(consulta.buscar && {
        archivo: { contains: consulta.buscar, mode: 'insensitive' },
      }),
    };
    const [datos, total] = await this.prisma.$transaction([
      this.prisma.importacion.findMany({
        where,
        include: RELACIONES_IMPORTACION,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        ...rango(consulta),
      }),
      this.prisma.importacion.count({ where }),
    ]);
    return {
      datos,
      total,
      pagina: consulta.pagina,
      limite: consulta.limite,
    } satisfies Paginado<unknown>;
  }

  /** Una importación con sus servicios, ordenados por hora. */
  async obtener(id: number) {
    const importacion = await this.prisma.importacion.findUnique({
      where: { id },
      include: {
        ...RELACIONES_IMPORTACION,
        servicios: {
          orderBy: { fechaHora: 'asc' },
          include: {
            zonaOrigen: { select: { id: true, nombre: true } },
            zonaDestino: { select: { id: true, nombre: true } },
            hotel: { select: { id: true, nombre: true } },
          },
        },
      },
    });
    if (!importacion) {
      throw new NotFoundException(`No existe la importación ${id}`);
    }
    return importacion;
  }

  /** Lee y valida el archivo; devuelve la vista previa y los servicios a guardar. */
  private async procesar(
    archivo: ArchivoSubido | undefined,
    mayoristaId: number,
  ) {
    if (!archivo) {
      throw new BadRequestException('Adjunta el archivo en el campo "archivo"');
    }
    if (archivo.size > TAMANO_MAXIMO) {
      throw new BadRequestException('El archivo supera el máximo de 5 MB');
    }
    const mayorista = await this.prisma.mayorista.findUnique({
      where: { id: mayoristaId },
    });
    if (!mayorista) {
      throw new NotFoundException(`No existe el mayorista ${mayoristaId}`);
    }

    let filas: ReturnType<typeof leerArchivo>;
    try {
      filas = leerArchivo(archivo.buffer, archivo.originalname);
    } catch (error) {
      if (!(error instanceof ErrorArchivo)) throw error;
      throw new BadRequestException({
        message: error.message,
        faltantes: error.faltantes,
        error: 'Bad Request',
        statusCode: 400,
      });
    }

    const [zonas, hoteles, mayoristas, existentes] = await Promise.all([
      this.prisma.zona.findMany({ select: { id: true, nombre: true } }),
      this.prisma.hotel.findMany({ select: { id: true, nombre: true } }),
      this.prisma.mayorista.findMany({ select: { id: true, nombre: true } }),
      // Solo los servicios con los folios del archivo (no toda la tabla).
      this.prisma.servicio.findMany({
        where: {
          folio: { in: [...new Set(filas.map((f) => f.valores.Folio))] },
        },
        select: { folio: true, localizador: true },
      }),
    ]);
    const procesadas = procesarFilas(
      filas,
      {
        zonas: indexarPorNombre(zonas),
        hoteles: indexarPorNombre(hoteles),
        mayoristas: indexarPorNombre(mayoristas),
      },
      new Set(existentes.map((s) => claveServicio(s.folio, s.localizador))),
    );

    const nombreZona = new Map(zonas.map((z) => [z.id, z.nombre]));
    const nombreMayorista = new Map(mayoristas.map((m) => [m.id, m.nombre]));
    const servicios = procesadas.flatMap((f) =>
      f.servicio ? [f.servicio] : [],
    );

    // Filas importables de otra agencia: se guardan con su propia agencia.
    const otras = new Map<number, number>();
    for (const s of servicios) {
      if (s.mayoristaId !== mayoristaId) {
        otras.set(s.mayoristaId, (otras.get(s.mayoristaId) ?? 0) + 1);
      }
    }
    const avisos = [...otras].map(
      ([id, cantidad]) =>
        `${cantidad} fila(s) traen la agencia "${nombreMayorista.get(id)}", distinta del mayorista elegido (${mayorista.nombre}); esos servicios se guardarán con su propia agencia`,
    );

    const vista: VistaPrevia = {
      archivo: archivo.originalname.slice(0, 255),
      mayorista: { id: mayorista.id, nombre: mayorista.nombre },
      totales: contarFilas(procesadas),
      avisos,
      filas: procesadas.map((f) => ({
        fila: f.fila,
        estado: f.estado,
        mensajes: f.mensajes,
        valores: f.valores,
        servicio: f.servicio && {
          tipo: f.servicio.tipo,
          modalidad: f.servicio.modalidad,
          fechaHora: f.servicio.fechaHora,
          zonaOrigen: nombreZona.get(f.servicio.zonaOrigenId) ?? '',
          zonaDestino: nombreZona.get(f.servicio.zonaDestinoId) ?? '',
        },
      })),
    };
    return { vista, servicios };
  }
}
