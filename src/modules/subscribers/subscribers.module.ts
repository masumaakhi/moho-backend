import { Module } from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import { SubscribersController } from './subscribers.controller';

@Module({
  providers: [SubscribersService],
  controllers: [SubscribersController]
})
export class SubscribersModule {}
