import { Module } from '@nestjs/common';
import { ResumenController } from './resumen.controller.js';
import { ResumenService } from './resumen.service.js';

@Module({
  controllers: [ResumenController],
  providers: [ResumenService],
})
export class ResumenModule {}
