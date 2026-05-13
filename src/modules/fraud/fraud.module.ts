import { Module, Global } from '@nestjs/common';
import { FraudService } from './fraud.service';
import { FraudController } from './fraud.controller';
import { PrismaService } from '../../database/prisma.service';

@Global()
@Module({
  controllers: [FraudController],
  providers: [FraudService, PrismaService],
  exports: [FraudService],
})
export class FraudModule {}
