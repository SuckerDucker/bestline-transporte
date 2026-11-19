import { Module } from '@nestjs/common';
import { OsrmCliente } from './osrm.cliente.js';
import { RutasController } from './rutas.controller.js';
import { RutasService } from './rutas.service.js';

@Module({
  controllers: [RutasController],
  providers: [RutasService, OsrmCliente],
})
export class RutasModule {}
