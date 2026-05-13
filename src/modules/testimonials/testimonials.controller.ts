import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { successResponse } from '../../common/responses/api-response';

@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get('public')
  async findActive() {
    const data = await this.testimonialsService.findActive();
    return successResponse('Active testimonials fetched successfully', data);
  }

  @Get('admin')
  @UseGuards(AdminAuthGuard)
  async findAll(@Query() query: any) {
    const data = await this.testimonialsService.findAll(query);
    return successResponse('Testimonials fetched successfully', data);
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  async create(@Req() req: any, @Body() body: any) {
    const data = await this.testimonialsService.create(req.user.sub, body);
    return successResponse('Testimonial created successfully', data);
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard)
  async update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    const data = await this.testimonialsService.update(req.user.sub, id, body);
    return successResponse('Testimonial updated successfully', data);
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.testimonialsService.remove(req.user.sub, id);
    return successResponse('Testimonial deleted successfully', data);
  }
}
