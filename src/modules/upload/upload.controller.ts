import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('admin/upload')
@UseGuards(AdminAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const url = await this.uploadService.uploadImage(file);
      return successResponse('Image uploaded successfully', { url });
    } catch (error) {
      throw new BadRequestException('Failed to upload image: ' + error.message);
    }
  }
}
