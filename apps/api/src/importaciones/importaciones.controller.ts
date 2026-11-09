import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/client.js';
import { Roles, UsuarioActual } from '../comun/decoradores.js';
import {
  ApiError400,
  ApiError401,
  ApiError403,
  ApiError404,
  ApiError409,
} from '../comun/swagger.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  ArchivoImportacionDto,
  ConsultaImportacionesDto,
  ESQUEMA_ARCHIVO,
} from './dto/importacion.dto.js';
import {
  type ArchivoSubido,
  ImportacionesService,
} from './importaciones.service.js';

/** Quién importa y quién consulta (el OPERADOR no usa estas pantallas). */
const ROLES_IMPORTAR = [RolUsuario.ADMINISTRADOR, RolUsuario.COORDINADOR];
const ROLES_CONSULTAR = [...ROLES_IMPORTAR, RolUsuario.SUPERVISOR];

/**
 * Archivo en memoria. Multer corta a los 10 MB solo para proteger la memoria
 * (413); el límite de 5 MB se revisa en el servicio con un mensaje claro (400).
 * defParamCharset utf8: conserva los acentos del nombre del archivo.
 */
const SUBIDA = FileInterceptor('archivo', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  defParamCharset: 'utf8',
});

const FILA_EJEMPLO = {
  fila: 5,
  estado: 'VALIDA',
  mensajes: [],
  valores: {
    Folio: 'NX-15001',
    Localizador: 'LOC85001A',
    Agencia: 'Nexus Tours',
    Fecha: '05/11/2026',
    'Tipo de Servicio': 'SALIDA COMPARTIDO',
    Pasajeros: '2',
    Hotel: 'Planet Hollywood Cancun',
    Zona: 'Costa Mujeres',
    Vuelo: 'AM691',
    Hora: '06:15',
  },
  servicio: {
    tipo: 'SALIDA',
    modalidad: 'COMPARTIDO',
    fechaHora: '2026-11-05T11:15:00.000Z',
    zonaOrigen: 'Costa Mujeres',
    zonaDestino: 'Aeropuerto CUN',
  },
};
const TOTALES_EJEMPLO = {
  total: 65,
  validas: 30,
  advertencias: 28,
  duplicadas: 2,
  errores: 5,
  importables: 58,
  rechazadas: 7,
};
const IMPORTACION_EJEMPLO = {
  id: 1,
  archivo: 'Layout_Servicios_Nexus.xlsx',
  fecha: '2026-11-09T16:30:00.000Z',
  filasValidas: 58,
  filasRechazadas: 7,
  mayoristaId: 2,
  usuarioId: 1,
  mayorista: { id: 2, nombre: 'Nexus Tours' },
  usuario: { id: 1, nombre: 'Administrador' },
};
const ERROR_ENCABEZADOS = {
  description:
    'Archivo inválido: falta el archivo, no es .xlsx ni .csv, supera 5 MB, no se pudo leer o le faltan encabezados (con la lista en "faltantes")',
  schema: {
    example: {
      message: 'Faltan encabezados: Zona, Hora',
      faltantes: ['Zona', 'Hora'],
      error: 'Bad Request',
      statusCode: 400,
    },
  },
};

/** Importación de servicios de los mayoristas (CU-05, RF-04, RF-05). */
@ApiTags('importaciones')
@ApiBearerAuth()
@ApiError401()
@ApiError403()
@Controller('importaciones')
export class ImportacionesController {
  constructor(private readonly servicio: ImportacionesService) {}

