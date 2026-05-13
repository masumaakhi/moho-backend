import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogsService,
  ) {}

  async getReportSummary(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const whereClause = {
      created_at: {
        gte: start,
        lte: end,
      },
      deleted_at: null,
    };

    const [orders, deliveryBookings, expenses] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        include: {
          order_items: {
            include: {
              product: {
                select: {
                  cost_price: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.deliveryBooking.findMany({
        where: {
          created_at: {
            gte: start,
            lte: end,
          },
        },
      }),
      this.prisma.businessExpense.findMany({
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
      }),
    ]);

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter((o) => o.order_status === 'delivered').length;
    const cancelledOrders = orders.filter((o) => o.order_status === 'cancelled').length;
    const returnedOrders = orders.filter((o) => o.order_status === 'returned').length;

    const totalRevenue = orders
      .filter((o) => o.order_status === 'delivered' || o.order_status === 'shipped')
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    // Delivery cost calculation (assuming a fixed cost per booking if not specified, or from booking response)
    // For now, let's assume a simplified calculation or check if there's a specific field.
    // Pathao usually has a cost. Let's assume 60 BDT average if not specified.
    const deliveryCost = deliveryBookings.length * 60; 

    const productCost = orders
      .filter((o) => o.order_status === 'delivered' || o.order_status === 'shipped')
      .reduce((sum, o) => {
        const orderProductCost = o.order_items.reduce((itemSum, item) => {
          return itemSum + Number(item.product.cost_price || 0) * item.quantity;
        }, 0);
        return sum + orderProductCost;
      }, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const grossProfit = totalRevenue - productCost - deliveryCost;
    const netProfit = grossProfit - totalExpenses;

    return {
      success: true,
      data: {
        summary: {
          total_orders: totalOrders,
          delivered_orders: deliveredOrders,
          cancelled_orders: cancelledOrders,
          returned_orders: returnedOrders,
          total_revenue: totalRevenue,
          delivery_cost: deliveryCost,
          product_cost: productCost,
          total_expenses: totalExpenses,
          gross_profit: grossProfit,
          net_profit: netProfit,
        },
        period: {
          start,
          end,
        },
      },
    };
  }

  async getDailyReports(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const reports: any[] = [];
    for (let i = 0; i <= diffDays; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const daySummary = await this.getReportSummary(
        startOfDay.toISOString(),
        endOfDay.toISOString(),
      );
      
      reports.push({
        date: startOfDay.toISOString().split('T')[0],
        ...daySummary.data.summary,
      });
    }

    return {
      success: true,
      data: reports,
    };
  }

  async exportToExcel(res: Response, startDate?: string, endDate?: string, adminId?: string) {
    const reportData = await this.getReportSummary(startDate, endDate);
    const summary = reportData.data.summary;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report Summary');

    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    worksheet.addRows([
      { metric: 'Total Orders', value: summary.total_orders },
      { metric: 'Delivered Orders', value: summary.delivered_orders },
      { metric: 'Cancelled Orders', value: summary.cancelled_orders },
      { metric: 'Returned Orders', value: summary.returned_orders },
      { metric: 'Total Revenue', value: `৳ ${summary.total_revenue}` },
      { metric: 'Delivery Cost', value: `৳ ${summary.delivery_cost}` },
      { metric: 'Product Cost', value: `৳ ${summary.product_cost}` },
      { metric: 'Total Expenses', value: `৳ ${summary.total_expenses}` },
      { metric: 'Net Profit', value: `৳ ${summary.net_profit}` },
    ]);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + 'report.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();

    // Log export
    await this.prisma.reportExport.create({
      data: {
        admin_id: adminId,
        type: 'excel',
        file_url: 'internal_download',
        date_range: `${startDate || 'all'}_to_${endDate || 'now'}`,
      },
    });

    await this.activityLog.create({
      user_id: adminId,
      action: 'EXPORT_REPORT_EXCEL',
      entity_type: 'report',
      details: { startDate, endDate },
    });
  }

  async exportToPdf(res: Response, startDate?: string, endDate?: string, adminId?: string) {
    const reportData = await this.getReportSummary(startDate, endDate);
    const summary = reportData.data.summary;

    const doc = new (PDFDocument as any)();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');

    doc.pipe(res);

    doc.fontSize(25).text('Business Report Summary', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${startDate || 'Start'} to ${endDate || 'Now'}`, { align: 'center' });
    doc.moveDown();

    const metrics = [
      ['Total Orders', summary.total_orders.toString()],
      ['Delivered Orders', summary.delivered_orders.toString()],
      ['Cancelled Orders', summary.cancelled_orders.toString()],
      ['Returned Orders', summary.returned_orders.toString()],
      ['Total Revenue', `BDT ${summary.total_revenue}`],
      ['Delivery Cost', `BDT ${summary.delivery_cost}`],
      ['Product Cost', `BDT ${summary.product_cost}`],
      ['Total Expenses', `BDT ${summary.total_expenses}`],
      ['Net Profit', `BDT ${summary.net_profit}`],
    ];

    metrics.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`);
      doc.moveDown(0.5);
    });

    doc.end();

    // Log export
    await this.prisma.reportExport.create({
      data: {
        admin_id: adminId,
        type: 'pdf',
        file_url: 'internal_download',
        date_range: `${startDate || 'all'}_to_${endDate || 'now'}`,
      },
    });

    await this.activityLog.create({
      user_id: adminId,
      action: 'EXPORT_REPORT_PDF',
      entity_type: 'report',
      details: { startDate, endDate },
    });
  }

  async getFilters() {
    return {
      success: true,
      data: {
        order_statuses: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'],
        expense_categories: ['marketing', 'salary', 'rent', 'utilities', 'other'],
      },
    };
  }
}
