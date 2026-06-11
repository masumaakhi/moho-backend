import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    user_id?: string;
    type: string;
    title: string;
    message: string;
  }) {
    return this.prisma.notification.create({
      data: {
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
      },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    user_id?: string;
    unread?: string;
    type?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [{ user_id: query.user_id }, { user_id: null }],
    };

    if (query.unread === 'true') {
      where.is_read = false;
    }

    if (query.type) {
      const types = query.type.split(',');
      where.type = { in: types };
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        is_read: false,
        OR: [{ user_id: userId }, { user_id: null }],
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.user_id && notification.user_id !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        is_read: false,
        OR: [{ user_id: userId }, { user_id: null }],
      },
      data: { is_read: true },
    });
  }
}
