import { BadRequestException, Injectable } from '@nestjs/common';
import { cambio, registrarBitacora } from '../comun/bitacora.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TiempoCeldaDto } from './dto/matriz.dto.js';

const ENTIDAD = 'tiempo_traslado';
export const MINUTOS_MINIMOS = 1;
export const MINUTOS_MAXIMOS = 300;

export interface Celda {
  zonaOrigenId: number;
  zonaDestinoId: number;
}

export interface ErrorCelda extends Celda {
  mensaje: string;
}

export interface Matriz {
  zonas: { id: number; nombre: string; esZonaTermino: boolean }[];
  /** matriz[i][j] = minutos de zonas[i] a zonas[j], o null si falta. */
  matriz: (number | null)[][];
  faltantes: Celda[];
  completa: boolean;
}

const clavePar = (c: Celda) => `${c.zonaOrigenId}-${c.zonaDestinoId}`;

@Injectable()
export class TiemposTrasladoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Matriz origen × destino (incluye la misma zona) con las combinaciones que faltan. */
  async matriz(): Promise<Matriz> {
    const [zonas, tiempos] = await this.prisma.$transaction([
      this.prisma.zona.findMany({
        select: { id: true, nombre: true, esZonaTermino: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.tiempoTraslado.findMany(),
    ]);
    const minutos = new Map(tiempos.map((t) => [clavePar(t), t.minutos]));
    const faltantes: Celda[] = [];
    const matriz = zonas.map((origen) =>
      zonas.map((destino) => {
        const celda = { zonaOrigenId: origen.id, zonaDestinoId: destino.id };
        const valor = minutos.get(clavePar(celda)) ?? null;
        if (valor === null) faltantes.push(celda);
        return valor;
      }),
    );
    return { zonas, matriz, faltantes, completa: faltantes.length === 0 };
  }

  /**
   * Guarda varios tiempos en una sola transacción: si una celda es inválida
   * no se guarda ninguna (400 con el error de cada celda). Solo se escriben
   * las celdas que cambiaron y cada una queda en la bitácora.
   */
  async guardar(celdas: TiempoCeldaDto[], usuarioId: number): Promise<Matriz> {
    const zonas = await this.prisma.zona.findMany({
      select: { id: true, nombre: true },
    });
    const errores = this.validar(
      celdas,
      new Map(zonas.map((z) => [z.id, z.nombre])),
    );
    if (errores.length) {
      throw new BadRequestException({
        message: errores.map((e) => e.mensaje),
        errores,
        error: 'Bad Request',
        statusCode: 400,
      });
    }

    const existentes = new Map(
      (await this.prisma.tiempoTraslado.findMany()).map((t) => [
        clavePar(t),
        t,
      ]),
    );
    await this.prisma.$transaction(async (tx) => {
      for (const celda of celdas) {
        const anterior = existentes.get(clavePar(celda));
        if (anterior?.minutos === celda.minutos) continue;
        const { zonaOrigenId, zonaDestinoId, minutos } = celda;
        const guardado = await tx.tiempoTraslado.upsert({
          where: {
            zonaOrigenId_zonaDestinoId: { zonaOrigenId, zonaDestinoId },
          },
          update: { minutos },
          create: { zonaOrigenId, zonaDestinoId, minutos },
        });
        await registrarBitacora(
          tx,
          usuarioId,
          anterior ? 'ACTUALIZAR' : 'CREAR',
          ENTIDAD,
          guardado.id,
          anterior ? cambio(anterior.minutos, minutos) : `${minutos} min`,
        );
      }
    });
    return this.matriz();
  }

  /** Errores por celda: zonas inexistentes, celdas repetidas y minutos fuera de rango. */
  private validar(
    celdas: TiempoCeldaDto[],
    nombres: Map<number, string>,
  ): ErrorCelda[] {
    const vistas = new Set<string>();
    const errores: ErrorCelda[] = [];
    for (const celda of celdas) {
      const { zonaOrigenId, zonaDestinoId, minutos } = celda;
      const origen = nombres.get(zonaOrigenId);
      const destino = nombres.get(zonaDestinoId);
      const error = (mensaje: string) =>
        errores.push({ zonaOrigenId, zonaDestinoId, mensaje });

      if (!origen || !destino) {
        error(`No existe la zona ${origen ? zonaDestinoId : zonaOrigenId}`);
      } else if (vistas.has(clavePar(celda))) {
        error(`${origen} → ${destino}: la celda viene repetida`);
      } else if (
        !Number.isInteger(minutos) ||
        minutos < MINUTOS_MINIMOS ||
        minutos > MINUTOS_MAXIMOS
      ) {
        error(
          `${origen} → ${destino}: los minutos deben ser un número entero de ${MINUTOS_MINIMOS} a ${MINUTOS_MAXIMOS}`,
        );
      }
      vistas.add(clavePar(celda));
    }
    return errores;
  }
}
