import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiError401 } from '../comun/swagger.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Lista de mayoristas para los selectores (solo lectura). */
@ApiTags('mayoristas')
@ApiBearerAuth()
@Controller('mayoristas')
export class MayoristasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar mayoristas',
    description: 'Cualquier rol autenticado. Ordenados por nombre.',
  })
  @ApiOkResponse({
    description: 'Mayoristas',
    schema: {
      example: [
        { id: 2, nombre: 'Nexus Tours' },
        { id: 1, nombre: 'TUI' },
      ],
    },
  })
  @ApiError401()
  listar() {
    return this.prisma.mayorista.findMany({ orderBy: { nombre: 'asc' } });
  }
}
