import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { Request } from 'express';
import { successResponse } from '../../common/responses/api-response';

type AuthedReq = Request & { user: { sub: string; scope: 'admin' } };

@Controller('admin/delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @UseGuards(AdminAuthGuard)
  @Get()
  async getDeliveries(@Query() query: any) {
    const data = await this.deliveryService.getDeliveries(query);
    return successResponse('Deliveries fetched successfully', data);
  }

  @UseGuards(AdminAuthGuard)
  @Post('book')
  async bookCourier(@Req() req: AuthedReq, @Body() dto: { order_id: string }) {
    const data = await this.deliveryService.bookCourier(
      req.user.sub,
      dto.order_id,
    );
    return successResponse('Courier booked successfully', data);
  }

  @UseGuards(AdminAuthGuard)
  @Get(':id')
  async getDeliveryDetails(@Param('id') id: string) {
    const data = await this.deliveryService.getDeliveryDetails(id);
    return successResponse('Delivery details fetched successfully', data);
  }

  @UseGuards(AdminAuthGuard)
  @Post(':id/sync')
  async syncTracking(@Req() req: AuthedReq, @Param('id') id: string) {
    const data = await this.deliveryService.syncTracking(req.user.sub, id);
    return successResponse('Tracking synced successfully', data);
  }

  @UseGuards(AdminAuthGuard)
  @Post(':id/retry')
  async retryBooking(@Req() req: AuthedReq, @Param('id') id: string) {
    const data = await this.deliveryService.retryBooking(req.user.sub, id);
    return successResponse('Booking retry successful', data);
  }
}
