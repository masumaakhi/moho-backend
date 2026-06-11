import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { AdminCouponsController } from './coupons.controller';

@Module({
  providers: [CouponsService],
  controllers: [AdminCouponsController],
  exports: [CouponsService],
})
export class CouponsModule {}
