import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import type { Response } from 'express';

@Controller('admin/invoices')
@UseGuards(AdminAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.invoicesService.findAll(query);
  }

  @Post('generate')
  async generate(@Body('orderId') orderId: string, @Req() req: any) {
    const adminId = req.user.sub;
    return this.invoicesService.generate(orderId, adminId);
  }

  @Get('bulk-pdf')
  async exportBulkPdf(
    @Query('orderIds') orderIdsString: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    const adminId = req.user.sub;
    const orderIds = orderIdsString ? orderIdsString.split(',') : [];
    return this.invoicesService.exportBulkPdf(orderIds, res, adminId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/pdf')
  async exportPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    const adminId = req.user.sub;
    return this.invoicesService.exportPdf(id, res, adminId);
  }

  @Get(':id/print')
  async print(@Param('id') id: string, @Res() res: Response, @Req() req: any) {
    const adminId = req.user.sub;
    // For print, we can return the same PDF or a different view.
    // In many cases, standard PDF is used for print.
    return this.invoicesService.exportPdf(id, res, adminId);
  }
}
