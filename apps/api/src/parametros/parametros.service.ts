import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ParametroOperacion } from '../generated/prisma/client.js';
import { cambio, registrarBitacora } from '../comun/bitacora.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ValorParametroDto } from './dto/parametros.dto.js';
import { validarParametro } from './reglas.js';

const ENTIDAD = 'parametro_operacion';

/** Error de validación de un parámetro, para mostrarlo junto a su campo. */
export interface ErrorParametro {
  clave: string;
  mensaje: string;
}

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(): Promise<ParametroOperacion[]> {
    return this.prisma.parametroOperacion.findMany({
      orderBy: { clave: 'asc' },
    });
  }

  /**
   * Guarda varios parámetros en una sola transacción: si alguno es inválido no
   * se guarda ninguno. Solo se actualizan los que cambiaron, y cada cambio deja
   * en la bitácora el valor anterior y el nuevo ("ACTUALIZAR: 9.5 → 10").
   */
  async actualizar(
    cambios: ValorParametroDto[],
    usuarioId: number,
  ): Promise<ParametroOperacion[]> {
    const claves = cambios.map((c) => c.clave);
    const repetidas = claves.filter((c, i) => claves.indexOf(c) !== i);
    if (repetidas.length) {
      throw new BadRequestException(
        `Claves repetidas: ${[...new Set(repetidas)].join(', ')}`,
      );
    }

    const actuales = await this.prisma.parametroOperacion.findMany({
      where: { clave: { in: claves } },
    });
    const porClave = new Map(actuales.map((p) => [p.clave, p]));
    const inexistentes = claves.filter((c) => !porClave.has(c));
    if (inexistentes.length) {
      throw new NotFoundException(
        `No existe el parámetro: ${inexistentes.join(', ')}`,
      );
    }

    const errores: ErrorParametro[] = cambios.flatMap(({ clave, valor }) => {
      const mensaje = validarParametro(clave, valor);
      return mensaje ? [{ clave, mensaje }] : [];
    });
    if (errores.length) {
      throw new BadRequestException({
        message: errores.map((e) => `${e.clave} ${e.mensaje}`),
        errores,
        error: 'Bad Request',
        statusCode: 400,
      });
    }

    const modificados = cambios.filter(
      (c) => porClave.get(c.clave)?.valor !== c.valor,
    );
    await this.prisma.$transaction(async (tx) => {
      for (const { clave, valor } of modificados) {
        const anterior = porClave.get(clave) as ParametroOperacion;
        await tx.parametroOperacion.update({
          where: { id: anterior.id },
          data: { valor },
        });
        await registrarBitacora(
          tx,
          usuarioId,
          'ACTUALIZAR',
          ENTIDAD,
          anterior.id,
          cambio(anterior.valor, valor),
        );
      }
    });
    return this.listar();
  }
}
