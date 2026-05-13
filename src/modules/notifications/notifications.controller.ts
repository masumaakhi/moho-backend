import { Controller, Get, Patch, Param, Query, UseGuards, Req, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('admin/notifications')
@UseGuards(AdminAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@Query() query: any, @Req() req: any) {
    const data = await this.notificationsService.findAll({
      ...query,
      user_id: req.user.sub,
    });
    return successResponse('Notifications fetched successfully', data);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.sub);
    return successResponse('Unread count fetched successfully', { count });
  }

  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    await this.notificationsService.markAllAsRead(req.user.sub);
    return successResponse('All notifications marked as read');
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: any) {
    await this.notificationsService.markAsRead(id, req.user.sub);
    return successResponse('Notification marked as read');
  }

  // Internal system endpoints (usually would be called via service, but exposing for manual triggers if needed)
  @Post('system/new-order')
  async createNewOrder(@Body() dto: { orderId: string; amount: number }) {
    await this.notificationsService.create({
      type: 'new-order',
      title: 'New Order Received',
      message: `Order #${dto.orderId} for ৳${dto.amount} has been placed.`,
    });
    return successResponse('Order notification created');
  }

  @Post('system/low-stock')
  async createLowStock(@Body() dto: { productId: string; name: string; stock: number }) {
    await this.notificationsService.create({
      type: 'low-stock',
      title: 'Low Stock Alert',
      message: `Product "${dto.name}" (${dto.productId}) is running low on stock: ${dto.stock} remaining.`,
    });
    return successResponse('Stock alert created');
  }
}
