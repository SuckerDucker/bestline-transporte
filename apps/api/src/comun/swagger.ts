import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

// Ejemplos de las respuestas de error, con el mismo formato que devuelve NestJS.

/** 400: datos inválidos (ValidationPipe o reglas de negocio). */
export const ApiError400 = (...mensajes: string[]) =>
  ApiBadRequestResponse({
    description: 'Datos inválidos',
    schema: {
      example: {
        message: mensajes.length ? mensajes : ['nombre should not be empty'],
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  });

/** 401: sin token, token inválido o expirado. */
export const ApiError401 = (mensaje = 'Token inválido o expirado') =>
  ApiUnauthorizedResponse({
    description: 'No autenticado',
    schema: {
      example: { message: mensaje, error: 'Unauthorized', statusCode: 401 },
    },
  });

/** 403: el rol del usuario no tiene permiso. */
export const ApiError403 = () =>
  ApiForbiddenResponse({
    description: 'El rol no tiene permiso (solo ADMINISTRADOR puede escribir)',
    schema: {
      example: {
        message: 'No tienes permiso para realizar esta acción',
        error: 'Forbidden',
        statusCode: 403,
      },
    },
  });

/** 404: el registro no existe. */
export const ApiError404 = (mensaje: string) =>
  ApiNotFoundResponse({
    description: 'No encontrado',
    schema: {
      example: { message: mensaje, error: 'Not Found', statusCode: 404 },
    },
  });

/** 409: conflicto (valor duplicado o registro referenciado). */
export const ApiError409 = (mensaje: string) =>
  ApiConflictResponse({
    description: 'Conflicto',
    schema: {
      example: { message: mensaje, error: 'Conflict', statusCode: 409 },
    },
  });

/** Errores de una ruta de escritura: 400, 401 y 403. */
export const ApiErroresEscritura = (...mensajes400: string[]) =>
  applyDecorators(ApiError400(...mensajes400), ApiError401(), ApiError403());
