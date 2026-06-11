import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CacheService } from '../../database/cache.service';

@Injectable()
export class HeroCampaignsService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private cacheService: CacheService,
  ) {}

  async findAll(query: any) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status !== undefined) {
      where.is_active = status === 'active';
    }

    const [items, total] = await Promise.all([
      this.prisma.heroCampaign.findMany({
        where,
        orderBy: { sort_order: 'asc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      this.prisma.heroCampaign.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async findPublic() {
    const cacheKey = 'campaigns:public:active';
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.prisma.heroCampaign.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    await this.cacheService.set(cacheKey, result, 600); // cache for 10 minutes
    return result;
  }

  async create(adminId: string, data: any) {
    const campaign = await this.prisma.heroCampaign.create({ data });
    
    await this.cacheService.del('campaigns:public:active');

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'hero-campaigns',
      action: 'create',
      entity_type: 'hero-campaign',
      entity_id: campaign.id,
      description: `Created hero campaign: ${campaign.text.substring(0, 50)}...`,
    });

    return campaign;
  }

  async update(adminId: string, id: string, data: any) {
    const campaign = await this.prisma.heroCampaign.update({
      where: { id },
      data,
    });

    await this.cacheService.del('campaigns:public:active');

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'hero-campaigns',
      action: 'update',
      entity_type: 'hero-campaign',
      entity_id: id,
      description: `Updated hero campaign: ${campaign.text.substring(0, 50)}...`,
    });

    return campaign;
  }

  async remove(adminId: string, id: string) {
    const campaign = await this.prisma.heroCampaign.delete({ where: { id } });

    await this.cacheService.del('campaigns:public:active');

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'hero-campaigns',
      action: 'delete',
      entity_type: 'hero-campaign',
      entity_id: id,
      description: `Deleted hero campaign: ${campaign.text.substring(0, 50)}...`,
    });

    return campaign;
  }
}
