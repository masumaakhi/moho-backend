import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { successResponse } from '../../common/responses/api-response';
import { ConfigService } from '@nestjs/config';
import { decrypt } from '../../common/utils/crypto.util';
import axios from 'axios';

@Injectable()
export class DeliveryService {
  private readonly pathaoBaseUrl = 'https://api-hermes.pathao.com'; // Example URL

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

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
      
      const encryptionKey = this.configService.get<string>('SETTINGS_ENCRYPTION_KEY') || 'default_secret_key';

      let apiKey = settings.find(s => s.key === 'pathao_api_key')?.value;
      if (apiKey) {
        apiKey = decrypt(apiKey, encryptionKey);
      } else {
        apiKey = process.env.PATHAO_API_KEY;
      }

      let secret = settings.find(s => s.key === 'pathao_secret')?.value;
      if (secret) {
        secret = decrypt(secret, encryptionKey);
      } else {
        secret = process.env.PATHAO_API_SECRET;
      }

      const storeId = settings.find(s => s.key === 'pathao_store_id')?.value;
      const username = settings.find(s => s.key === 'pathao_username')?.value || process.env.PATHAO_USERNAME;
      
      let password = settings.find(s => s.key === 'pathao_password')?.value;
      if (password) {
        password = decrypt(password, encryptionKey);
      } else {
        password = process.env.PATHAO_PASSWORD;
      }

      if (!apiKey || !secret) {
        throw new Error('Pathao API Credentials not fully configured');
      }

      if (!storeId) {
        throw new Error('Pathao Store ID not configured');
      }

      // 2. Fetch OAuth token from Pathao
      const grantType = (username && password) ? 'password' : 'client_credentials';

      const tokenPayload: any = {
        client_id: apiKey,
        client_secret: secret,
        grant_type: grantType
      };

      if (grantType === 'password') {
        tokenPayload.username = username;
        tokenPayload.password = password;
      }

      const tokenRes = await axios.post('https://api-hermes.pathao.com/aladdin/api/v1/issue-token', tokenPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const token = tokenRes.data.access_token;
      if (!token) throw new Error('Failed to retrieve access token from Pathao');

      // 3. Calculate Cash on Delivery (COD) amount to collect
      const amountToCollect = (order.payment_method?.toLowerCase() === 'cod' && order.payment_status !== 'paid') 
        ? Number(order.total_amount) 
        : 0;

      // 4. Create Order Booking in Pathao
      const bookingPayload = {
        store_id: Number(storeId),
        merchant_order_id: order.order_number,
        recipient_name: order.customer_name,
        recipient_phone: order.customer_phone,
        recipient_address: order.shipping_address,
        delivery_type: 48, // 48: Normal, 12: On Demand
        item_type: 2, // 2: Parcel
        special_instruction: "Handle with care. Call before delivery.",
        item_quantity: 1,
        item_weight: "0.5",
        item_description: "Organic products",
        amount_to_collect: amountToCollect
      };

      const bookRes = await axios.post('https://api-hermes.pathao.com/aladdin/api/v1/orders', bookingPayload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const responseData = bookRes.data;
      if (!responseData || responseData.code !== 200 || !responseData.data) {
        throw new Error(responseData?.message || 'Pathao API returned an error response');
      }

      const pathaoOrder = responseData.data;

      // 5. Update Booking
      await this.prisma.deliveryBooking.update({
        where: { id: booking.id },
        data: {
          consignment_id: pathaoOrder.consignment_id,
          tracking_id: pathaoOrder.tracking_id || pathaoOrder.consignment_id,
          delivery_status: 'booked',
          booking_response: responseData as any
        }
      });

      // 6. Update Order Status
      await this.prisma.order.update({
        where: { id: orderId },
        data: { order_status: 'processing' }
      });

      // 7. Activity Log
      await this.prisma.activityLog.create({
        data: {
          user_id: adminId,
          action: 'courier_booked',
          entity_type: 'order',
          entity_id: orderId,
          details: { courier: 'pathao', tracking_id: pathaoOrder.tracking_id || pathaoOrder.consignment_id }
        }
      });

      // 8. Notification
      await this.prisma.notification.create({
        data: {
          user_id: order.user_id,
          type: 'delivery_update',
          title: 'Order Handed to Courier',
          message: `Your order ${order.order_number} has been handed over to Pathao. Tracking ID: ${pathaoOrder.tracking_id || pathaoOrder.consignment_id}`
        }
      });

      return { success: true, tracking_id: pathaoOrder.tracking_id || pathaoOrder.consignment_id };

    } catch (error: any) {
      let errorMsg = error.message;
      if (error.response?.data) {
        errorMsg = typeof error.response.data === 'string'
          ? error.response.data
          : (error.response.data.message || JSON.stringify(error.response.data.errors || error.response.data));
      }

      // Log retry
      await this.prisma.deliveryRetryLog.create({
        data: {
          booking_id: booking.id,
          error_message: errorMsg,
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

      throw new BadRequestException(`Courier booking failed: ${errorMsg}`);
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
        data: { 
          order_status: 'delivered',
          payment_status: 'paid',
          delivered_at: new Date()
        }
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
    if (status === 'Delivered' || status === 'delivered') {
        await this.prisma.order.update({
            where: { id: booking.order_id },
            data: { 
              order_status: 'delivered',
              payment_status: 'paid',
              delivered_at: new Date()
            }
        });
    }

    return { success: true };
  }
}
