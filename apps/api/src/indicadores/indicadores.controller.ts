import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '../generated/prisma/client.js';
import { Roles } from '../comun/decoradores.js';
import { ApiError400, ApiError401, ApiError403 } from '../comun/swagger.js';
import { RangoDto } from './dto/rango.dto.js';
import { IndicadoresService } from './indicadores.service.js';

const MOTIVOS_EJEMPLO = {
  CAPACIDAD: 0,
  EMPALME: 12,
  JORNADA: 5,
  ZONA_TERMINO: 2,
  SIN_UNIDAD: 0,
};
const INCIDENCIAS_EJEMPLO = {
  RETRASO: 1,
  FALLA_MECANICA: 0,
  PASAJERO_NO_SE_PRESENTO: 1,
  CAMBIO_DE_HORA: 0,
  OTRO: 0,
};
const DIA_EJEMPLO = {
  fecha: '2026-11-10',
  estadoRol: 'AUTORIZADO',
  servicios: 60,
  asignados: 41,
  noCubiertos: 19,
  noCubiertosPorMotivo: MOTIVOS_EJEMPLO,
  cobertura: 68.3,
  empalmes: 0,
  completados: 30,
  cancelados: 1,
  noShow: 1,
  incidencias: 2,
  incidenciasPorTipo: INCIDENCIAS_EJEMPLO,
  ocupacion: 0.412,
  tiempoElaboracionMin: 12.5,
  unidades: [
    {
      vehiculoId: 1,
      numeroEconomico: 'BL-01',
      capacidad: 14,
      servicios: 3,
      pasajeros: 21,
      ocupacion: 0.5,
      horasJornada: 9.1,
    },
  ],
};

@ApiTags('Indicadores')
@ApiBearerAuth()
@ApiError401()
@Controller('indicadores')
export class IndicadoresController {
  constructor(private readonly indicadores: IndicadoresService) {}

  @Get()
  @Roles(
    RolUsuario.ADMINISTRADOR,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @ApiOperation({
    summary: 'Indicadores por día y del rango',
    description:
      'Por día: servicios, asignados, no cubiertos por motivo, % de cobertura (asignados / servicios del rol), empalmes (violaciones del verificador en roles AUTORIZADOS; debe dar 0), completados, cancelados, no show, incidencias por tipo, ocupación promedio (pasajeros / capacidad) y horas de jornada por unidad (de la cita hasta que queda libre, con el regreso al encierro si no termina en zona de término). Tiempo de elaboración del rol (RF-19, CU-20): minutos desde la última generación hasta la autorización, solo en roles AUTORIZADOS; regenerar reinicia la medición. Máximo 31 días.',
  })
  @ApiOkResponse({
    description: 'Indicadores',
    schema: {
      example: {
        desde: '2026-11-10',
        hasta: '2026-11-10',
        resumen: {
          dias: 1,
          diasConRol: 1,
          servicios: 60,
          asignados: 41,
          noCubiertos: 19,
          noCubiertosPorMotivo: MOTIVOS_EJEMPLO,
          cobertura: 68.3,
          empalmes: 0,
          completados: 30,
          cancelados: 1,
          noShow: 1,
          incidencias: 2,
          incidenciasPorTipo: INCIDENCIAS_EJEMPLO,
          ocupacion: 0.412,
          tiempoElaboracionPromedioMin: 12.5,
          unidades: [
            {
              vehiculoId: 1,
              numeroEconomico: 'BL-01',
              servicios: 3,
              ocupacion: 0.5,
              horasJornadaPromedio: 9.1,
            },
          ],
        },
        dias: [DIA_EJEMPLO],
      },
    },
  })
  @ApiError400(
    'desde no puede ser posterior a hasta',
    'El rango puede tener como máximo 31 días',
  )
  @ApiError403()
  calcular(@Query() rango: RangoDto) {
    return this.indicadores.calcular(rango);
  }
}
