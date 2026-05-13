import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll(query: any) {
    const { status, rating, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (rating) where.rating = Number(rating);

    const [items, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        include: {
          product: { select: { name: true, slug: true } },
          customer: { select: { name: true, email: true } },
          user: { select: { name: true, avatar_url: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      this.prisma.productReview.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async updateStatus(adminId: string, id: string, status: string) {
    const review = await this.prisma.productReview.update({
      where: { id },
      data: { status },
      include: { product: true },
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'reviews',
      action: 'update_status',
      entity_type: 'review',
      entity_id: id,
      description: `Updated review status for ${review.product.name} to ${status}`,
    });

    return review;
  }

  async remove(adminId: string, id: string) {
    const review = await this.prisma.productReview.delete({
      where: { id },
      include: { product: true },
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'reviews',
      action: 'delete',
      entity_type: 'review',
      entity_id: id,
      description: `Deleted review for product: ${review.product.name}`,
    });

    return review;
  }
}
