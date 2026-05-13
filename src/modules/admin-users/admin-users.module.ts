import { Module } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService, PrismaService, ActivityLogsService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
