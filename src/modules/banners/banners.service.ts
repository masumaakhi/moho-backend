import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class BannersService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll(query: any) {
    const { status, type, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      this.prisma.banner.findMany({
        where,
        orderBy: { sort_order: 'asc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      this.prisma.banner.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async create(adminId: string, data: any) {
    const banner = await this.prisma.banner.create({ data });
    
    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'banners',
      action: 'create',
      entity_type: 'banner',
      entity_id: banner.id,
      description: `Created banner: ${banner.title}`,
    });

    return banner;
  }

  async update(adminId: string, id: string, data: any) {
    const banner = await this.prisma.banner.update({
      where: { id },
      data,
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'banners',
      action: 'update',
      entity_type: 'banner',
      entity_id: id,
      description: `Updated banner: ${banner.title}`,
    });

    return banner;
  }

  async remove(adminId: string, id: string) {
    const banner = await this.prisma.banner.delete({ where: { id } });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'banners',
      action: 'delete',
      entity_type: 'banner',
      entity_id: id,
      description: `Deleted banner: ${banner.title}`,
    });

    return banner;
  }
}
