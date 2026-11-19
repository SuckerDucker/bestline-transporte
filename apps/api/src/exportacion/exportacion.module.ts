import { Module } from '@nestjs/common';
import { ExportacionController } from './exportacion.controller.js';
import { ExportacionService } from './exportacion.service.js';

@Module({
  controllers: [ExportacionController],
  providers: [ExportacionService],
})
export class ExportacionModule {}
