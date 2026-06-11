import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('admin/reviews')
@UseGuards(AdminAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async findAll(@Query() query: any) {
    const data = await this.reviewsService.findAll(query);
    return successResponse('Reviews fetched successfully', data);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    const data = await this.reviewsService.updateStatus(
      req.user.sub,
      id,
      body.status,
    );
    return successResponse(`Review status updated to ${body.status}`, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.reviewsService.remove(req.user.sub, id);
    return successResponse('Review deleted successfully', data);
  }
}
