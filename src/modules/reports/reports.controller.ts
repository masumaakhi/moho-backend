import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
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

  @Get('export/excel')
  async exportExcel(
    @Res() res: any,
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const adminId = (req.user as any)?.sub;
    return this.reportsService.exportToExcel(res, startDate, endDate, adminId);
  }

  @Get('export/pdf')
  async exportPdf(
    @Res() res: any,
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const adminId = (req.user as any)?.sub;
    return this.reportsService.exportToPdf(res, startDate, endDate, adminId);
  }
}
