import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

const DEFAULT_PRICES = {
  c100: 85, c200: 140, c400: 264, o100: 45, o200: 80, o400: 160,
  s100: 15, s200: 30, p50: 15, p100: 30, p200: 60,
  fee_p: 16.5, fee_w: 10, fee_d: 110, rate_usd: 135
};

const ITEM_NAMES: { [key: string]: string } = {
  c100: "100ml Combo", c200: "200ml Combo", c400: "400ml Combo",
  o100: "100ml Oil", o200: "200ml Oil", o400: "400ml Oil",
  s100: "100ml Spray", s200: "200ml Spray",
  p50: "50gm Pack", p100: "100gm Pack", p200: "200gm Pack"
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogsService,
  ) {}

  // -------------------------------------------------------------
  // 1. MASTER PRICES LOGIC
  // -------------------------------------------------------------

  async getManualPrices() {
    const setting = await this.prisma.setting.findUnique({
      where: { key: 'manual_report_prices' }
    });

    if (!setting) {
      // Create defaults
      await this.prisma.setting.create({
        data: {
          key: 'manual_report_prices',
          value: JSON.stringify(DEFAULT_PRICES),
          group: 'general'
        }
      });
      return DEFAULT_PRICES;
    }

    try {
      return JSON.parse(setting.value);
    } catch {
      return DEFAULT_PRICES;
    }
  }

  async saveManualPrices(prices: any, adminId?: string) {
    const pricesToSave = { ...DEFAULT_PRICES, ...prices };
    await this.prisma.setting.upsert({
      where: { key: 'manual_report_prices' },
      update: { value: JSON.stringify(pricesToSave) },
      create: { key: 'manual_report_prices', value: JSON.stringify(pricesToSave), group: 'general' }
    });

    if (adminId) {
      await this.activityLog.create({
        user_id: adminId,
        action: 'UPDATE_MANUAL_PRICES',
        entity_type: 'settings',
        details: { prices: pricesToSave }
      });
    }

    return { success: true, data: pricesToSave };
  }

  // -------------------------------------------------------------
  // 2. MANUAL DAILY ENTRIES LOGIC
  // -------------------------------------------------------------

  async saveManualEntry(data: any, adminId?: string) {
    const prices = await this.getManualPrices();
    const date = new Date(data.date);
    date.setHours(12, 0, 0, 0); // Standardize to noon to avoid timezone shifts

    const saleAmount = Number(data.sale_amount || 0);
    const adDollar = Number(data.ad_dollar || 0);
    const adRate = Number(data.ad_rate || prices.rate_usd || 135);
    const parcelsCount = Number(data.parcels_count || 0);
    const returnsCount = Number(data.returns_count || 0);

    const c100 = Number(data.c100_qty || 0);
    const c200 = Number(data.c200_qty || 0);
    const c400 = Number(data.c400_qty || 0);
    const o100 = Number(data.o100_qty || 0);
    const o200 = Number(data.o200_qty || 0);
    const o400 = Number(data.o400_qty || 0);
    const s100 = Number(data.s100_qty || 0);
    const s200 = Number(data.s200_qty || 0);
    const p50 = Number(data.p50_qty || 0);
    const p100 = Number(data.p100_qty || 0);
    const p200 = Number(data.p200_qty || 0);

    const customName = data.custom_item_name || null;
    const customQty = Number(data.custom_item_qty || 0);
    const customCost = Number(data.custom_item_cost || 0);

    // Calculate dynamic cost price
    let prodCost = 0;
    prodCost += c100 * (prices.c100 || 85);
    prodCost += c200 * (prices.c200 || 140);
    prodCost += c400 * (prices.c400 || 264);
    prodCost += o100 * (prices.o100 || 45);
    prodCost += o200 * (prices.o200 || 80);
    prodCost += o400 * (prices.o400 || 160);
    prodCost += s100 * (prices.s100 || 15);
    prodCost += s200 * (prices.s200 || 30);
    prodCost += p50 * (prices.p50 || 15);
    prodCost += p100 * (prices.p100 || 30);
    prodCost += p200 * (prices.p200 || 60);
    prodCost += customQty * customCost;

    const adTaka = adDollar * adRate;
    const packagingCost = parcelsCount * (Number(prices.fee_p || 16.5) + Number(prices.fee_w || 10));
    const totalProdCost = prodCost + packagingCost;

    const totalDel = parcelsCount * Number(prices.fee_d || 110);
    const retLoss = returnsCount * Number(prices.fee_d || 110);

    const totalExpenses = totalProdCost + totalDel + adTaka + retLoss;
    const netProfit = saleAmount - totalExpenses;

    const entry = await this.prisma.manualLedgerEntry.upsert({
      where: { date },
      update: {
        sale_amount: saleAmount,
        ad_dollar: adDollar,
        ad_rate: adRate,
        parcels_count: parcelsCount,
        returns_count: returnsCount,
        c100_qty: c100,
        c200_qty: c200,
        c400_qty: c400,
        o100_qty: o100,
        o200_qty: o200,
        o400_qty: o400,
        s100_qty: s100,
        s200_qty: s200,
        p50_qty: p50,
        p100_qty: p100,
        p200_qty: p200,
        custom_item_name: customName,
        custom_item_qty: customQty,
        custom_item_cost: customCost,
        total_prod_cost: totalProdCost,
        total_expenses: totalExpenses,
        net_profit: netProfit
      },
      create: {
        date,
        sale_amount: saleAmount,
        ad_dollar: adDollar,
        ad_rate: adRate,
        parcels_count: parcelsCount,
        returns_count: returnsCount,
        c100_qty: c100,
        c200_qty: c200,
        c400_qty: c400,
        o100_qty: o100,
        o200_qty: o200,
        o400_qty: o400,
        s100_qty: s100,
        s200_qty: s200,
        p50_qty: p50,
        p100_qty: p100,
        p200_qty: p200,
        custom_item_name: customName,
        custom_item_qty: customQty,
        custom_item_cost: customCost,
        total_prod_cost: totalProdCost,
        total_expenses: totalExpenses,
        net_profit: netProfit
      }
    });

    if (adminId) {
      await this.activityLog.create({
        user_id: adminId,
        action: 'SAVE_MANUAL_ENTRY',
        entity_type: 'manual_report',
        details: { date: date.toISOString().split('T')[0], saleAmount }
      });
    }

    return { success: true, data: entry };
  }

  async getManualEntries(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const data = await this.prisma.manualLedgerEntry.findMany({
      where: {
        date: { gte: start, lte: end }
      },
      orderBy: { date: 'desc' }
    });

    return { success: true, data };
  }

  async deleteManualEntry(id: string, adminId?: string) {
    const entry = await this.prisma.manualLedgerEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found');

    await this.prisma.manualLedgerEntry.delete({ where: { id } });

    if (adminId) {
      await this.activityLog.create({
        user_id: adminId,
        action: 'DELETE_MANUAL_ENTRY',
        entity_type: 'manual_report',
        details: { date: entry.date.toISOString().split('T')[0] }
      });
    }

    return { success: true, message: 'Deleted successfully' };
  }

  // -------------------------------------------------------------
  // 3. MULTI-VIEW REPORT SYSTEM & BUSINESS SUMMARY
  // -------------------------------------------------------------

  async getReportSummary(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const whereClause = {
      created_at: { gte: start, lte: end },
      deleted_at: null,
    };

    const [orders, deliveryBookings, expenses] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        include: {
          order_items: {
            include: {
              product: { select: { cost_price: true } }
            }
          }
        }
      }),
      this.prisma.deliveryBooking.findMany({
        where: { created_at: { gte: start, lte: end } }
      }),
      this.prisma.businessExpense.findMany({
        where: { date: { gte: start, lte: end } }
      })
    ]);

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.order_status === 'delivered').length;
    const cancelledOrders = orders.filter(o => o.order_status === 'cancelled').length;
    const returnedOrders = orders.filter(o => o.order_status === 'returned').length;

    const totalRevenue = orders
      .filter(o => o.order_status === 'delivered' || o.order_status === 'shipped')
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const deliveryCost = deliveryBookings.length * 60; // Standard 60 BDT cost per courier packaging book

    const productCost = orders
      .filter(o => o.order_status === 'delivered' || o.order_status === 'shipped')
      .reduce((sum, o) => {
        return sum + o.order_items.reduce((itemSum, item) => {
          return itemSum + (Number(item.product.cost_price || 0) * item.quantity);
        }, 0);
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
          net_profit: netProfit
        },
        period: { start, end }
      }
    };
  }

  async getDailyReports(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

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

    return { success: true, data: reports };
  }

  // -------------------------------------------------------------
  // MULTI-VIEW REPORT SYSTEM CORE ENDPOINT
  // -------------------------------------------------------------
  async getMultiViewReports(view: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const formattedStart = start.toISOString().split('T')[0];
    const formattedEnd = end.toISOString().split('T')[0];

    // 1. Fetch website order summary & daily list
    const [webSummaryRes, webDailyRes] = await Promise.all([
      this.getReportSummary(formattedStart, formattedEnd),
      this.getDailyReports(formattedStart, formattedEnd)
    ]);
    const websiteSummary = webSummaryRes.data.summary;
    const websiteDaily = webDailyRes.data;

    // 2. Fetch manual entry logs
    const manualEntriesRes = await this.getManualEntries(formattedStart, formattedEnd);
    const manualDaily = manualEntriesRes.data;

    // 3. Compute manual summary
    const manualSummary = {
      total_sales: 0,
      total_ads_usd: 0,
      total_ads_bdt: 0,
      total_parcels: 0,
      total_returns: 0,
      total_prod_cost: 0,
      total_expenses: 0,
      net_profit: 0,
      c100_qty: 0, c200_qty: 0, c400_qty: 0,
      o100_qty: 0, o200_qty: 0, o400_qty: 0,
      s100_qty: 0, s200_qty: 0,
      p50_qty: 0, p100_qty: 0, p200_qty: 0,
      custom_qty: 0
    };

    manualDaily.forEach((entry: any) => {
      manualSummary.total_sales += Number(entry.sale_amount);
      manualSummary.total_ads_usd += Number(entry.ad_dollar);
      manualSummary.total_ads_bdt += Number(entry.ad_dollar) * Number(entry.ad_rate);
      manualSummary.total_parcels += entry.parcels_count;
      manualSummary.total_returns += entry.returns_count;
      manualSummary.total_prod_cost += Number(entry.total_prod_cost);
      manualSummary.total_expenses += Number(entry.total_expenses);
      manualSummary.net_profit += Number(entry.net_profit);

      manualSummary.c100_qty += entry.c100_qty;
      manualSummary.c200_qty += entry.c200_qty;
      manualSummary.c400_qty += entry.c400_qty;
      manualSummary.o100_qty += entry.o100_qty;
      manualSummary.o200_qty += entry.o200_qty;
      manualSummary.o400_qty += entry.o400_qty;
      manualSummary.s100_qty += entry.s100_qty;
      manualSummary.s200_qty += entry.s200_qty;
      manualSummary.p50_qty += entry.p50_qty;
      manualSummary.p100_qty += entry.p100_qty;
      manualSummary.p200_qty += entry.p200_qty;
      manualSummary.custom_qty += entry.custom_item_qty;
    });

    if (view === 'website') {
      return {
        summary: websiteSummary,
        daily: websiteDaily
      };
    }

    if (view === 'manual') {
      return {
        summary: manualSummary,
        daily: manualDaily
      };
    }

    if (view === 'pathao') {
      // 4. Calculate Pathao metrics
      // Query bookings join with orders where courier_name = 'pathao'
      const pathaoBookings = await this.prisma.deliveryBooking.findMany({
        where: {
          courier_name: 'pathao',
          created_at: { gte: start, lte: end }
        },
        include: {
          order: true
        }
      });

      const totalBooked = pathaoBookings.length;
      const successDeliveries = pathaoBookings.filter(b => b.delivery_status === 'delivered' || b.order.order_status === 'delivered');
      const returnedBookings = pathaoBookings.filter(b => b.delivery_status === 'returned' || b.order.order_status === 'returned');

      const totalCollected = successDeliveries.reduce((sum, b) => sum + Number(b.order.total_amount || 0), 0);
      // Pathao Packaging costs (using 110 fee_d standard, or booking_response delivery charge if available)
      const deliveryFee = totalBooked * 110;
      const returnPenalty = returnedBookings.length * 60; // 60 BDT returned parcels delivery loss
      const netPayout = totalCollected - deliveryFee - returnPenalty;

      return {
        summary: {
          total_bookings: totalBooked,
          success_deliveries: successDeliveries.length,
          returned_deliveries: returnedBookings.length,
          success_rate: totalBooked > 0 ? Math.round((successDeliveries.length / totalBooked) * 100) : 0,
          total_collected: totalCollected,
          delivery_fees: deliveryFee,
          return_losses: returnPenalty,
          net_payout: netPayout
        },
        bookings: pathaoBookings.map(b => ({
          consignment_id: b.consignment_id || b.tracking_id || 'Pending',
          order_number: b.order.order_number,
          customer_name: b.order.customer_name || 'Guest Customer',
          customer_phone: b.order.customer_phone || '-',
          amount: Number(b.order.total_amount || 0),
          status: b.delivery_status,
          date: b.created_at.toISOString().split('T')[0]
        }))
      };
    }

    if (view === 'reconciliation') {
      // 5. Compute Website vs Manual Reconciliation
      const dailyMap: { [key: string]: any } = {};

      websiteDaily.forEach(day => {
        const date = day.date;
        dailyMap[date] = {
          date,
          website_revenue: day.total_revenue,
          website_orders: day.total_orders,
          manual_revenue: 0,
          manual_parcels: 0,
          revenue_diff: -day.total_revenue,
          parcels_diff: -day.total_orders,
          status: 'Discrepancy'
        };
      });

      manualDaily.forEach(entry => {
        const date = entry.date.toISOString().split('T')[0];
        if (!dailyMap[date]) {
          dailyMap[date] = {
            date,
            website_revenue: 0,
            website_orders: 0,
            manual_revenue: Number(entry.sale_amount),
            manual_parcels: entry.parcels_count,
            revenue_diff: Number(entry.sale_amount),
            parcels_diff: entry.parcels_count,
            status: 'Discrepancy'
          };
        } else {
          dailyMap[date].manual_revenue = Number(entry.sale_amount);
          dailyMap[date].manual_parcels = entry.parcels_count;
          dailyMap[date].revenue_diff = Number(entry.sale_amount) - dailyMap[date].website_revenue;
          dailyMap[date].parcels_diff = entry.parcels_count - dailyMap[date].website_orders;
        }

        const revMatch = Math.abs(dailyMap[date].revenue_diff) < 1; // within 1 BDT
        const orderMatch = dailyMap[date].parcels_diff === 0;

        dailyMap[date].status = (revMatch && orderMatch) ? 'Reconciled' : 'Discrepancy';
      });

      const auditLogs = Object.values(dailyMap).sort((a: any, b: any) => b.date.localeCompare(a.date));

      return {
        summary: {
          total_days: auditLogs.length,
          reconciled_days: auditLogs.filter((a: any) => a.status === 'Reconciled').length,
          discrepancy_days: auditLogs.filter((a: any) => a.status === 'Discrepancy').length
        },
        logs: auditLogs
      };
    }

    // Default: view === 'combined'
    const totalCombinedRevenue = websiteSummary.total_revenue + manualSummary.total_sales;
    const totalCombinedAds = manualSummary.total_ads_bdt + websiteSummary.total_expenses; // Web business expenses count as advertising/ad spend mostly
    const totalCombinedExpenses = websiteSummary.product_cost + manualSummary.total_prod_cost + websiteSummary.delivery_cost + manualSummary.total_expenses;
    const combinedNetProfit = totalCombinedRevenue - totalCombinedAds - totalCombinedExpenses;

    // Combine day logs
    const dayMap: { [key: string]: any } = {};
    websiteDaily.forEach(day => {
      dayMap[day.date] = {
        date: day.date,
        web_sales: day.total_revenue,
        manual_sales: 0,
        combined_sales: day.total_revenue,
        web_profit: day.net_profit,
        manual_profit: 0,
        combined_profit: day.net_profit
      };
    });

    manualDaily.forEach(entry => {
      const date = entry.date.toISOString().split('T')[0];
      if (!dayMap[date]) {
        dayMap[date] = {
          date,
          web_sales: 0,
          manual_sales: Number(entry.sale_amount),
          combined_sales: Number(entry.sale_amount),
          web_profit: 0,
          manual_profit: Number(entry.net_profit),
          combined_profit: Number(entry.net_profit)
        };
      } else {
        dayMap[date].manual_sales = Number(entry.sale_amount);
        dayMap[date].combined_sales += Number(entry.sale_amount);
        dayMap[date].manual_profit = Number(entry.net_profit);
        dayMap[date].combined_profit += Number(entry.net_profit);
      }
    });

    const combinedDaily = Object.values(dayMap).sort((a: any, b: any) => b.date.localeCompare(a.date));

    return {
      summary: {
        combined_revenue: totalCombinedRevenue,
        combined_ads: totalCombinedAds,
        combined_orders: websiteSummary.total_orders + manualSummary.total_parcels,
        combined_profit: combinedNetProfit,
        web_revenue: websiteSummary.total_revenue,
        manual_revenue: manualSummary.total_sales
      },
      daily: combinedDaily
    };
  }

  // -------------------------------------------------------------
  // 4. ADVANCED EXPORT SYSTEMS (EXCEL & PDF COMPLIANCE)
  // -------------------------------------------------------------

  async exportToExcel(res: Response, startDate?: string, endDate?: string, adminId?: string, view = 'combined') {
    const reportData = (await this.getMultiViewReports(view, startDate, endDate)) as any;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${view.toUpperCase()} Report`);

    if (view === 'website') {
      const summary = reportData.summary;
      worksheet.columns = [
        { header: 'Website Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 25 },
      ];
      worksheet.addRows([
        { metric: 'Total Orders', value: summary.total_orders },
        { metric: 'Delivered Orders', value: summary.delivered_orders },
        { metric: 'Returned Orders', value: summary.returned_orders },
        { metric: 'Gross Revenue', value: `৳ ${summary.total_revenue}` },
        { metric: 'Delivery Charges', value: `৳ ${summary.delivery_cost}` },
        { metric: 'Dynamic Product Cost', value: `৳ ${summary.product_cost}` },
        { metric: 'Net Profit Estimate', value: `৳ ${summary.net_profit}` },
      ]);
    } else if (view === 'manual') {
      const summary = reportData.summary;
      worksheet.columns = [
        { header: 'Manual Ledger Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 25 },
      ];
      worksheet.addRows([
        { metric: 'Total Sales Entered', value: `৳ ${summary.total_sales}` },
        { metric: 'Ad Cost (USD)', value: `$${summary.total_ads_usd}` },
        { metric: 'Ad Cost (BDT)', value: `৳ ${summary.total_ads_bdt}` },
        { metric: 'Parcels Packaging Fee', value: `৳ ${summary.total_prod_cost}` },
        { metric: 'Estimated Handled Profit', value: `৳ ${summary.net_profit}` },
      ]);
    } else if (view === 'pathao') {
      const summary = reportData.summary;
      worksheet.columns = [
        { header: 'Pathao success Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 25 },
      ];
      worksheet.addRows([
        { metric: 'Total Bookings', value: summary.total_bookings },
        { metric: 'Successful Deliveries', value: summary.success_deliveries },
        { metric: 'Returned Shipments', value: summary.returned_deliveries },
        { metric: 'Success Rate (%)', value: `${summary.success_rate}%` },
        { metric: 'Total COD Collected', value: `৳ ${summary.total_collected}` },
        { metric: 'Courier Delivery Fees', value: `৳ ${summary.delivery_fees}` },
        { metric: 'Returned Penalty Loss', value: `৳ ${summary.return_losses}` },
        { metric: 'Fulfillment Net Payout', value: `৳ ${summary.net_payout}` },
      ]);
    } else if (view === 'reconciliation') {
      const summary = reportData.summary;
      worksheet.columns = [
        { header: 'Audit Summary Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 25 },
      ];
      worksheet.addRows([
        { metric: 'Total Audited Days', value: summary.total_days },
        { metric: 'Fully Reconciled Days', value: summary.reconciled_days },
        { metric: 'Discrepancy Flag Days', value: summary.discrepancy_days },
      ]);
    } else {
      // Combined
      const summary = reportData.summary;
      worksheet.columns = [
        { header: 'Combined BI Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 25 },
      ];
      worksheet.addRows([
        { metric: 'Unified Business Sales', value: `৳ ${summary.combined_revenue}` },
        { metric: 'Combined Ad Spend', value: `৳ ${summary.combined_ads}` },
        { metric: 'Total Handled Orders', value: summary.combined_orders },
        { metric: 'Consolidated Net Profit', value: `৳ ${summary.combined_profit}` },
        { metric: 'Website Checkout Portion', value: `৳ ${summary.web_revenue}` },
        { metric: 'Manual Entries Portion', value: `৳ ${summary.manual_revenue}` },
      ]);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mohul_${view}_report.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

    if (adminId) {
      await this.prisma.reportExport.create({
        data: {
          admin_id: adminId,
          type: `excel_${view}`,
          file_url: 'internal_download',
          date_range: `${startDate || 'all'}_to_${endDate || 'now'}`
        }
      });
      await this.activityLog.create({
        user_id: adminId,
        action: 'EXPORT_REPORT_EXCEL',
        entity_type: 'report',
        details: { view, startDate, endDate }
      });
    }
  }

  async exportToPdf(res: Response, startDate?: string, endDate?: string, adminId?: string, view = 'combined') {
    const reportData = (await this.getMultiViewReports(view, startDate, endDate)) as any;
    const doc = new (PDFDocument as any)();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=mohul_${view}_report.pdf`);
    doc.pipe(res);

    // PDF Stylings
    doc.fontSize(22).fillColor('#146C4A').text('Mohul BI Financial Ledger', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor('#6B7280').text(`View Channel: ${view.toUpperCase()}`, { align: 'center' });
    doc.fontSize(10).fillColor('#9CA3AF').text(`Reporting Dates: ${startDate || 'Start'} to ${endDate || 'Now'}`, { align: 'center' });
    doc.moveDown(2);

    let metrics: string[][] = [];

    if (view === 'website') {
      const summary = reportData.summary;
      metrics = [
        ['Total Orders', summary.total_orders.toString()],
        ['Delivered Orders', summary.delivered_orders.toString()],
        ['Returned Orders', summary.returned_orders.toString()],
        ['Gross Revenue (BDT)', `BDT ${summary.total_revenue}`],
        ['Courier Packaging BDT', `BDT ${summary.delivery_cost}`],
        ['Dynamic Product Cost', `BDT ${summary.product_cost}`],
        ['Net Profit Margin', `BDT ${summary.net_profit}`],
      ];
    } else if (view === 'manual') {
      const summary = reportData.summary;
      metrics = [
        ['Total Manual Sales', `BDT ${summary.total_sales}`],
        ['Ad Cost (USD)', `$${summary.total_ads_usd}`],
        ['Ad Cost (BDT)', `BDT ${summary.total_ads_bdt}`],
        ['Parcels Packaging Fee', `BDT ${summary.total_prod_cost}`],
        ['Estimated Handled Profit', `BDT ${summary.net_profit}`],
      ];
    } else if (view === 'pathao') {
      const summary = reportData.summary;
      metrics = [
        ['Total Bookings Count', summary.total_bookings.toString()],
        ['Successful Deliveries', summary.success_deliveries.toString()],
        ['Returned Shipments', summary.returned_deliveries.toString()],
        ['Fulfillment rate (%)', `${summary.success_rate}%`],
        ['COD Cash Collected', `BDT ${summary.total_collected}`],
        ['Courier Booking Cost', `BDT ${summary.delivery_fees}`],
        ['Returned Penalty Loss', `BDT ${summary.return_losses}`],
        ['Net Courier Payout', `BDT ${summary.net_payout}`],
      ];
    } else if (view === 'reconciliation') {
      const summary = reportData.summary;
      metrics = [
        ['Total Audited Days', summary.total_days.toString()],
        ['Fully Reconciled Days', summary.reconciled_days.toString()],
        ['Discrepancy Flag Days', summary.discrepancy_days.toString()],
      ];
    } else {
      const summary = reportData.summary;
      metrics = [
        ['Unified Business Sales', `BDT ${summary.combined_revenue}`],
        ['Combined Ad Spend', `BDT ${summary.combined_ads}`],
        ['Total Handled Orders', summary.combined_orders.toString()],
        ['Consolidated Net Profit', `BDT ${summary.combined_profit}`],
        ['Website portion Sales', `BDT ${summary.web_revenue}`],
        ['Manual portion Sales', `BDT ${summary.manual_revenue}`],
      ];
    }

    metrics.forEach(([label, value]) => {
      doc.fontSize(11).fillColor('#374151').text(`${label}: `, { continued: true });
      doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text(value);
      doc.moveDown(0.6);
      doc.font('Helvetica');
    });

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#9CA3AF').text('Generated automatically by Mohul Business Intelligence platform.', { align: 'center' });
    doc.end();

    if (adminId) {
      await this.prisma.reportExport.create({
        data: {
          admin_id: adminId,
          type: `pdf_${view}`,
          file_url: 'internal_download',
          date_range: `${startDate || 'all'}_to_${endDate || 'now'}`
        }
      });
      await this.activityLog.create({
        user_id: adminId,
        action: 'EXPORT_REPORT_PDF',
        entity_type: 'report',
        details: { view, startDate, endDate }
      });
    }
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
