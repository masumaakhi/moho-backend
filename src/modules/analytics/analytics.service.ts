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

  async getProfitVsExpenses() {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180); // Go back 6 months for history
    startDate.setHours(0, 0, 0, 0);

    const [orders, bookings, expenses, manualEntries] = await Promise.all([
      this.prisma.order.findMany({
        where: { created_at: { gte: startDate }, deleted_at: null },
        include: {
          order_items: {
            include: {
              product: { select: { cost_price: true } }
            }
          }
        }
      }),
      this.prisma.deliveryBooking.findMany({
        where: { created_at: { gte: startDate } }
      }),
      this.prisma.businessExpense.findMany({
        where: { date: { gte: startDate } }
      }),
      this.prisma.manualLedgerEntry.findMany({
        where: { date: { gte: startDate } }
      })
    ]);

    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const dailyMap: { [dateStr: string]: { date: string; label: string; revenue: number; expenses: number; profit: number } } = {};

    for (let i = 180; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDateStr(d);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[dateStr] = {
        date: dateStr,
        label,
        revenue: 0,
        expenses: 0,
        profit: 0
      };
    }

    orders.forEach(o => {
      const dateStr = formatDateStr(o.created_at);
      if (dailyMap[dateStr]) {
        if (o.order_status === 'delivered' || o.order_status === 'shipped') {
          dailyMap[dateStr].revenue += Number(o.total_amount || 0);
          const prodCost = o.order_items.reduce((sum, item) => {
            return sum + (Number(item.product.cost_price || 0) * item.quantity);
          }, 0);
          dailyMap[dateStr].expenses += prodCost;
        }
      }
    });

    bookings.forEach(b => {
      const dateStr = formatDateStr(b.created_at);
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].expenses += 60; // Standard booking fee
      }
    });

    expenses.forEach(e => {
      const dateStr = formatDateStr(e.date);
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].expenses += Number(e.amount || 0);
      }
    });

    manualEntries.forEach(m => {
      const dateStr = formatDateStr(m.date);
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].revenue += Number(m.sale_amount || 0);
        dailyMap[dateStr].expenses += Number(m.total_expenses || 0);
      }
    });

    Object.keys(dailyMap).forEach(key => {
      const item = dailyMap[key];
      item.revenue = Math.round(item.revenue * 100) / 100;
      item.expenses = Math.round(item.expenses * 100) / 100;
      item.profit = Math.round((item.revenue - item.expenses) * 100) / 100;
    });

    const sortedDays = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    
    // 1. Daily (Last 15 days)
    const dailyData = sortedDays.slice(-15);

    // 2. Weekly (Last 8 weeks)
    const weeklyMap: { [weekLabel: string]: { label: string; revenue: number; expenses: number; profit: number; order: number } } = {};
    sortedDays.forEach(day => {
      const d = new Date(day.date);
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const weekLabel = `W/C ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      if (!weeklyMap[weekLabel]) {
        weeklyMap[weekLabel] = {
          label: weekLabel,
          revenue: 0,
          expenses: 0,
          profit: 0,
          order: monday.getTime()
        };
      }
      weeklyMap[weekLabel].revenue += day.revenue;
      weeklyMap[weekLabel].expenses += day.expenses;
      weeklyMap[weekLabel].profit += day.profit;
    });

    const weeklyData = Object.values(weeklyMap)
      .sort((a, b) => a.order - b.order)
      .slice(-8)
      .map(({ label, revenue, expenses, profit }) => ({
        label,
        revenue: Math.round(revenue),
        expenses: Math.round(expenses),
        profit: Math.round(profit)
      }));

    // 3. Monthly (Last 6 months)
    const monthlyMap: { [monthLabel: string]: { label: string; revenue: number; expenses: number; profit: number; order: number } } = {};
    sortedDays.forEach(day => {
      const d = new Date(day.date);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const orderKey = d.getFullYear() * 12 + d.getMonth();

      if (!monthlyMap[monthLabel]) {
        monthlyMap[monthLabel] = {
          label: monthLabel,
          revenue: 0,
          expenses: 0,
          profit: 0,
          order: orderKey
        };
      }
      monthlyMap[monthLabel].revenue += day.revenue;
      monthlyMap[monthLabel].expenses += day.expenses;
      monthlyMap[monthLabel].profit += day.profit;
    });

    const monthlyData = Object.values(monthlyMap)
      .sort((a, b) => a.order - b.order)
      .slice(-6)
      .map(({ label, revenue, expenses, profit }) => ({
        label,
        revenue: Math.round(revenue),
        expenses: Math.round(expenses),
        profit: Math.round(profit)
      }));

    return {
      success: true,
      data: {
        daily: dailyData,
        weekly: weeklyData,
        monthly: monthlyData
      }
    };
  }

  async getSalesRevenueOrders() {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: { created_at: { gte: startDate }, deleted_at: null },
      select: { created_at: true, total_amount: true, order_status: true }
    });

    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const dailyMap: { [dateStr: string]: { date: string; label: string; orders: number; revenue: number } } = {};

    for (let i = 180; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDateStr(d);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[dateStr] = {
        date: dateStr,
        label,
        orders: 0,
        revenue: 0
      };
    }

    orders.forEach(o => {
      const dateStr = formatDateStr(o.created_at);
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].orders += 1;
        if (o.order_status !== 'cancelled') {
          dailyMap[dateStr].revenue += Number(o.total_amount || 0);
        }
      }
    });

    Object.keys(dailyMap).forEach(key => {
      const item = dailyMap[key];
      item.revenue = Math.round(item.revenue * 100) / 100;
    });

    const sortedDays = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    const dailyData = sortedDays.slice(-15);

    const weeklyMap: { [weekLabel: string]: { label: string; orders: number; revenue: number; order: number } } = {};
    sortedDays.forEach(day => {
      const d = new Date(day.date);
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const weekLabel = `W/C ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      if (!weeklyMap[weekLabel]) {
        weeklyMap[weekLabel] = {
          label: weekLabel,
          orders: 0,
          revenue: 0,
          order: monday.getTime()
        };
      }
      weeklyMap[weekLabel].orders += day.orders;
      weeklyMap[weekLabel].revenue += day.revenue;
    });

    const weeklyData = Object.values(weeklyMap)
      .sort((a, b) => a.order - b.order)
      .slice(-8)
      .map(({ label, orders, revenue }) => ({
        label,
        orders,
        revenue: Math.round(revenue)
      }));

    const monthlyMap: { [monthLabel: string]: { label: string; orders: number; revenue: number; order: number } } = {};
    sortedDays.forEach(day => {
      const d = new Date(day.date);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const orderKey = d.getFullYear() * 12 + d.getMonth();

      if (!monthlyMap[monthLabel]) {
        monthlyMap[monthLabel] = {
          label: monthLabel,
          orders: 0,
          revenue: 0,
          order: orderKey
        };
      }
      monthlyMap[monthLabel].orders += day.orders;
      monthlyMap[monthLabel].revenue += day.revenue;
    });

    const monthlyData = Object.values(monthlyMap)
      .sort((a, b) => a.order - b.order)
      .slice(-6)
      .map(({ label, orders, revenue }) => ({
        label,
        orders,
        revenue: Math.round(revenue)
      }));

    return {
      success: true,
      data: {
        daily: dailyData,
        weekly: weeklyData,
        monthly: monthlyData
      }
    };
  }
}

