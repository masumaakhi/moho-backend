import { Module } from '@nestjs/common';
import { CustomerVideoReviewsService } from './customer-video-reviews.service';
import { CustomerVideoReviewsController } from './customer-video-reviews.controller';

@Module({
  controllers: [CustomerVideoReviewsController],
  providers: [CustomerVideoReviewsService],
  exports: [CustomerVideoReviewsService],
})
export class CustomerVideoReviewsModule {}
