import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CacheService } from '../../database/cache.service';

@Injectable()
export class BannersService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private cacheService: CacheService,
  ) {}

  async findAll(query: any) {
    const { status, type, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Check if it's the public active banners query to read from cache
    const isPublicActive = status === 'active' && !type && Number(page) === 1;
    const cacheKey = 'banners:public:active';

    if (isPublicActive) {
      const cached = await this.cacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

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

    const result = {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };

    if (isPublicActive) {
      await this.cacheService.set(cacheKey, result, 600); // cache for 10 minutes
    }

    return result;
  }

  async create(adminId: string, data: any) {
    const banner = await this.prisma.banner.create({ data });

    await this.cacheService.del('banners:public:active');

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

    await this.cacheService.del('banners:public:active');

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

    await this.cacheService.del('banners:public:active');

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
