import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll(query: any) {
    const { status, type, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status !== undefined) {
      where.is_active = status === 'active';
    }
    if (type !== undefined) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { sort_order: 'asc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async findPublic(type?: string) {
    const where: any = { is_active: true };
    if (type) {
      where.type = type;
    }
    return this.prisma.announcement.findMany({
      where,
      orderBy: { sort_order: 'asc' },
    });
  }

  async create(adminId: string, data: any) {
    const announcement = await this.prisma.announcement.create({ data });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'announcements',
      action: 'create',
      entity_type: 'announcement',
      entity_id: announcement.id,
      description: `Created announcement: ${announcement.text.substring(0, 50)}...`,
    });

    return announcement;
  }

  async update(adminId: string, id: string, data: any) {
    const announcement = await this.prisma.announcement.update({
      where: { id },
      data,
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'announcements',
      action: 'update',
      entity_type: 'announcement',
      entity_id: id,
      description: `Updated announcement: ${announcement.text.substring(0, 50)}...`,
    });

    return announcement;
  }

  async remove(adminId: string, id: string) {
    const announcement = await this.prisma.announcement.delete({
      where: { id },
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'announcements',
      action: 'delete',
      entity_type: 'announcement',
      entity_id: id,
      description: `Deleted announcement: ${announcement.text.substring(0, 50)}...`,
    });

    return announcement;
  }
}
