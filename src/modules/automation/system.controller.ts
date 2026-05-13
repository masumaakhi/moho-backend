import { Controller, Post, Body, Param } from '@nestjs/common';
import { AutomationService } from './automation.service';

@Controller('system')
export class SystemController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('cron/daily-report')
  async triggerCron() {
    await this.automationService.handleDailyReportCron();
    return { success: true, message: 'Cron job triggered manually' };
  }

  @Post('queue/email-retry')
  async triggerRetry(@Body('emailLogId') id: string) {
    await this.automationService.retryFailedEmail(id);
    return { success: true, message: 'Retry job added' };
  }
}
