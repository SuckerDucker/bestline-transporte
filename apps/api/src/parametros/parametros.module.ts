import { Module } from '@nestjs/common';
import { ParametrosController } from './parametros.controller.js';
import { ParametrosService } from './parametros.service.js';

@Module({
  controllers: [ParametrosController],
  providers: [ParametrosService],
})
export class ParametrosModule {}
