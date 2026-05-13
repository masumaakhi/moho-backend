import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { ActivityLogsService, CreateActivityLogDto } from './activity-logs.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('admin/logs')
@UseGuards(AdminAuthGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  async findAll(@Query() query: any) {
    const data = await this.activityLogsService.findAll(query);
    return successResponse('Activity logs fetched successfully', data);
  }

  @Get('export')
  async export(@Res() res: any, @Query() query: any) {
    return this.activityLogsService.exportLogs(res, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.activityLogsService.findOne(id);
    return successResponse('Activity log details fetched successfully', data);
  }

  // General system endpoint for logging from various sources
  @Post('system')
  async createSystemLog(@Body() dto: CreateActivityLogDto, @Req() req: any) {
    const log = await this.activityLogsService.create({
      ...dto,
      ip_address: dto.ip_address || req.ip,
      user_agent: dto.user_agent || req.get('user-agent'),
    });
    return successResponse('System log created', log);
  }
}
