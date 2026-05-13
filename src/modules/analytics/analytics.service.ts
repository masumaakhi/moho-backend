import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { successResponse } from '../../common/responses/api-response';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's Stats
    const todayOrders = await this.prisma.order.count({
      where: { created_at: { gte: today }, deleted_at: null },
    });

    const yesterdayOrders = await this.prisma.order.count({
      where: { created_at: { gte: yesterday, lt: today }, deleted_at: null },
    });

    const todayRevenue = await this.prisma.order.aggregate({
      where: { created_at: { gte: today }, order_status: { not: 'cancelled' }, deleted_at: null },
      _sum: { total_amount: true },
    });

    const yesterdayRevenue = await this.prisma.order.aggregate({
      where: { created_at: { gte: yesterday, lt: today }, order_status: { not: 'cancelled' }, deleted_at: null },
      _sum: { total_amount: true },
    });

    // Delivered, Pending, Cancelled/Returned
    const deliveredCount = await this.prisma.order.count({
      where: { order_status: 'delivered', deleted_at: null },
    });

    const pendingCount = await this.prisma.order.count({
      where: { order_status: 'pending', deleted_at: null },
    });

    const returnedCount = await this.prisma.order.count({
      where: { order_status: { in: ['cancelled', 'returned'] }, deleted_at: null },
    });

    // Calculate changes
    const ordersChange = this.calculateChange(todayOrders, yesterdayOrders);
    const revenueChange = this.calculateChange(
      Number(todayRevenue._sum.total_amount || 0),
      Number(yesterdayRevenue._sum.total_amount || 0)
    );

    return successResponse('Dashboard summary fetched', {
      today_orders: {
        value: todayOrders,
        change: ordersChange,
      },
      today_revenue: {
        value: Number(todayRevenue._sum.total_amount || 0),
        change: revenueChange,
      },
      delivered_orders: deliveredCount,
      pending_orders: pendingCount,
      returned_orders: returnedCount,
    });
  }

  async getSalesAnalytics(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: { created_at: { gte: startDate }, deleted_at: null },
      select: { created_at: true, total_amount: true },
    });

    const chartData = this.groupByDay(orders, days);

    return successResponse(`Sales analytics for last ${days} days`, chartData);
  }

  async getRevenueAnalytics(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        created_at: { gte: startDate },
        order_status: { not: 'cancelled' },
        deleted_at: null,
      },
      select: { created_at: true, total_amount: true },
    });

    const chartData = this.groupByDay(orders, days, 'revenue');

    return successResponse(`Revenue analytics for last ${days} days`, chartData);
  }

  async getBestSellingProducts(limit: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const topProducts = await this.prisma.orderItem.groupBy({
      by: ['product_id'],
      _sum: { quantity: true },
      where: { created_at: { gte: startDate } },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    const products = await Promise.all(
      topProducts.map(async (tp) => {
        const product = await this.prisma.product.findUnique({
          where: { id: tp.product_id },
          include: { category: true },
        });
        return {
          name: product?.name || 'Unknown',
          category: product?.category?.name || 'General',
          sales_count: tp._sum.quantity,
          revenue: Number(tp._sum.quantity || 0) * Number(product?.new_price || product?.base_price || 0),
        };
      })
    );

    return successResponse('Best selling products fetched', products);
  }

  async getAlerts() {
    const lowStock = await this.prisma.product.findMany({
      where: { stock_quantity: { lt: 10 }, status: 'active', deleted_at: null },
      include: { category: true },
      take: 5,
    });

    const recentOrders = await this.prisma.order.findMany({
      where: { deleted_at: null },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    const unreadNotifications = await this.prisma.notification.count({
      where: { is_read: false },
    });

    return successResponse('Alerts and recent activity fetched', {
      low_stock: lowStock.map(p => ({
        name: p.name,
        stock: p.stock_quantity,
        category: p.category.name,
      })),
      recent_orders: recentOrders.map(o => ({
        id: `#${o.order_number}`,
        customer: o.customer_name || 'Guest',
        amount: `৳ ${o.total_amount}`,
        status: o.order_status,
        created_at: o.created_at,
      })),
      unread_notifications: unreadNotifications,
    });
  }

  private calculateChange(today: number, yesterday: number) {
    if (yesterday === 0) return today > 0 ? '+100%' : '0%';
    const change = ((today - yesterday) / yesterday) * 100;
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  }

  private groupByDay(data: any[], days: number, type: 'count' | 'revenue' = 'count') {
    const result: { day: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayData = data.filter((item) => {
        const itemDate = new Date(item.created_at);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate.getTime() === d.getTime();
      });

      if (type === 'count') {
        result.push({ day: dayLabel, value: dayData.length });
      } else {
        const sum = dayData.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
        result.push({ day: dayLabel, value: sum });
      }
    }
    return result;
  }
}
