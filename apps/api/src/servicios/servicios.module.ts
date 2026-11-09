import { Module } from '@nestjs/common';
import { MayoristasController } from '../mayoristas/mayoristas.controller.js';
import { ServiciosController } from './servicios.controller.js';
import { ServiciosService } from './servicios.service.js';

/** Servicios y mayoristas (consultas de solo lectura). */
@Module({
  controllers: [ServiciosController, MayoristasController],
  providers: [ServiciosService],
})
export class ServiciosModule {}
