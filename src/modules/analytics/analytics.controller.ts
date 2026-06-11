import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard/summary')
  getSummary() {
    return this.analyticsService.getSummary();
  }

  @Get('analytics/sales')
  getSalesAnalytics(@Query('days') days?: string) {
    return this.analyticsService.getSalesAnalytics(days ? parseInt(days) : 7);
  }

  @Get('analytics/revenue')
  getRevenueAnalytics(@Query('days') days?: string) {
    return this.analyticsService.getRevenueAnalytics(
      days ? parseInt(days) : 30,
    );
  }

  @Get('analytics/products')
  getBestSellingProducts(@Query('limit') limit?: string) {
    return this.analyticsService.getBestSellingProducts(
      limit ? parseInt(limit) : 5,
    );
  }

  @Get('alerts')
  getAlerts() {
    return this.analyticsService.getAlerts();
  }

  @Get('analytics/profit-vs-expenses')
  getProfitVsExpenses() {
    return this.analyticsService.getProfitVsExpenses();
  }

  @Get('analytics/sales-revenue-orders')
  getSalesRevenueOrders() {
    return this.analyticsService.getSalesRevenueOrders();
  }
}
