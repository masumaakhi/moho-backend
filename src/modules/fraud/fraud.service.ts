import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class FraudService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activityLogs: ActivityLogsService,
  ) {}

  async checkFraudAndDuplicates(orderId: string, customerPhone: string, shippingAddress: string, items: any[]) {
    let fraudScore = 0;
    const reasons: string[] = [];
    const duplicateMatches: any[] = [];

    // 1. Blacklist Check
    const blacklisted = await this.prisma.fraudBlacklistNumber.findFirst({
      where: { phone: customerPhone, is_active: true },
    });

    if (blacklisted) {
      fraudScore += 100;
      reasons.push(`Phone number ${customerPhone} is blacklisted: ${blacklisted.reason || 'No reason provided'}`);
    }

    // 2. Duplicate Order Check (Orders within last 24h with same phone or address)
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const previousOrders = await this.prisma.order.findMany({
      where: {
        id: { not: orderId },
        created_at: { gte: oneDayAgo },
        OR: [
          { customer_phone: customerPhone },
          { shipping_address: { contains: shippingAddress.substring(0, 20), mode: 'insensitive' } },
        ],
        deleted_at: null,
      },
      include: { order_items: true },
    });

    for (const oldOrder of previousOrders) {
      let matchScore = 0;
      const matchedFields: string[] = [];

      if (oldOrder.customer_phone === customerPhone) {
        matchScore += 50;
        matchedFields.push('phone');
      }

      if (oldOrder.shipping_address && oldOrder.shipping_address.toLowerCase() === shippingAddress.toLowerCase()) {
        matchScore += 40;
        matchedFields.push('address');
      }

      // Check for same products
      const oldProductIds = oldOrder.order_items.map(i => i.product_id);
      const newProductIds = items.map(i => i.product_id);
      const commonProducts = oldProductIds.filter(id => newProductIds.includes(id));

      if (commonProducts.length > 0) {
        matchScore += 30;
        matchedFields.push('products');
      }

      if (matchScore >= 50) {
        duplicateMatches.push({
          old_order_id: oldOrder.id,
          match_percentage: Math.min(matchScore, 100),
          matched_fields: matchedFields,
        });
        
        fraudScore += 20;
        reasons.push(`Duplicate pattern found with Order #${oldOrder.order_number} (${matchedFields.join(', ')})`);
      }
    }

    // 3. Customer History Check (Returned/Cancelled orders)
    const customer = await this.prisma.customer.findFirst({
      where: { phone: customerPhone },
    });

    if (customer) {
      const badOrders = await this.prisma.order.count({
        where: {
          customer_id: customer.id,
          order_status: { in: ['cancelled', 'returned'] },
        },
      });

      if (badOrders > 2) {
        fraudScore += 30;
        reasons.push(`Customer has ${badOrders} previous cancelled/returned orders`);
      }
    }

    // Save Duplicate Matches
    for (const match of duplicateMatches) {
      await this.prisma.duplicateOrderMatch.create({
        data: {
          new_order_id: orderId,
          old_order_id: match.old_order_id,
          match_percentage: match.match_percentage,
          matched_fields: match.matched_fields,
        },
      });
    }

    // Create Suspicious Order record if score > 30
    if (fraudScore >= 30) {
      await this.prisma.suspiciousOrder.create({
        data: {
          order_id: orderId,
          fraud_score: fraudScore,
          reasons: { reasons },
        },
      });

      // Update Order Status to pending_review
      await this.prisma.order.update({
        where: { id: orderId },
        data: { order_status: 'pending_review' },
      });

      // Create Notification for Admins
      await this.notifications.create({
        type: 'fraud-alert',
        title: 'Suspicious Order Detected',
        message: `Order #${orderId} flagged with fraud score ${fraudScore}. Review required.`,
      });
    }

    return { fraudScore, reasons };
  }

  // Blacklist Management
  async getBlacklist(query: any) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.phone = { contains: search };
    }

    const [items, total] = await Promise.all([
      this.prisma.fraudBlacklistNumber.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      this.prisma.fraudBlacklistNumber.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async addToBlacklist(adminId: string, data: { phone: string; reason?: string }) {
    const existing = await this.prisma.fraudBlacklistNumber.findUnique({
      where: { phone: data.phone },
    });

    if (existing) {
      return this.prisma.fraudBlacklistNumber.update({
        where: { phone: data.phone },
        data: { reason: data.reason, is_active: true },
      });
    }

    const entry = await this.prisma.fraudBlacklistNumber.create({
      data: { phone: data.phone, reason: data.reason },
    });

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'fraud',
      action: 'add_blacklist',
      description: `Added ${data.phone} to fraud blacklist`,
    });

    return entry;
  }

  async updateBlacklistStatus(id: string, active: boolean) {
    return this.prisma.fraudBlacklistNumber.update({
      where: { id },
      data: { is_active: active },
    });
  }

  // Suspicious Orders
  async getSuspiciousOrders(query: any) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = status ? { status } : {};

    const [items, total] = await Promise.all([
      (this.prisma.suspiciousOrder as any).findMany({
        where,
        include: {
          order: {
            include: { 
              user: true, 
              customer: true,
              duplicate_new_matches: {
                include: {
                  old_order: true
                }
              }
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: Number(skip),
        take: Number(limit),
      }),
      (this.prisma.suspiciousOrder as any).count({ where }),
    ]);

    return {
      items,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  async reviewOrder(adminId: string, id: string, action: 'approve' | 'block' | 'mark_safe' | 'blacklist') {
    const suspicious = await (this.prisma.suspiciousOrder as any).findUnique({
      where: { id },
      include: { order: true },
    }) as any;

    if (!suspicious) throw new Error('Suspicious order not found');

    const orderId = suspicious.order_id;
    const phone = suspicious.order.customer_phone;

    if (action === 'approve') {
      await this.prisma.suspiciousOrder.update({
        where: { id },
        data: { status: 'approved' },
      });
      await this.prisma.order.update({
        where: { id: orderId },
        data: { order_status: 'confirmed' }, // or processing
      });
    } else if (action === 'block') {
      await this.prisma.suspiciousOrder.update({
        where: { id },
        data: { status: 'blocked' },
      });
      await this.prisma.order.update({
        where: { id: orderId },
        data: { order_status: 'cancelled' },
      });
    } else if (action === 'mark_safe') {
      await this.prisma.suspiciousOrder.update({
        where: { id },
        data: { status: 'safe' },
      });
      await this.prisma.order.update({
        where: { id: orderId },
        data: { order_status: 'pending' },
      });
    } else if (action === 'blacklist') {
      await this.addToBlacklist(adminId, { phone, reason: 'Manual blacklist from fraud review' });
      await this.prisma.suspiciousOrder.update({
        where: { id },
        data: { status: 'blocked' },
      });
      await this.prisma.order.update({
        where: { id: orderId },
        data: { order_status: 'cancelled' },
      });
    }

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminId,
      module_name: 'fraud',
      action: `review_${action}`,
      entity_type: 'suspicious_order',
      entity_id: id,
      description: `Reviewed suspicious order #${orderId} with action ${action}`,
    });

    return { success: true };
  }
}
