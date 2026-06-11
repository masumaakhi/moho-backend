import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateVideoReviewDto,
  UpdateVideoReviewDto,
} from './dto/video-review.dto';

@Injectable()
export class CustomerVideoReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateVideoReviewDto) {
    return this.prisma.customerVideoReview.create({
      data: {
        title: data.title,
        video_url: data.video_url,
        sort_order: data.sort_order || 0,
        is_active: data.is_active ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.customerVideoReview.findMany({
      orderBy: { sort_order: 'asc' },
    });
  }

  async findActive() {
    return this.prisma.customerVideoReview.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });
  }

  async findOne(id: string) {
    const video = await this.prisma.customerVideoReview.findUnique({
      where: { id },
    });
    if (!video) throw new NotFoundException('Video review not found');
    return video;
  }

  async update(id: string, data: UpdateVideoReviewDto) {
    await this.findOne(id);
    return this.prisma.customerVideoReview.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customerVideoReview.delete({
      where: { id },
    });
  }
}
