import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportsService } from '../reports/reports.service';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Processor('automation')
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
    private config: ConfigService,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host: 'smtp-brevo.com',
      port: 587,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'daily-report':
        return this.handleDailyReportJob(job);
      case 'email-retry':
        return this.handleEmailRetryJob(job);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleDailyReportJob(job: Job) {
    const automationJob = await this.prisma.automationJob.create({
      data: {
        name: 'Daily Report Generation',
        status: 'running',
        started_at: new Date(),
        payload: job.data,
      },
    });

    try {
      // 1. Generate Report
      const date = new Date();
      date.setDate(date.getDate() - 1); // Yesterday's report
      const dateStr = date.toISOString().split('T')[0];
      
      const report = await this.reportsService.getReportSummary(dateStr, dateStr);

      // 2. Save to DailyReport table
      await this.prisma.dailyReport.upsert({
        where: { date: new Date(dateStr) },
        update: {
          total_orders: report.data.summary.total_orders,
          total_revenue: report.data.summary.total_revenue,
          total_cost: report.data.summary.product_cost,
          total_profit: report.data.summary.gross_profit,
          total_expenses: report.data.summary.total_expenses,
          net_profit: report.data.summary.net_profit,
        },
        create: {
          date: new Date(dateStr),
          total_orders: report.data.summary.total_orders,
          total_revenue: report.data.summary.total_revenue,
          total_cost: report.data.summary.product_cost,
          total_profit: report.data.summary.gross_profit,
          total_expenses: report.data.summary.total_expenses,
          net_profit: report.data.summary.net_profit,
        },
      });

      // 3. Get Receivers (Settings Primary + Custom list + All Super Admins)
      const configuredReceivers = await this.prisma.reportReceiver.findMany({
        where: { is_active: true },
      });

      const superAdmins = await this.prisma.adminUser.findMany({
        where: { 
           role: { name: 'Super Admin' },
           deleted_at: null 
        },
        select: { email: true, name: true, id: true }
      });

      const notificationSettings = await this.prisma.setting.findFirst({
        where: { key: 'admin_report_email' }
      });
      const primaryAdminEmail = notificationSettings?.value;

      // Combine and unique by email
      const allReceivers = [
        ...(primaryAdminEmail ? [{ email: primaryAdminEmail, name: 'Primary Admin', id: null }] : []),
        ...configuredReceivers.map(r => ({ email: r.email, name: r.name, id: null })),
        ...superAdmins.map(a => ({ email: a.email as string, name: a.name, id: a.id }))
      ].filter((v, i, a) => v.email && a.findIndex(t => t.email === v.email) === i);

      if (allReceivers.length === 0) {
        await this.prisma.automationJob.update({
          where: { id: automationJob.id },
          data: {
            status: 'partial_failed',
            finished_at: new Date(),
            error_log: 'No active report receivers or super admins found',
          },
        });
        return { success: true, message: 'Report generated but no receivers found' };
      }

      for (const receiver of allReceivers) {
        try {
          const subject = `Daily Business Report - ${dateStr}`;
          const text = `Hello ${receiver.name || 'Admin'},\n\nHere is the business summary for ${dateStr}:\n\n` +
                       `Revenue: ৳${Number(report.data.summary.total_revenue).toLocaleString()}\n` +
                       `Net Profit: ৳${Number(report.data.summary.net_profit).toLocaleString()}\n` +
                       `Total Orders: ${report.data.summary.total_orders}\n` +
                       `Delivered: ${report.data.summary.delivered_orders}\n\n` +
                       `You can view full details in the Admin Dashboard under Intelligence > Reports.`;

          await this.sendEmail(receiver.email, subject, text);

          // 4. Create In-App Notification for Admin
          if (receiver.id) {
             await this.prisma.notification.create({
                data: {
                   user_id: receiver.id,
                   type: 'system-alert',
                   title: 'Daily Report Sent',
                   message: `The business report for ${dateStr} has been sent to your email (${receiver.email}).`
                }
             });
          }
        } catch (emailError) {
          this.logger.error(`Failed to send report to ${receiver.email}: ${emailError.message}`);
          await this.prisma.emailLog.create({
            data: {
              to: receiver.email,
              subject: `Daily Business Report - ${dateStr}`,
              status: 'failed',
              error: emailError.message,
            },
          });
        }
      }

      await this.prisma.automationJob.update({
        where: { id: automationJob.id },
        data: {
          status: 'success',
          finished_at: new Date(),
          result: { report_date: dateStr, receivers_count: allReceivers.length },
        },
      });

    } catch (error) {
      this.logger.error(`Daily report job failed: ${error.message}`);
      await this.prisma.automationJob.update({
        where: { id: automationJob.id },
        data: {
          status: 'failed',
          finished_at: new Date(),
          error_log: error.message,
        },
      });
      throw error;
    }
  }

  private async handleEmailRetryJob(job: Job) {
    const { emailLogId, to, subject } = job.data;
    
    try {
      // Logic to resend the actual content would need to store the content in EmailLog
      // For now, we'll simulate a retry
      await this.sendEmail(to, `[RETRY] ${subject}`, 'This is a retry of a previously failed email.');
      
      await this.prisma.emailLog.update({
        where: { id: emailLogId },
        data: { status: 'sent', last_retry: new Date() },
      });
    } catch (error) {
      await this.prisma.emailLog.update({
        where: { id: emailLogId },
        data: { 
          status: 'failed', 
          error: error.message, 
          retry_count: { increment: 1 },
          last_retry: new Date()
        },
      });
      throw error;
    }
  }

  private async sendEmail(to: string, subject: string, text: string) {
    return this.transporter.sendMail({
      from: this.config.get('SENDER_EMAIL'),
      to,
      subject,
      text,
    });
  }
}
