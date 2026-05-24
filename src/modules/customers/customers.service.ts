import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { successResponse } from '../../common/responses/api-response';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });
    if (!user || user.deleted_at) throw new NotFoundException('User not found');

    return successResponse('Profile fetched successfully', {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      account_type: user.account_type,
      is_password_set: user.is_password_set,
      customer: user.customer ? {
        id: user.customer.id,
        source_type: user.customer.source_type,
        account_completed_at: user.customer.account_completed_at,
        first_order_id: user.customer.first_order_id,
        address: user.customer.address,
        mohul_cash: user.customer.mohul_cash,
        total_orders: user.customer.total_orders,
        total_spend: user.customer.total_spend,
      } : null,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { address, ...userData } = dto;

    // Check duplicate phone/email
    if (userData.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: userData.email.toLowerCase(), id: { not: userId }, deleted_at: null },
      });
      if (existingEmail) throw new BadRequestException('Email already in use');
    }

    if (userData.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: userData.phone, id: { not: userId }, deleted_at: null },
      });
      if (existingPhone) throw new BadRequestException('Phone number already in use');
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: userData,
        include: { customer: true },
      });

      if (user.customer) {
        await tx.customer.update({
          where: { id: user.customer.id },
          data: {
            name: userData.name || user.customer.name,
            email: userData.email || user.customer.email,
            phone: userData.phone || user.customer.phone,
            address: address !== undefined ? address : user.customer.address,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          user_id: userId,
          action: 'update_profile',
          entity_type: 'user',
          entity_id: userId,
          details: { updated_fields: Object.keys(dto) },
        },
      });

      return user;
    });

    return this.getProfile(updatedUser.id);
  }

  async getAddresses(userId: string) {
    const customer = await this.getCustomerByUserId(userId);
    const addresses = await this.prisma.customerAddress.findMany({
      where: { customer_id: customer.id },
      orderBy: { created_at: 'desc' },
    });
    return successResponse('Addresses fetched successfully', addresses);
  }

  async addAddress(userId: string, dto: { address: string; is_default?: boolean }) {
    const customer = await this.getCustomerByUserId(userId);

    if (dto.is_default) {
      await this.prisma.customerAddress.updateMany({
        where: { customer_id: customer.id },
        data: { is_default: false },
      });
    }

    const address = await this.prisma.customerAddress.create({
      data: {
        customer_id: customer.id,
        address: dto.address,
        is_default: dto.is_default ?? false,
      },
    });

    return successResponse('Address added successfully', address);
  }

  async updateAddress(userId: string, addressId: string, dto: { address?: string; is_default?: boolean }) {
    const customer = await this.getCustomerByUserId(userId);
    const address = await this.prisma.customerAddress.findUnique({ where: { id: addressId } });

    if (!address || address.customer_id !== customer.id) {
      throw new NotFoundException('Address not found');
    }

    if (dto.is_default) {
      await this.prisma.customerAddress.updateMany({
        where: { customer_id: customer.id },
        data: { is_default: false },
      });
    }

    const updated = await this.prisma.customerAddress.update({
      where: { id: addressId },
      data: dto,
    });

    return successResponse('Address updated successfully', updated);
  }

  async deleteAddress(userId: string, addressId: string) {
    const customer = await this.getCustomerByUserId(userId);
    const address = await this.prisma.customerAddress.findUnique({ where: { id: addressId } });

    if (!address || address.customer_id !== customer.id) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.customerAddress.delete({ where: { id: addressId } });
    return successResponse('Address deleted successfully');
  }

  async getOrders(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { customer: true } });
    if (!user) throw new NotFoundException('User not found');

    // Guest linking: Find orders with same phone/email but no customer_id
    const conditions: any[] = [];
    if (user.phone) conditions.push({ customer_phone: user.phone });
    if (user.email) conditions.push({ customer_email: user.email.toLowerCase() });

    if (conditions.length > 0) {
      const unlinkedOrders = await this.prisma.order.findMany({
        where: {
          customer_id: null,
          OR: conditions,
        },
      });

      if (unlinkedOrders.length > 0 && user.customer) {
        await this.prisma.order.updateMany({
          where: { id: { in: unlinkedOrders.map(o => o.id) } },
          data: { customer_id: user.customer.id, user_id: user.id },
        });
      }
    }

    const orders = await this.prisma.order.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        order_items: true,
      },
    });

    return successResponse('Orders fetched successfully', orders);
  }

  async getOrderDetails(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        order_items: {
          include: {
            product: {
              include: { images: { take: 1 } }
            }
          }
        },
        status_history: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.user_id !== userId) throw new ForbiddenException('Access denied');

    return successResponse('Order details fetched successfully', order);
  }

  async reorder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { order_items: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.user_id !== userId) throw new ForbiddenException('Access denied');

    // Find or create active cart for user
    let cart = await this.prisma.cart.findFirst({
      where: { user_id: userId, status: 'active' },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { user_id: userId, status: 'active' },
      });
    }

    const addedItems: string[] = [];
    const unavailableItems: string[] = [];

    for (const item of order.order_items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.product_id },
      });

      if (product && product.status === 'active' && product.stock_quantity >= item.quantity) {
        await this.prisma.cartItem.create({
          data: {
            cart_id: cart.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            price: product.new_price || product.base_price,
          },
        });
        addedItems.push(item.product_name);
      } else {
        unavailableItems.push(item.product_name);
      }
    }

    await this.prisma.activityLog.create({
      data: {
        user_id: userId,
        action: 'reorder',
        entity_type: 'order',
        entity_id: orderId,
        details: { added: addedItems, unavailable: unavailableItems },
      },
    });

    if (addedItems.length === 0) {
      throw new BadRequestException('None of the products are available for reorder');
    }

    return successResponse('Products added to cart', {
      added: addedItems,
      unavailable: unavailableItems,
    });
  }

  async setPassword(userId: string, new_password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { customer: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.is_password_set) throw new BadRequestException('Password already set');

    const password_hash = await bcrypt.hash(new_password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash, is_password_set: true },
    });

    if (user.customer) {
      await this.prisma.customer.update({
        where: { id: user.customer.id },
        data: { account_completed_at: new Date() },
      });
    }

    await this.prisma.activityLog.create({
      data: {
        user_id: userId,
        action: 'set_password',
        entity_type: 'user',
        entity_id: userId,
      },
    });

    return successResponse('Password set successfully');
  }

  private async getCustomerByUserId(userId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { user_id: userId } });
    if (!customer) throw new NotFoundException('Customer record not found');
    return customer;
  }
}
