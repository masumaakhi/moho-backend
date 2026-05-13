import { Module, Global } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';
import { PrismaService } from '../../database/prisma.service';

@Global()
@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService, PrismaService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
