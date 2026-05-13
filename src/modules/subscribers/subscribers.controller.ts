import { Controller, Get, Body, Patch, Param, Delete, Query, UseGuards, Req, Res } from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('admin/subscribers')
@UseGuards(AdminAuthGuard)
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Get()
  async findAll(@Query() query: any) {
    const data = await this.subscribersService.findAll(query);
    return successResponse('Subscribers fetched successfully', data);
  }

  @Get('export')
  async exportSubscribers(@Res() res: any, @Req() req: any) {
    const adminUserId = req?.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.subscribersService.exportSubscribers(res, adminUserId);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: any) {
    const data = await this.subscribersService.updateStatus(req.user.sub, id, body.status);
    return successResponse(`Subscriber status updated to ${body.status}`, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.subscribersService.remove(req.user.sub, id);
    return successResponse('Subscriber deleted successfully', data);
  }
}
