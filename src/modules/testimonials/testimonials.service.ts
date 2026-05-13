import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class TestimonialsService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll(query: any) {
    const { is_active, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const [items, total] = await Promise.all([
      this.prisma.testimonial.findMany({
        where,
        orderBy: { sort_order: 'asc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      this.prisma.testimonial.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async findActive() {
    return this.prisma.testimonial.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });
  }

  async create(adminId: string, data: any) {
    const testimonial = await this.prisma.testimonial.create({ data });
    
    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'testimonials',
      action: 'create',
      entity_type: 'testimonial',
      entity_id: testimonial.id,
      description: `Created testimonial: ${testimonial.name}`,
    });

    return testimonial;
  }

  async update(adminId: string, id: string, data: any) {
    const testimonial = await this.prisma.testimonial.update({
      where: { id },
      data,
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'testimonials',
      action: 'update',
      entity_type: 'testimonial',
      entity_id: id,
      description: `Updated testimonial: ${testimonial.name}`,
    });

    return testimonial;
  }

  async remove(adminId: string, id: string) {
    const testimonial = await this.prisma.testimonial.delete({ where: { id } });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'testimonials',
      action: 'delete',
      entity_type: 'testimonial',
      entity_id: id,
      description: `Deleted testimonial: ${testimonial.name}`,
    });

    return testimonial;
  }
}
