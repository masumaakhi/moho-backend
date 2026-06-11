import { Module } from '@nestjs/common';
import { BannersService } from './banners.service';
import {
  BannersController,
  AdminBannersController,
} from './banners.controller';

@Module({
  providers: [BannersService],
  controllers: [BannersController, AdminBannersController],
})
export class BannersModule {}
