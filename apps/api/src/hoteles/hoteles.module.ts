import { Module } from '@nestjs/common';
import { HotelesController } from './hoteles.controller.js';
import { HotelesService } from './hoteles.service.js';

@Module({
  controllers: [HotelesController],
  providers: [HotelesService],
})
export class HotelesModule {}
