import { Controller, Get, Post, Delete, Body, Param, Query, Res, UseGuards, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@Controller('admin/reports')
@UseGuards(AdminAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getReportSummary(startDate, endDate);
  }

  @Get('daily')
  getDaily(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getDailyReports(startDate, endDate);
  }

  @Get('profit')
  getProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getReportSummary(startDate, endDate);
  }

  @Get('filters')
  getFilters() {
    return this.reportsService.getFilters();
  }

  // -------------------------------------------------------------
  // MULTI-VIEW ROUTING GATEWAY
  // -------------------------------------------------------------
  @Get('multi-view')
  getMultiView(
    @Query('view') view: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getMultiViewReports(view, startDate, endDate);
  }

  // -------------------------------------------------------------
  // MASTER SETTINGS / PRICES
  // -------------------------------------------------------------
  @Get('manual/prices')
  getManualPrices() {
    return this.reportsService.getManualPrices();
  }

  @Post('manual/prices')
  saveManualPrices(
    @Body() prices: any,
    @Req() req: any,
  ) {
    const adminId = (req.user as any)?.sub;
    return this.reportsService.saveManualPrices(prices, adminId);
  }

  // -------------------------------------------------------------
  // MANUAL LEDGER DAILY CRUD
  // -------------------------------------------------------------
  @Get('manual')
  getManualEntries(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getManualEntries(startDate, endDate);
  }

  @Post('manual')
  saveManualEntry(
    @Body() data: any,
    @Req() req: any,
  ) {
    const adminId = (req.user as any)?.sub;
    return this.reportsService.saveManualEntry(data, adminId);
  }

  @Delete('manual/:id')
  deleteManualEntry(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const adminId = (req.user as any)?.sub;
    return this.reportsService.deleteManualEntry(id, adminId);
  }

  // -------------------------------------------------------------
  // EXCEL / PDF EXPORTS WITH VIEW SELECTOR
  // -------------------------------------------------------------
  @Get('export/excel')
  async exportExcel(
    @Res() res: any,
    @Req() req: any,
    @Query('view') view = 'combined',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const adminId = (req.user as any)?.sub;
    return this.reportsService.exportToExcel(res, startDate, endDate, adminId, view);
  }

  @Get('export/pdf')
  async exportPdf(
    @Res() res: any,
    @Req() req: any,
    @Query('view') view = 'combined',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const adminId = (req.user as any)?.sub;
    return this.reportsService.exportToPdf(res, startDate, endDate, adminId, view);
  }
}
