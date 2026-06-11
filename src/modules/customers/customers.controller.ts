import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { CustomersService } from './customers.service';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';

type AuthedReq = Request & {
  user: { sub: string; scope: 'customer' | 'admin' };
};

@Controller('customer')
@UseGuards(CustomerAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('profile')
  getProfile(@Req() req: AuthedReq) {
    return this.customersService.getProfile(req.user.sub);
  }

  @Patch('profile')
  updateProfile(@Req() req: AuthedReq, @Body() dto: UpdateProfileDto) {
    return this.customersService.updateProfile(req.user.sub, dto);
  }

  @Get('addresses')
  getAddresses(@Req() req: AuthedReq) {
    return this.customersService.getAddresses(req.user.sub);
  }

  @Post('addresses')
  addAddress(
    @Req() req: AuthedReq,
    @Body() dto: { address: string; is_default?: boolean },
  ) {
    return this.customersService.addAddress(req.user.sub, dto);
  }

  @Patch('addresses/:id')
  updateAddress(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() dto: { address?: string; is_default?: boolean },
  ) {
    return this.customersService.updateAddress(req.user.sub, id, dto);
  }

  @Delete('addresses/:id')
  deleteAddress(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.customersService.deleteAddress(req.user.sub, id);
  }

  @Get('orders')
  getOrders(@Req() req: AuthedReq) {
    return this.customersService.getOrders(req.user.sub);
  }

  @Get('orders/:id')
  getOrderDetails(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.customersService.getOrderDetails(req.user.sub, id);
  }

  @Post('orders/:id/reorder')
  reorder(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.customersService.reorder(req.user.sub, id);
  }

  @Post('set-password')
  setPassword(@Req() req: AuthedReq, @Body() dto: { new_password: string }) {
    return this.customersService.setPassword(req.user.sub, dto.new_password);
  }
}
