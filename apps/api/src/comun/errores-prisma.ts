import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Traduce los errores conocidos de Prisma a respuestas HTTP claras.
 * - P2002: valor único repetido -> 409
 * - P2003: llave foránea (el registro está referenciado) -> 409
 * - P2025: registro no encontrado -> 404
 * Cualquier otro error se vuelve a lanzar tal cual (500).
 */
export function traducirErrorPrisma(
  error: unknown,
  mensajes: {
    duplicado?: string;
    referenciado?: string;
    noEncontrado?: string;
  } = {},
): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictException(
        mensajes.duplicado ?? 'El registro ya existe',
      );
    }
    if (error.code === 'P2003') {
      throw new ConflictException(
        mensajes.referenciado ??
          'El registro está referenciado por otros datos',
      );
    }
    if (error.code === 'P2025') {
      throw new NotFoundException(
        mensajes.noEncontrado ?? 'Registro no encontrado',
      );
    }
  }
  throw error;
}
