import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req, Res } from '@nestjs/common';
import { AdminCustomersService } from './admin-customers.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@Controller('admin/customers')
@UseGuards(AdminAuthGuard)
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get()
  getCustomers(@Query() query: any) {
    return this.customersService.getCustomers(query);
  }

  @Get('export')
  async exportCustomers(@Res() res: any, @Req() req: any) {
    const adminUserId = req?.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.customersService.exportCustomers(res, adminUserId);
  }

  @Get(':id')
  getCustomerById(@Param('id') id: string) {
    return this.customersService.getCustomerById(id);
  }

  @Get(':id/orders')
  getCustomerOrders(@Param('id') id: string) {
    return this.customersService.getCustomerOrders(id);
  }

  @Get(':id/risk')
  getCustomerRisk(@Param('id') id: string) {
    return this.customersService.getCustomerRiskProfile(id);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body('note') note: string, @Req() req: any) {
    const adminId = req.user.sub;
    return this.customersService.addNote(id, adminId, note);
  }

  @Patch(':id/watchlist')
  toggleWatchlist(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.sub;
    return this.customersService.toggleWatchlist(id, adminId);
  }

  @Patch(':id/block')
  toggleBlock(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.sub;
    return this.customersService.toggleBlock(id, adminId);
  }

  @Post('bulk-block')
  bulkBlock(@Body('ids') ids: string[], @Req() req: any) {
    const adminId = req.user.sub;
    return this.customersService.bulkBlock(ids, adminId);
  }
}
