import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PlaceOrderDto } from './dto/order.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { FraudService } from '../fraud/fraud.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notifications: NotificationsService,
    private activityLogs: ActivityLogsService,
    private fraudService: FraudService,
  ) {}

  private extractUserId(authHeader?: string): string | null {
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'access_secret',
      });
      return decoded.sub;
    } catch {
      return null;
    }
  }

  private async validateCoupon(code: string, subtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }
    if (!coupon.is_active) {
      throw new BadRequestException('Coupon is inactive');
    }
    if (coupon.expiry_date && new Date() > new Date(coupon.expiry_date)) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (subtotal < Number(coupon.min_order_amount)) {
      throw new BadRequestException(
        `Minimum order amount of ৳${coupon.min_order_amount} not met for this coupon`,
      );
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = subtotal * (Number(coupon.discount_value) / 100);
      if (coupon.max_discount_amount) {
        discount = Math.min(discount, Number(coupon.max_discount_amount));
      }
    } else if (coupon.discount_type === 'flat') {
      discount = Number(coupon.discount_value);
    }

    return Math.min(discount, subtotal);
  }

  async checkoutSummary(
    sessionId: string,
    authHeader: string,
    zone?: string,
    couponCode?: string,
  ) {
    const userId = this.extractUserId(authHeader);

    if (!userId && !sessionId) throw new BadRequestException('Cart is empty');

    const cart = await this.prisma.cart.findFirst({
      where: {
        status: 'active',
        OR: [
          ...(userId ? [{ user_id: userId }] : []),
          ...(sessionId ? [{ session_id: sessionId }] : []),
        ],
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const subtotal = cart.items.reduce(
      (acc, item) => acc + Number(item.price) * item.quantity,
      0,
    );

    // Calculate delivery charge
    let delivery_charge = 0;
    const hasFreeDeliveryProduct = cart.items.some(
      (item) => (item as any).product?.is_free_delivery,
    );
    if (!hasFreeDeliveryProduct) {
      if (zone === 'inside_dhaka') delivery_charge = 80;
      else if (zone === 'outside_dhaka') delivery_charge = 120;
      else delivery_charge = 80; // Default
    }

    let discount = 0;
    if (couponCode) {
      discount = await this.validateCoupon(couponCode, subtotal);
    }

    const total_amount = subtotal + delivery_charge - discount;

    return {
      subtotal,
      delivery_charge,
      discount,
      total_amount,
    };
  }

  async placeOrder(sessionId: string, authHeader: string, dto: PlaceOrderDto) {
    const userId = this.extractUserId(authHeader);

    if (!userId && !sessionId) throw new BadRequestException('Cart is empty');

    const cart = await this.prisma.cart.findFirst({
      where: {
        status: 'active',
        OR: [
          ...(userId ? [{ user_id: userId }] : []),
          ...(sessionId ? [{ session_id: sessionId }] : []),
        ],
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Re-check stock
    for (const item of cart.items) {
      const available = item.variant
        ? item.variant.stock
        : item.product.stock_quantity;
      if (available < item.quantity) {
        throw new BadRequestException(
          `Product ${item.product.name} is out of stock`,
        );
      }
    }

    const summary = await this.checkoutSummary(
      sessionId,
      authHeader,
      dto.zone,
      dto.coupon_code,
    );

    let finalUserId: string | null = userId;
    let customerId: string | null = null;
    let autoAccountCreated = false;
    let existingAccountUsed = false;
    let accountType = 'normal';
    let accountMessage = '';
    let setPasswordAvailable = false;

    // Guest checkout logic
    if (!userId) {
      const searchEmailOrPhone: any[] = [];
      if (dto.customer_email)
        searchEmailOrPhone.push({ email: dto.customer_email });
      if (dto.customer_phone)
        searchEmailOrPhone.push({ phone: dto.customer_phone });

      if (searchEmailOrPhone.length > 0) {
        const existingUser = await this.prisma.user.findFirst({
          where: { OR: searchEmailOrPhone },
          include: { customer: true },
        });

        if (existingUser) {
          finalUserId = existingUser.id;
          if (existingUser.customer) {
            customerId = existingUser.customer.id;
          }
          existingAccountUsed = true;
          accountMessage = 'This order is linked with your existing account';
        } else {
          // Auto create account
          const newUser = await this.prisma.user.create({
            data: {
              name: dto.customer_name,
              phone: dto.customer_phone,
              email: dto.customer_email || undefined,
              account_type: 'guest_auto',
              is_password_set: false,
            },
          });
          finalUserId = newUser.id;
          autoAccountCreated = true;
          accountType = 'guest_auto';
          setPasswordAvailable = true;
          accountMessage =
            'Your account has been created using your phone number';

          const newCustomer = await this.prisma.customer.create({
            data: {
              user_id: newUser.id,
              name: dto.customer_name,
              phone: dto.customer_phone,
              email: dto.customer_email || undefined,
              address: dto.shipping_address,
              source_type: 'guest_checkout',
            },
          });
          customerId = newCustomer.id;
        }
      }
    } else {
      // Logged in user, get customer
      const existingCustomer = await this.prisma.customer.findUnique({
        where: { user_id: userId },
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const newCustomer = await this.prisma.customer.create({
          data: {
            user_id: userId,
            name: dto.customer_name,
            phone: dto.customer_phone,
            email: dto.customer_email || undefined,
            address: dto.shipping_address,
            source_type: 'logged_in_checkout',
          },
        });
        customerId = newCustomer.id;
      }
    }

    const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

    // Create Order
    const order = await this.prisma.order.create({
      data: {
        order_number: orderNumber,
        user_id: finalUserId,
        customer_id: customerId,
        customer_name: dto.customer_name,
        customer_phone: dto.customer_phone,
        customer_email: dto.customer_email,
        shipping_address: dto.shipping_address,
        payment_method: dto.payment_method || 'cod',
        subtotal: summary.subtotal,
        delivery_charge: summary.delivery_charge,
        discount_amount: summary.discount,
        coupon_code: dto.coupon_code ? dto.coupon_code.toUpperCase() : null,
        total_amount: summary.total_amount,
        is_guest_order: !userId,
        auto_account_created: autoAccountCreated,
        account_created_user_id: autoAccountCreated ? finalUserId : null,
        order_source_type: !userId ? 'guest_checkout' : 'logged_in_checkout',
        order_status: 'pending', // Default to pending, fraud check will update if needed
      },
    });

    if (autoAccountCreated && finalUserId) {
      await this.prisma.user.update({
        where: { id: finalUserId },
        data: { auto_created_from_order_id: order.id },
      });
    }

    // Create Order Items & Deduct Stock
    for (const item of cart.items) {
      await this.prisma.orderItem.create({
        data: {
          order_id: order.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product.name,
          variant_name: item.variant ? item.variant.name : null,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: Number(item.price) * item.quantity,
        },
      });

      // Deduct stock
      if (item.variant_id) {
        await this.prisma.productVariant.update({
          where: { id: item.variant_id },
          data: { stock: { decrement: item.quantity } },
        });
      } else {
        await this.prisma.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: { decrement: item.quantity } },
        });
      }
    }

    // Increment coupon usage globally
    if (dto.coupon_code) {
      await this.prisma.coupon.update({
        where: { code: dto.coupon_code.toUpperCase() },
        data: { used_count: { increment: 1 } },
      });
    }

    // Comprehensive Fraud & Duplicate Check
    const fraudResult = await this.fraudService.checkFraudAndDuplicates(
      order.id,
      dto.customer_phone,
      dto.shipping_address,
      cart.items,
    );

    const isSuspicious = fraudResult.fraudScore >= 30;

    // Update Customer stats
    if (customerId) {
      await this.syncCustomerStats(this.prisma, customerId);
    }

    // Update cart
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { status: 'ordered' },
    });

    // Notifications
    await this.notifications.create({
      type: isSuspicious ? 'fraud-alert' : 'new-order',
      title: isSuspicious
        ? `Suspicious Order ${orderNumber}`
        : `New Order ${orderNumber}`,
      message: `Order placed by ${dto.customer_name} for ৳${summary.total_amount}`,
    });

    // Activity log
    await this.activityLogs.create({
      actor_type: !userId ? 'customer' : 'customer', // Both are customers in this context
      user_id: finalUserId,
      module_name: 'order',
      action: 'order_placed',
      entity_type: 'order',
      entity_id: order.id,
      description: `Order ${orderNumber} placed by ${dto.customer_name}`,
      details: { order_number: orderNumber, total: summary.total_amount },
    });

    return {
      order_id: order.id,
      order_number: order.order_number,
      account_created: autoAccountCreated,
      existing_account_used: existingAccountUsed,
      account_type: accountType,
      account_message: accountMessage,
      set_password_available: setPasswordAvailable,
    };
  }

  async getOrderSuccess(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { order_items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const orderCount = await this.prisma.order.count({
      where: { customer_phone: order.customer_phone },
    });

    return {
      order_number: order.order_number,
      customer_name: order.customer_name,
      items: order.order_items,
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      coupon_code: order.coupon_code,
      total_amount: order.total_amount,
      delivery_charge: order.delivery_charge,
      shipping_address: order.shipping_address,
      auto_account_created: order.auto_account_created,
      account_created_user_id: order.account_created_user_id,
      order_count: orderCount,
    };
  }

  async trackOrder(query: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ order_number: query }, { customer_phone: query }],
      },
      include: {
        status_history: {
          orderBy: { created_at: 'desc' },
        },
        order_items: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrders(authHeader?: string) {
    const userId = this.extractUserId(authHeader);
    if (!userId) throw new BadRequestException('Unauthorized');

    return this.prisma.order.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: { order_items: true },
    });
  }

  // Admin Methods

  async getAdminOrders(filters: any) {
    const {
      search,
      status,
      source,
      guest_only,
      start_date,
      end_date,
      page = 1,
      limit = 10,
    } = filters;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deleted_at: null };

    if (search) {
      where.OR = [
        { order_number: { contains: search, mode: 'insensitive' } },
        { customer_phone: { contains: search, mode: 'insensitive' } },
        { customer_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.order_status = status;
    if (source) where.order_source_type = source;
    if (guest_only === 'true') where.is_guest_order = true;

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { name: true, phone: true, account_type: true } },
          customer: { select: { source_type: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        last_page: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getAdminOrderDetails(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        order_items: { include: { product: true } },
        status_history: { orderBy: { created_at: 'desc' } },
        user: true,
        customer: true,
        payments: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrder(adminId: string, id: string, dto: any) {
    const order = await this.prisma.order.update({
      where: { id },
      data: dto,
    });

    await this.prisma.activityLog.create({
      data: {
        user_id: adminId,
        action: 'admin_update_order',
        entity_type: 'order',
        entity_id: id,
        details: dto,
      },
    });

    return order;
  }

  async updateOrderStatus(
    adminId: string,
    id: string,
    status: string,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { order_items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const oldStatus = order.order_status;
    if (oldStatus === status) return order;

    // Transition validation (simplified)
    const invalidTransitions: Record<string, string[]> = {
      delivered: ['cancelled', 'pending'],
      cancelled: ['delivered', 'confirmed', 'processing', 'shipped'],
      returned: ['delivered', 'confirmed', 'processing', 'shipped'],
    };

    if (invalidTransitions[oldStatus || '']?.includes(status)) {
      throw new BadRequestException(
        `Cannot change status from ${oldStatus} to ${status}`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          order_status: status,
          ...(status === 'delivered'
            ? {
                delivered_at: new Date(),
                payment_status: 'paid',
              }
            : {}),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          order_id: id,
          status,
          notes: reason,
        },
      });

      // Stock Restoration
      if (
        (status === 'cancelled' || status === 'returned') &&
        oldStatus !== 'cancelled' &&
        oldStatus !== 'returned'
      ) {
        for (const item of order.order_items) {
          if (item.variant_id) {
            await tx.productVariant.update({
              where: { id: item.variant_id },
              data: { stock: { increment: item.quantity } },
            });
          } else {
            await tx.product.update({
              where: { id: item.product_id },
              data: { stock_quantity: { increment: item.quantity } },
            });
          }
        }
      }

      // Customer stats update on status change
      if (order.customer_id) {
        await this.syncCustomerStats(tx, order.customer_id);
        if (status === 'delivered' && oldStatus !== 'delivered') {
          await tx.customer.update({
            where: { id: order.customer_id },
            data: {
              account_completed_at: new Date(), // Mark as active customer
            },
          });
        }
      }

      // Update Daily Report Analytics
      if (status === 'delivered' && oldStatus !== 'delivered') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await tx.dailyReport.upsert({
          where: { date: today },
          create: {
            date: today,
            total_orders: 1,
            total_revenue: order.total_amount || 0,
            total_profit: (order.total_amount || 0) as any, // Simple profit for now, can be refined with cost price
            net_profit: (order.total_amount || 0) as any,
          },
          update: {
            total_orders: { increment: 1 },
            total_revenue: { increment: order.total_amount || 0 },
            total_profit: { increment: order.total_amount || 0 },
            net_profit: { increment: order.total_amount || 0 },
          },
        });
      }

      await tx.activityLog.create({
        data: {
          user_id: adminId,
          action: 'status_updated',
          entity_type: 'order',
          entity_id: id,
          details: { from: oldStatus, to: status, reason },
        },
      });

      await tx.notification.create({
        data: {
          user_id: order.user_id,
          type: 'order_status_update',
          title: `Order ${order.order_number} ${status}`,
          message: `Your order status has been updated to ${status}`,
        },
      });

      return updatedOrder;
    });
  }

  async deleteOrder(adminId: string, id: string) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        user_id: adminId,
        action: 'order_deleted',
        entity_type: 'order',
        entity_id: id,
      },
    });

    return order;
  }

  async createManualOrder(adminId: string, dto: any) {
    const orderNumber =
      'ORD-MAN-' + Math.floor(100000 + Math.random() * 900000);

    // This is a simplified manual order creation
    const order = await this.prisma.order.create({
      data: {
        order_number: orderNumber,
        customer_name: dto.customer_name,
        customer_phone: dto.customer_phone,
        shipping_address: dto.shipping_address,
        subtotal: dto.subtotal,
        delivery_charge: dto.delivery_charge,
        total_amount: dto.total_amount,
        payment_method: dto.payment_method || 'cod',
        order_status: dto.status || 'confirmed',
        order_source_type: 'admin_manual',
        is_guest_order: true,
      },
    });

    // Add items
    if (dto.items && Array.isArray(dto.items)) {
      for (const item of dto.items) {
        await this.prisma.orderItem.create({
          data: {
            order_id: order.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * item.quantity,
          },
        });

        // Deduct stock
        if (item.variant_id) {
          await this.prisma.productVariant.update({
            where: { id: item.variant_id },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          await this.prisma.product.update({
            where: { id: item.product_id },
            data: { stock_quantity: { decrement: item.quantity } },
          });
        }
      }
    }

    await this.prisma.activityLog.create({
      data: {
        user_id: adminId,
        action: 'manual_order_created',
        entity_type: 'order',
        entity_id: order.id,
        details: { order_number: orderNumber },
      },
    });

    return order;
  }

  async exportOrders(res: Response, adminId: string, filters: any) {
    const where: any = { deleted_at: null };
    if (filters.status && filters.status !== 'all') {
      where.order_status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { order_number: { contains: filters.search, mode: 'insensitive' } },
        { customer_phone: { contains: filters.search } },
        { customer_name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        order_items: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Orders');

    worksheet.columns = [
      { header: 'Order #', key: 'order_number', width: 15 },
      { header: 'Date', key: 'created_at', width: 20 },
      { header: 'Customer', key: 'customer_name', width: 25 },
      { header: 'Phone', key: 'customer_phone', width: 15 },
      { header: 'Amount', key: 'total_amount', width: 12 },
      { header: 'Status', key: 'order_status', width: 15 },
      { header: 'Source', key: 'order_source_type', width: 15 },
    ];

    orders.forEach((o) => {
      worksheet.addRow({
        order_number: o.order_number,
        created_at: o.created_at.toISOString(),
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        total_amount: Number(o.total_amount),
        order_status: o.order_status,
        order_source_type: o.order_source_type,
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');

    await workbook.xlsx.write(res);
    res.end();

    await this.activityLogs.create({
      user_id: adminId,
      action: 'EXPORT_ORDERS',
      entity_type: 'order',
      details: { count: orders.length, filters },
    });
  }

  private async syncCustomerStats(tx: any, customerId: string) {
    const stats = await tx.order.aggregate({
      where: {
        customer_id: customerId,
        deleted_at: null,
        order_status: { notIn: ['cancelled', 'returned'] },
      },
      _count: { id: true },
      _sum: { total_amount: true },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: {
        total_orders: stats._count.id || 0,
        total_spend: stats._sum.total_amount || 0,
      },
    });
  }
}
