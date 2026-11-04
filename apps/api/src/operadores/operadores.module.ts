import { Module } from '@nestjs/common';
import { OperadoresController } from './operadores.controller.js';
import { OperadoresService } from './operadores.service.js';

@Module({
  controllers: [OperadoresController],
  providers: [OperadoresService],
})
export class OperadoresModule {}
