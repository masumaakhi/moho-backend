import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogsService,
  ) {}

  async getCustomers(query: any) {
    const { 
      search, 
      status, 
      repeat_only, 
      account_type, 
      source_type, 
      page = 1, 
      limit = 10 
    } = query;

    const skip = (page - 1) * limit;
    const take = Number(limit);

    const where: any = {
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (account_type) {
      where.user = { account_type: account_type };
    }

    if (source_type) {
      where.source_type = source_type;
    }

    if (repeat_only === 'true') {
      where.total_orders = { gt: 1 };
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          user: {
            select: {
              account_type: true,
              status: true,
              last_login_at: true,
              created_at: true,
            }
          },
        },
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items,
        meta: {
          total,
          page: Number(page),
          last_page: Math.ceil(total / limit),
        },
      },
    };
  }

  async getCustomerById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: true,
        notes: {
          orderBy: { created_at: 'desc' }
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Get primary address
    const address = await this.prisma.customerAddress.findFirst({
      where: { customer_id: id, is_default: true }
    });

    return {
      success: true,
      data: {
        ...customer,
        primary_address: address,
      },
    };
  }

  async getCustomerOrders(id: string) {
    const orders = await this.prisma.order.findMany({
      where: { customer_id: id },
      orderBy: { created_at: 'desc' },
      include: {
        order_items: true,
      }
    });

    return {
      success: true,
      data: orders,
    };
  }

  async getCustomerRiskProfile(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            phone: true,
          }
        }
      }
    });

    if (!customer) throw new NotFoundException('Customer not found');

    // Risk factors:
    // 1. Cancelled orders count
    // 2. Returned orders count
    // 3. Blacklist match
    // 4. Duplicate order attempts

    const cancelledCount = await this.prisma.order.count({
      where: { customer_id: id, order_status: 'cancelled' }
    });

    const returnedCount = await this.prisma.order.count({
      where: { customer_id: id, order_status: 'returned' }
    });

    const blacklistMatch = customer.user.phone ? await this.prisma.fraudBlacklistNumber.findUnique({
      where: { phone: customer.user.phone }
    }) : null;

    const duplicateAttempts = await this.prisma.duplicateOrderMatch.count({
      where: { OR: [{ new_order_id: id }, { old_order_id: id }] } // This logic depends on how you store order IDs in duplicates
    });

    // Mock risk score calculation
    let riskScore = 0;
    if (cancelledCount > 2) riskScore += 20;
    if (returnedCount > 1) riskScore += 30;
    if (blacklistMatch) riskScore += 100;
    if (duplicateAttempts > 0) riskScore += 15;

    return {
      success: true,
      data: {
        risk_score: Math.min(riskScore, 100),
        cancelled_orders: cancelledCount,
        returned_orders: returnedCount,
        is_blacklisted: !!blacklistMatch,
        blacklist_reason: blacklistMatch?.reason,
        duplicate_matches: duplicateAttempts,
      },
    };
  }

  async addNote(id: string, adminId: string, note: string) {
    if (!note) throw new BadRequestException('Note content is required');

    const customerNote = await this.prisma.customerNote.create({
      data: {
        customer_id: id,
        admin_id: adminId,
        note,
      },
    });

    await this.activityLog.create({
      user_id: adminId,
      action: 'ADD_CUSTOMER_NOTE',
      entity_type: 'customer',
      entity_id: id,
      details: { note_id: customerNote.id },
    });

    return {
      success: true,
      data: customerNote,
    };
  }

  async toggleWatchlist(id: string, adminId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    const updated = await this.prisma.customer.update({
      where: { id },
      data: { is_watchlisted: !customer.is_watchlisted },
    });

    await this.activityLog.create({
      user_id: adminId,
      action: updated.is_watchlisted ? 'WATCHLIST_ADD' : 'WATCHLIST_REMOVE',
      entity_type: 'customer',
      entity_id: id,
    });

    return {
      success: true,
      data: updated,
    };
  }

  async toggleBlock(id: string, adminId: string) {
    const customer = await this.prisma.customer.findUnique({ 
      where: { id },
      include: { user: true }
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const isBlocking = !customer.is_blocked;

    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id },
        data: { is_blocked: isBlocking, status: isBlocking ? 'blocked' : 'active' },
      }),
      this.prisma.user.update({
        where: { id: customer.user_id },
        data: { status: isBlocking ? 'blocked' : 'active' },
      }),
    ]);

    await this.activityLog.create({
      user_id: adminId,
      action: isBlocking ? 'BLOCK_CUSTOMER' : 'UNBLOCK_CUSTOMER',
      entity_type: 'customer',
      entity_id: id,
    });

    return {
      success: true,
      message: isBlocking ? 'Customer blocked successfully' : 'Customer unblocked successfully',
    };
  }

  async exportCustomers(res: any, adminUserId: string) {
    const customers = await this.prisma.customer.findMany({
      include: {
        user: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 40 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Orders', key: 'total_orders', width: 10 },
      { header: 'Spend', key: 'total_spend', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 },
    ];

    customers.forEach(c => {
      worksheet.addRow({
        id: c.id,
        name: c.name,
        email: c.user?.email,
        phone: c.phone,
        total_orders: c.total_orders,
        total_spend: Number(c.total_spend),
        status: c.status,
        created_at: c.created_at.toISOString(),
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.xlsx');

    await workbook.xlsx.write(res);
    res.end();

    await this.activityLog.create({
      user_id: adminUserId,
      action: 'EXPORT_CUSTOMERS',
      entity_type: 'customer',
      details: { count: customers.length },
    });
  }
}
