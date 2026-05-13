import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('public')
  async findPublic() {
    const data = await this.announcementsService.findPublic();
    return successResponse('Announcements fetched successfully', data);
  }
}

@Controller('admin/announcements')
@UseGuards(AdminAuthGuard)
export class AdminAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async findAll(@Query() query: any) {
    const data = await this.announcementsService.findAll(query);
    return successResponse('Announcements fetched successfully', data);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const data = await this.announcementsService.create(req.user.sub, body);
    return successResponse('Announcement created successfully', data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const data = await this.announcementsService.update(req.user.sub, id, body);
    return successResponse('Announcement updated successfully', data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.announcementsService.remove(req.user.sub, id);
    return successResponse('Announcement deleted successfully', data);
  }
}
