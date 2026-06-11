import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CheckoutSummaryDto, PlaceOrderDto } from './dto/order.dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout/summary')
  async checkoutSummary(
    @Headers('x-session-id') sessionId: string,
    @Headers('authorization') authHeader: string,
    @Body() dto: CheckoutSummaryDto,
  ) {
    return this.ordersService.checkoutSummary(
      sessionId,
      authHeader,
      dto.zone,
      dto.coupon_code,
    );
  }

  @Post('orders')
  async placeOrder(
    @Headers('x-session-id') sessionId: string,
    @Headers('authorization') authHeader: string,
    @Body() dto: PlaceOrderDto,
  ) {
    if (!dto.shipping_address) {
      throw new BadRequestException('Shipping address is required');
    }
    return this.ordersService.placeOrder(sessionId, authHeader, dto);
  }

  @Get('orders')
  async getOrders(@Headers('authorization') authHeader: string) {
    return this.ordersService.getOrders(authHeader);
  }

  @Get('orders/:id/success')
  async getOrderSuccess(@Param('id') orderId: string) {
    return this.ordersService.getOrderSuccess(orderId);
  }

  @Get('track-order')
  async trackOrder(@Query('query') query: string) {
    return this.ordersService.trackOrder(query);
  }
}