  @Post('vista-previa')
  @HttpCode(200)
  @Roles(...ROLES_IMPORTAR)
  @UseInterceptors(SUBIDA)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: ESQUEMA_ARCHIVO })
  @ApiOperation({
    summary: 'Vista previa de un archivo (no guarda nada)',
    description:
      'ADMINISTRADOR y COORDINADOR. Lee el .xlsx o .csv, detecta la fila de encabezados (la que contiene "Folio") y devuelve cada fila con su estado: VALIDA, ADVERTENCIA (se importa con un aviso), DUPLICADA (folio + localizador repetido en el archivo o ya en la base) o ERROR, con sus mensajes y los totales.',
  })
  @ApiOkResponse({
    description: 'Filas con su estado y totales',
    schema: {
      example: {
        archivo: 'Layout_Servicios_Nexus.xlsx',
        mayorista: { id: 2, nombre: 'Nexus Tours' },
        totales: TOTALES_EJEMPLO,
        avisos: [],
        filas: [
          FILA_EJEMPLO,
          {
            ...FILA_EJEMPLO,
            fila: 25,
            estado: 'ERROR',
            mensajes: ['Zona no indicada'],
            servicio: null,
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse(ERROR_ENCABEZADOS)
  @ApiError404('No existe el mayorista 99')
  @ApiPayloadTooLargeResponse({ description: 'Archivo de más de 10 MB' })
  vistaPrevia(
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Body() dto: ArchivoImportacionDto,
  ) {
    return this.servicio.vistaPrevia(archivo, dto.mayoristaId);
  }

  @Post('confirmar')
  @Roles(...ROLES_IMPORTAR)
  @UseInterceptors(SUBIDA)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: ESQUEMA_ARCHIVO })
  @ApiOperation({
    summary: 'Confirmar la importación',
    description:
      'ADMINISTRADOR y COORDINADOR. Se envía el mismo archivo de la vista previa: se procesa otra vez (revalidando duplicados contra la base) y se guardan en una transacción la importación, los servicios VALIDA y ADVERTENCIA en estado PENDIENTE y el registro en la bitácora.',
  })
  @ApiCreatedResponse({
    description: 'Importación guardada',
    schema: {
      example: {
        importacion: IMPORTACION_EJEMPLO,
        totales: TOTALES_EJEMPLO,
        avisos: [],
      },
    },
  })
  @ApiBadRequestResponse(ERROR_ENCABEZADOS)
  @ApiError404('No existe el mayorista 99')
  @ApiError409(
    'Algunos servicios ya fueron importados mientras tanto; genera de nuevo la vista previa',
  )
  confirmar(
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Body() dto: ArchivoImportacionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.servicio.confirmar(archivo, dto.mayoristaId, usuario.id);
  }

  @Get()
  @Roles(...ROLES_CONSULTAR)
  @ApiOperation({
    summary: 'Historial de importaciones',
    description:
      'ADMINISTRADOR, COORDINADOR y SUPERVISOR. De la más reciente a la más antigua, con búsqueda por nombre de archivo y filtro por mayorista.',
  })
  @ApiOkResponse({
    description: 'Página de importaciones',
    schema: {
      example: {
        datos: [IMPORTACION_EJEMPLO],
        total: 1,
        pagina: 1,
        limite: 10,
      },
    },
  })
  @ApiError400('mayoristaId debe ser un número entero')
  listar(@Query() consulta: ConsultaImportacionesDto) {
    return this.servicio.listar(consulta);
  }

  @Get(':id')
  @Roles(...ROLES_CONSULTAR)
  @ApiOperation({ summary: 'Una importación con sus servicios' })
  @ApiOkResponse({
    description: 'Importación y servicios ordenados por hora',
    schema: {
      example: {
        ...IMPORTACION_EJEMPLO,
        servicios: [
          {
            id: 61,
            folio: 'NX-15001',
            localizador: 'LOC85001A',
            tipo: 'SALIDA',
            modalidad: 'COMPARTIDO',
            fechaHora: '2026-11-05T11:15:00.000Z',
            pasajeros: 2,
            vuelo: 'AM691',
            estado: 'PENDIENTE',
            zonaOrigen: { id: 4, nombre: 'Costa Mujeres' },
            zonaDestino: { id: 1, nombre: 'Aeropuerto CUN' },
            hotel: { id: 9, nombre: 'Planet Hollywood Cancun' },
          },
        ],
      },
    },
  })
  @ApiError400('Validation failed (numeric string is expected)')
  @ApiError404('No existe la importación 99')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }
}
