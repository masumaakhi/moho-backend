import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CustomerVideoReviewsService } from './customer-video-reviews.service';
import {
  CreateVideoReviewDto,
  UpdateVideoReviewDto,
} from './dto/video-review.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@Controller('admin/video-reviews')
@UseGuards(AdminAuthGuard)
export class CustomerVideoReviewsController {
  constructor(private readonly service: CustomerVideoReviewsService) {}

  @Post()
  create(@Body() dto: CreateVideoReviewDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVideoReviewDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
