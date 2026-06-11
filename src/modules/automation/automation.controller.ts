import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@Controller('admin/automation')
@UseGuards(AdminAuthGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('daily-report')
  async triggerDailyReport(@Req() req: any) {
    const adminId = req.user.sub;
    const job = await this.automationService.triggerDailyReportManual(adminId);
    return {
      success: true,
      message: 'Daily report generation job added to queue',
      jobId: job.id,
    };
  }

  @Post('email/retry/:id')
  async retryEmail(@Param('id') id: string) {
    const job = await this.automationService.retryFailedEmail(id);
    return {
      success: true,
      message: 'Email retry job added to queue',
      jobId: job.id,
    };
  }

  @Get('logs')
  async getLogs(@Query('limit') limit?: number) {
    const logs = await this.automationService.getAutomationLogs(
      Number(limit) || 20,
    );
    return {
      success: true,
      data: logs,
    };
  }

  @Get('receivers')
  async getReceivers() {
    const receivers = await this.automationService.getReportReceivers();
    return {
      success: true,
      data: receivers,
    };
  }

  @Post('receivers')
  async addReceiver(@Body() data: { email: string; name?: string }) {
    const receiver = await this.automationService.addReportReceiver(data);
    return {
      success: true,
      data: receiver,
    };
  }

  @Post('receivers/:id/toggle')
  async toggleReceiver(@Param('id') id: string) {
    const receiver = await this.automationService.toggleReportReceiver(id);
    return {
      success: true,
      data: receiver,
    };
  }
}
