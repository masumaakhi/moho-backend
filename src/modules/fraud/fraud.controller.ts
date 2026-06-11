import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FraudService } from './fraud.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('admin/fraud')
@UseGuards(AdminAuthGuard)
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('numbers')
  async getBlacklist(@Query() query: any) {
    const data = await this.fraudService.getBlacklist(query);
    return successResponse('Fraud blacklist fetched successfully', data);
  }

  @Post('numbers')
  async addToBlacklist(
    @Body() body: { phone: string; reason?: string },
    @Req() req: any,
  ) {
    const data = await this.fraudService.addToBlacklist(req.user.sub, body);
    return successResponse('Number added to blacklist', data);
  }

  @Patch('numbers/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    const data = await this.fraudService.updateBlacklistStatus(id, body.active);
    return successResponse('Blacklist status updated', data);
  }

  @Get('suspicious-orders')
  async getSuspiciousOrders(@Query() query: any) {
    const data = await this.fraudService.getSuspiciousOrders(query);
    return successResponse('Suspicious orders fetched successfully', data);
  }

  @Patch('orders/:id/review')
  async reviewOrder(
    @Param('id') id: string,
    @Body() body: { action: any },
    @Req() req: any,
  ) {
    const data = await this.fraudService.reviewOrder(
      req.user.sub,
      id,
      body.action,
    );
    return successResponse(`Order review completed: ${body.action}`, data);
  }

  @Post('duplicate-check')
  async runDuplicateCheck(@Body() body: any) {
    // This is usually called internally from OrdersService, but exposing for manual triggers
    const data = await this.fraudService.checkFraudAndDuplicates(
      body.orderId,
      body.customerPhone,
      body.shippingAddress,
      body.items,
    );
    return successResponse('Fraud check completed', data);
  }
}
