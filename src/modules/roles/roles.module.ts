import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Module({
  controllers: [RolesController],
  providers: [RolesService, PrismaService, ActivityLogsService],
  exports: [RolesService],
})
export class RolesModule {}
