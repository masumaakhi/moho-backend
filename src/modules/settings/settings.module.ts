import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { PublicSettingsController } from './public-settings.controller';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService, PrismaService, ActivityLogsService],
  exports: [SettingsService],
})
export class SettingsModule {}
