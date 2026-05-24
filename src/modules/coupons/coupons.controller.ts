import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('admin/coupons')
@UseGuards(AdminAuthGuard)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async findAll(@Query() query: any) {
    const data = await this.couponsService.findAll(query);
    return successResponse('Coupons fetched successfully', data);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const data = await this.couponsService.create(req.user.sub, body);
    return successResponse('Coupon created successfully', data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const data = await this.couponsService.update(req.user.sub, id, body);
    return successResponse('Coupon updated successfully', data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.couponsService.remove(req.user.sub, id);
    return successResponse('Coupon deleted successfully', data);
  }
}
