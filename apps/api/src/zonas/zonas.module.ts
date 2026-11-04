import { Module } from '@nestjs/common';
import { ZonasController } from './zonas.controller.js';
import { ZonasService } from './zonas.service.js';

@Module({
  controllers: [ZonasController],
  providers: [ZonasService],
})
export class ZonasModule {}
