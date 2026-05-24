import { Module } from '@nestjs/common';
import { HeroCampaignsService } from './hero-campaigns.service';
import { HeroCampaignsController, AdminHeroCampaignsController } from './hero-campaigns.controller';

@Module({
  providers: [HeroCampaignsService],
  controllers: [HeroCampaignsController, AdminHeroCampaignsController]
})
export class HeroCampaignsModule {}
