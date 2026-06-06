import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { Request } from 'express';
import { successResponse } from '../../common/responses/api-response';

type AuthedReq = Request & { user: { sub: string; scope: 'admin' } };

@Controller('admin/orders')
@UseGuards(AdminAuthGuard)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getOrders(@Query() filters: any) {
    const data = await this.ordersService.getAdminOrders(filters);
    return successResponse('Orders fetched successfully', data);
  }

  @Post()
  async createManualOrder(@Req() req: AuthedReq, @Body() dto: any) {
    const data = await this.ordersService.createManualOrder(req.user.sub, dto);
    return successResponse('Manual order created successfully', data);
  }

  @Get('export')
  async exportOrders(@Res() res: any, @Req() req: any, @Query() filters: any) {
    return this.ordersService.exportOrders(res, req.user.sub, filters);
  }

  @Get(':id')
  async getOrderDetails(@Param('id') id: string) {
    const data = await this.ordersService.getAdminOrderDetails(id);
    return successResponse('Order details fetched successfully', data);
  }

  @Patch('bulk-status')
  async bulkUpdateStatus(@Req() req: AuthedReq, @Body() dto: { ids: string[]; status: string; reason?: string }) {
    const results: any[] = [];
    for (const id of dto.ids) {
      try {
        const data = await this.ordersService.updateOrderStatus(req.user.sub, id, dto.status, dto.reason);
        results.push({ id, success: true, data });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message || 'Failed to update status' });
      }
    }
    return successResponse('Bulk status update completed', results);
  }

  @Patch(':id')
  async updateOrder(@Req() req: AuthedReq, @Param('id') id: string, @Body() dto: any) {
    const data = await this.ordersService.updateOrder(req.user.sub, id, dto);
    return successResponse('Order updated successfully', data);
  }

  @Patch(':id/status')
  async updateStatus(@Req() req: AuthedReq, @Param('id') id: string, @Body() dto: { status: string; reason?: string }) {
    const data = await this.ordersService.updateOrderStatus(req.user.sub, id, dto.status, dto.reason);
    return successResponse(`Order status updated to ${dto.status}`, data);
  }

  @Patch(':id/confirm')
  async confirmOrder(@Req() req: AuthedReq, @Param('id') id: string) {
    const data = await this.ordersService.updateOrderStatus(req.user.sub, id, 'confirmed');
    return successResponse('Order confirmed successfully', data);
  }

  @Patch(':id/cancel')
  async cancelOrder(@Req() req: AuthedReq, @Param('id') id: string, @Body() dto: { reason: string }) {
    const data = await this.ordersService.updateOrderStatus(req.user.sub, id, 'cancelled', dto.reason);
    return successResponse('Order cancelled successfully', data);
  }

  @Patch(':id/return')
  async returnOrder(@Req() req: AuthedReq, @Param('id') id: string, @Body() dto: { reason: string }) {
    const data = await this.ordersService.updateOrderStatus(req.user.sub, id, 'returned', dto.reason);
    return successResponse('Order returned successfully', data);
  }

  @Delete(':id')
  async deleteOrder(@Req() req: AuthedReq, @Param('id') id: string) {
    const data = await this.ordersService.deleteOrder(req.user.sub, id);
    return successResponse('Order deleted successfully', data);
  }
}
