import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BannersService } from './banners.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get('public')
  async findPublic(@Query() query: any) {
    const data = await this.bannersService.findAll({
      ...query,
      status: 'active',
    });
    return successResponse('Banners fetched successfully', data);
  }
}

@Controller('admin/banners')
@UseGuards(AdminAuthGuard)
export class AdminBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  async findAll(@Query() query: any) {
    const data = await this.bannersService.findAll(query);
    return successResponse('Banners fetched successfully', data);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const data = await this.bannersService.create(req.user.sub, body);
    return successResponse('Banner created successfully', data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const data = await this.bannersService.update(req.user.sub, id, body);
    return successResponse('Banner updated successfully', data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.bannersService.remove(req.user.sub, id);
    return successResponse('Banner deleted successfully', data);
  }
}
