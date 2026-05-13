import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectQueue('automation') private automationQueue: Queue,
    private prisma: PrismaService,
    private reportsService: ReportsService,
  ) {}

  // Check every hour for the scheduled report time
  @Cron(CronExpression.EVERY_HOUR)
  async handleDailyReportCron() {
    this.logger.log('Checking for scheduled daily report...');
    
    const settings = await this.prisma.setting.findUnique({
      where: { key: 'report_time' }
    });
    
    const preferredTime = settings?.value || "08:00"; // Default to 8 AM
    const currentHour = new Date().getHours();
    const [prefHour] = preferredTime.split(':').map(Number);

    if (currentHour === prefHour) {
      this.logger.log(`Time matched (${preferredTime}). Adding daily report job to queue.`);
      await this.automationQueue.add('daily-report', {
        source: 'cron',
        timestamp: new Date(),
      });
    }
  }

  async triggerDailyReportManual(adminId: string) {
    this.logger.log(`Manual daily report triggered by admin: ${adminId}`);
    return this.automationQueue.add('daily-report', {
      source: 'manual',
      adminId,
      timestamp: new Date(),
    });
  }

  async retryFailedEmail(emailLogId: string) {
    const log = await this.prisma.emailLog.findUnique({
      where: { id: emailLogId },
    });

    if (!log) throw new Error('Email log not found');

    return this.automationQueue.add('email-retry', {
      emailLogId,
      to: log.to,
      subject: log.subject,
    });
  }

  async getReportReceivers() {
    return this.prisma.reportReceiver.findMany();
  }

  async addReportReceiver(data: { email: string; name?: string }) {
    return this.prisma.reportReceiver.create({
      data: {
        email: data.email,
        name: data.name,
      },
    });
  }

  async toggleReportReceiver(id: string) {
    const receiver = await this.prisma.reportReceiver.findUnique({
      where: { id },
    });
    if (!receiver) throw new Error('Receiver not found');

    return this.prisma.reportReceiver.update({
      where: { id },
      data: { is_active: !receiver.is_active },
    });
  }

  async getAutomationLogs(limit: number = 20) {
    return this.prisma.automationJob.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
    });
  }
}
