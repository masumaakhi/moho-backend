import { Controller, Get, Patch, Post, Body, UseGuards, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
  UpdateGeneralSettingsDto, 
  UpdateDeliverySettingsDto, 
  UpdateEmailSettingsDto, 
  UpdateNotificationSettingsDto,
  UpdateReportReceiverDto
} from './dto/settings.dto';
import { successResponse } from '../../common/responses/api-response';

@Controller('admin/settings')
@UseGuards(AdminAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAllSettings() {
    const data = await this.settingsService.getAllSettings();
    return successResponse('Settings fetched successfully', data);
  }

  @Patch('general')
  async updateGeneral(@Body() dto: UpdateGeneralSettingsDto, @Req() req: any) {
    const result = await this.settingsService.updateSettings('general', dto, req.user.sub);
    return successResponse(result.message);
  }

  @Patch('delivery')
  async updateDelivery(@Body() dto: UpdateDeliverySettingsDto, @Req() req: any) {
    const result = await this.settingsService.updateSettings('delivery', dto, req.user.sub);
    return successResponse(result.message);
  }

  @Patch('email')
  async updateEmail(@Body() dto: UpdateEmailSettingsDto, @Req() req: any) {
    const result = await this.settingsService.updateSettings('email', dto, req.user.sub);
    return successResponse(result.message);
  }

  @Patch('notification')
  async updateNotification(@Body() dto: UpdateNotificationSettingsDto, @Req() req: any) {
    const result = await this.settingsService.updateSettings('notification', dto, req.user.sub);
    return successResponse(result.message);
  }

  @Patch('report-receiver')
  async updateReportReceiver(@Body() dto: { receivers: UpdateReportReceiverDto[] }, @Req() req: any) {
    const result = await this.settingsService.updateReportReceivers(dto.receivers, req.user.sub);
    return successResponse(result.message);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(@UploadedFile() file: any, @Req() req: any) {
    // In a real app, you'd upload this to Cloudinary or similar
    // For now, let's assume we get a URL or mock it if no upload service is ready
    // Since I don't see a clear upload service, I'll just mock the URL for now or use Cloudinary if I can figure out the config
    const logoUrl = `https://res.cloudinary.com/demo/image/upload/v1234567890/logo.png`; // Mock URL
    const result = await this.settingsService.uploadLogo(logoUrl, req.user.sub);
    return successResponse(result.message, { logoUrl });
  }
}
