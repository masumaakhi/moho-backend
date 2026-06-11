import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { DatabaseModule } from '../../database/database.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
