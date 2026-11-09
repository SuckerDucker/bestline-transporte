import { Module } from '@nestjs/common';
import { TiemposTrasladoController } from './tiempos-traslado.controller.js';
import { TiemposTrasladoService } from './tiempos-traslado.service.js';

@Module({
  controllers: [TiemposTrasladoController],
  providers: [TiemposTrasladoService],
})
export class TiemposTrasladoModule {}
