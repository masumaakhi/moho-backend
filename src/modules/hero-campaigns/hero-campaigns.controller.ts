import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { HeroCampaignsService } from './hero-campaigns.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('hero-campaigns')
export class HeroCampaignsController {
  constructor(private readonly heroCampaignsService: HeroCampaignsService) {}

  @Get('public')
  async findPublic() {
    const data = await this.heroCampaignsService.findPublic();
    return successResponse('Hero campaigns fetched successfully', data);
  }
}

@Controller('admin/hero-campaigns')
@UseGuards(AdminAuthGuard)
export class AdminHeroCampaignsController {
  constructor(private readonly heroCampaignsService: HeroCampaignsService) {}

  @Get()
  async findAll(@Query() query: any) {
    const data = await this.heroCampaignsService.findAll(query);
    return successResponse('Hero campaigns fetched successfully', data);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const data = await this.heroCampaignsService.create(req.user.sub, body);
    return successResponse('Hero campaign created successfully', data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const data = await this.heroCampaignsService.update(req.user.sub, id, body);
    return successResponse('Hero campaign updated successfully', data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.heroCampaignsService.remove(req.user.sub, id);
    return successResponse('Hero campaign deleted successfully', data);
  }
}
