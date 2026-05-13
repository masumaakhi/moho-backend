import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationProcessor } from './automation.processor';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../database/database.module';
import { ReportsModule } from '../reports/reports.module';

import { SystemController } from './system.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'automation',
    }),
    DatabaseModule,
    ReportsModule,
  ],
  controllers: [AutomationController, SystemController],
  providers: [AutomationService, AutomationProcessor],
  exports: [AutomationService],
})
export class AutomationModule {}
