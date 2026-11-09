import { Module } from '@nestjs/common';
import { ImportacionesController } from './importaciones.controller.js';
import { ImportacionesService } from './importaciones.service.js';

@Module({
  controllers: [ImportacionesController],
  providers: [ImportacionesService],
})
export class ImportacionesModule {}
