import { Module } from '@nestjs/common';
import { MonitoreoController } from './monitoreo.controller.js';
import { MonitoreoService } from './monitoreo.service.js';

@Module({
  controllers: [MonitoreoController],
  providers: [MonitoreoService],
})
export class MonitoreoModule {}
