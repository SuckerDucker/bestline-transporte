import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { SaludController } from './salud.controller.js';

@Module({
  controllers: [HealthController, SaludController],
})
export class HealthModule {}
