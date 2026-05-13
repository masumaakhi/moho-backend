import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class SubscribersService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll(query: any) {
    const { status, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      this.prisma.newsletterSubscriber.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async updateStatus(adminId: string, id: string, status: string) {
    const subscriber = await this.prisma.newsletterSubscriber.update({
      where: { id },
      data: { status },
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'subscribers',
      action: 'update_status',
      entity_type: 'subscriber',
      entity_id: id,
      description: `Updated subscriber ${subscriber.email} status to ${status}`,
    });

    return subscriber;
  }

  async remove(adminId: string, id: string) {
    const subscriber = await this.prisma.newsletterSubscriber.delete({
      where: { id },
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'subscribers',
      action: 'delete',
      entity_type: 'subscriber',
      entity_id: id,
      description: `Deleted subscriber: ${subscriber.email}`,
    });

    return { success: true, message: 'Subscriber deleted' };
  }

  async exportSubscribers(res: any, adminUserId: string) {
    const subscribers = await this.prisma.newsletterSubscriber.findMany();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Subscribers');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 40 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 },
    ];

    subscribers.forEach(s => {
      worksheet.addRow({
        id: s.id,
        email: s.email,
        status: s.status,
        created_at: s.created_at.toISOString(),
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=subscribers.xlsx');

    await workbook.xlsx.write(res);
    res.end();

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminUserId,
      module_name: 'subscribers',
      action: 'export',
      entity_type: 'subscriber',
      description: `Exported ${subscribers.length} subscribers`,
    });
  }
}
