import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller.js';
import { RevisionService } from './revision.service.js';
import { RolesService } from './roles.service.js';

@Module({
  controllers: [RolesController],
  providers: [RolesService, RevisionService],
})
export class RolesModule {}
