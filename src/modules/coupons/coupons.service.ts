import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class CouponsService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll(query: any) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status !== undefined) {
      where.is_active = status === 'active';
    }

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async create(adminId: string, data: any) {
    // Force uppercase code
    const payload = {
      ...data,
      code: data.code.toUpperCase(),
      discount_value: Number(data.discount_value),
      min_order_amount: Number(data.min_order_amount || 0),
      max_discount_amount: data.max_discount_amount ? Number(data.max_discount_amount) : null,
      expiry_date: data.expiry_date ? new Date(data.expiry_date) : null,
      usage_limit: data.usage_limit ? Number(data.usage_limit) : null,
    };

    const coupon = await this.prisma.coupon.create({ data: payload });
    
    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'coupons',
      action: 'create',
      entity_type: 'coupon',
      entity_id: coupon.id,
      description: `Created coupon code: ${coupon.code} (${coupon.discount_type}: ${coupon.discount_value})`,
    });

    return coupon;
  }

  async update(adminId: string, id: string, data: any) {
    const payload: any = { ...data };
    if (data.code) payload.code = data.code.toUpperCase();
    if (data.discount_value !== undefined) payload.discount_value = Number(data.discount_value);
    if (data.min_order_amount !== undefined) payload.min_order_amount = Number(data.min_order_amount);
    if (data.max_discount_amount !== undefined) payload.max_discount_amount = data.max_discount_amount ? Number(data.max_discount_amount) : null;
    if (data.expiry_date !== undefined) payload.expiry_date = data.expiry_date ? new Date(data.expiry_date) : null;
    if (data.usage_limit !== undefined) payload.usage_limit = data.usage_limit ? Number(data.usage_limit) : null;

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: payload,
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'coupons',
      action: 'update',
      entity_type: 'coupon',
      entity_id: id,
      description: `Updated coupon code: ${coupon.code}`,
    });

    return coupon;
  }

  async remove(adminId: string, id: string) {
    const coupon = await this.prisma.coupon.delete({ where: { id } });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'coupons',
      action: 'delete',
      entity_type: 'coupon',
      entity_id: id,
      description: `Deleted coupon code: ${coupon.code}`,
    });

    return coupon;
  }
}
