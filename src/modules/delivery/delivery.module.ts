import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { PublicDeliveryController } from './delivery-public.controller';
import { DeliveryService } from './delivery.service';

@Module({
  controllers: [DeliveryController, PublicDeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
