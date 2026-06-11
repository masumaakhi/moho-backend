import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import {
  AnnouncementsController,
  AdminAnnouncementsController,
} from './announcements.controller';

@Module({
  providers: [AnnouncementsService],
  controllers: [AnnouncementsController, AdminAnnouncementsController],
})
export class AnnouncementsModule {}
