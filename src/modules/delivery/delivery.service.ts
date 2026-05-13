import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { successResponse } from '../../common/responses/api-response';
import axios from 'axios';

@Injectable()
export class DeliveryService {
  private readonly pathaoBaseUrl = 'https://api-hermes.pathao.com'; // Example URL

  constructor(private prisma: PrismaService) {}

  async getDeliveries(query: any) {
    const { status, search, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.delivery_status = status;
    if (search) {
      where.OR = [
        { consignment_id: { contains: search, mode: 'insensitive' } },
        { tracking_id: { contains: search, mode: 'insensitive' } },
        { order: { order_number: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.deliveryBooking.findMany({
        where,
        skip,
        take: Number(limit),
        include: { order: true },
        orderBy: { created_at: 'desc' }
      }),
      this.prisma.deliveryBooking.count({ where })
    ]);

    return {
      items,
      meta: {
        total,
        page: Number(page),
        last_page: Math.ceil(total / Number(limit))
      }
    };
  }

  async getDeliveryDetails(id: string) {
    const delivery = await this.prisma.deliveryBooking.findUnique({
      where: { id },
      include: { 
        order: {
          include: { order_items: true }
        },
        tracking_events: {
          orderBy: { event_time: 'desc' }
        },
        retry_logs: {
          orderBy: { created_at: 'desc' }
        }
      }
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  async bookCourier(adminId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery_bookings: true }
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.order_status !== 'confirmed' && order.order_status !== 'processing') {
      throw new BadRequestException('Only confirmed or processing orders can be booked');
    }

    // Check if already booked successfully
    const existingSuccess = order.delivery_bookings.find(b => b.delivery_status === 'booked' || b.delivery_status === 'in_transit');
    if (existingSuccess) throw new BadRequestException('Order already booked with courier');

    // Validate delivery info
    if (!order.customer_phone || !order.shipping_address || !order.customer_name) {
      throw new BadRequestException('Missing customer delivery information (name, phone, or address)');
    }

    // Create or find booking record
    let booking = order.delivery_bookings[0];
    if (!booking) {
      booking = await this.prisma.deliveryBooking.create({
        data: {
          order_id: orderId,
          delivery_status: 'pending'
        }
      });
    }

    try {
      // 1. Get Pathao Credentials from Settings
      const settings = await this.prisma.setting.findMany({
        where: { group: 'delivery' }
      });
      const apiKey = settings.find(s => s.key === 'pathao_api_key')?.value || process.env.PATHAO_API_KEY;
      const secret = settings.find(s => s.key === 'pathao_api_secret')?.value || process.env.PATHAO_API_SECRET;
      const storeId = settings.find(s => s.key === 'pathao_store_id')?.value;

      if (!apiKey) throw new Error('Pathao API Key not configured');

      // 2. Call Pathao API (Mocked for now)
      // In real implementation, you'd handle OAuth and then POST /aladdin/api/v1/orders
      const mockResponse = {
        success: true,
        data: {
          consignment_id: 'PH-' + Math.random().toString(36).substring(7).toUpperCase(),
          tracking_id: 'TRK-' + Math.random().toString(36).substring(7).toUpperCase(),
        }
      };

      // 3. Update Booking
      await this.prisma.deliveryBooking.update({
        where: { id: booking.id },
        data: {
          consignment_id: mockResponse.data.consignment_id,
          tracking_id: mockResponse.data.tracking_id,
          delivery_status: 'booked',
          booking_response: mockResponse as any
        }
      });

      // 4. Update Order Status
      await this.prisma.order.update({
        where: { id: orderId },
        data: { order_status: 'processing' } // Or 'shipped' if immediately picked
      });

      // 5. Activity Log
      await this.prisma.activityLog.create({
        data: {
          user_id: adminId,
          action: 'courier_booked',
          entity_type: 'order',
          entity_id: orderId,
          details: { courier: 'pathao', tracking_id: mockResponse.data.tracking_id }
        }
      });

      // 6. Notification
      await this.prisma.notification.create({
        data: {
          user_id: order.user_id,
          type: 'delivery_update',
          title: 'Order Handed to Courier',
          message: `Your order ${order.order_number} has been handed over to Pathao. Tracking ID: ${mockResponse.data.tracking_id}`
        }
      });

      return { success: true, tracking_id: mockResponse.data.tracking_id };

    } catch (error) {
      // Log retry
      await this.prisma.deliveryRetryLog.create({
        data: {
          booking_id: booking.id,
          error_message: error.message,
          retry_number: booking.retry_count + 1
        }
      });

      await this.prisma.deliveryBooking.update({
        where: { id: booking.id },
        data: {
          delivery_status: 'failed',
          retry_count: { increment: 1 },
          last_retry_at: new Date()
        }
      });

      throw new BadRequestException(`Courier booking failed: ${error.message}`);
    }
  }

  async retryBooking(adminId: string, bookingId: string) {
    const booking = await this.prisma.deliveryBooking.findUnique({
      where: { id: bookingId }
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.retry_count >= 5) throw new BadRequestException('Retry limit exceeded for this booking');

    return this.bookCourier(adminId, booking.order_id);
  }

  async syncTracking(adminId: string, bookingId: string) {
    const booking = await this.prisma.deliveryBooking.findUnique({
      where: { id: bookingId },
      include: { order: true }
    });
    if (!booking || !booking.tracking_id) throw new BadRequestException('No tracking ID available');

    // Mock Status Sync
    const statuses = ['in_transit', 'delivered', 'returned', 'failed'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    // Save tracking event
    await this.prisma.deliveryTrackingEvent.create({
      data: {
        booking_id: bookingId,
        status: randomStatus,
        location: 'Dhaka Hub',
        message: `Package status updated to ${randomStatus}`
      }
    });

    // Update booking status
    await this.prisma.deliveryBooking.update({
      where: { id: bookingId },
      data: { delivery_status: randomStatus }
    });

    // Handle Order status updates
    if (randomStatus === 'delivered') {
      await this.prisma.order.update({
        where: { id: booking.order_id },
        data: { order_status: 'delivered' }
      });
      // Log history
      await this.prisma.orderStatusHistory.create({
        data: {
          order_id: booking.order_id,
          status: 'delivered',
          notes: 'Auto-updated via courier sync'
        }
      });
    } else if (randomStatus === 'returned' || randomStatus === 'failed') {
       await this.prisma.order.update({
        where: { id: booking.order_id },
        data: { order_status: randomStatus === 'returned' ? 'returned' : 'cancelled' }
      });
    }

    // Activity Log
    await this.prisma.activityLog.create({
      data: {
        user_id: adminId,
        action: 'delivery_sync',
        entity_type: 'order',
        entity_id: booking.order_id,
        details: { status: randomStatus }
      }
    });

    return { success: true, status: randomStatus };
  }

  async handleWebhook(data: any) {
    // Process Pathao webhook
    const { consignment_id, status } = data;
    const booking = await this.prisma.deliveryBooking.findFirst({
      where: { consignment_id }
    });

    if (!booking) return { success: false, message: 'Booking not found' };

    // Update tracking and booking
    await this.prisma.deliveryTrackingEvent.create({
      data: {
        booking_id: booking.id,
        status: status,
        raw_data: data
      }
    });

    await this.prisma.deliveryBooking.update({
      where: { id: booking.id },
      data: { delivery_status: status }
    });

    // Logic for order status updates based on status (similar to syncTracking)
    if (status === 'Delivered') {
        await this.prisma.order.update({
            where: { id: booking.order_id },
            data: { order_status: 'delivered' }
        });
    }

    return { success: true };
  }
}
