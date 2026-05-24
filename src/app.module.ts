import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { RolesModule } from './modules/roles/roles.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { AutomationModule } from './modules/automation/automation.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { AdminProductsModule } from './modules/admin-products/admin-products.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminCustomersModule } from './modules/admin-customers/admin-customers.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { BannersModule } from './modules/banners/banners.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { SubscribersModule } from './modules/subscribers/subscribers.module';
import { UploadModule } from './modules/upload/upload.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { CustomerVideoReviewsModule } from './modules/customer-video-reviews/customer-video-reviews.module';
import { HeroCampaignsModule } from './modules/hero-campaigns/hero-campaigns.module';
import { CouponsModule } from './modules/coupons/coupons.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const host = config.get('REDIS_HOST') || '127.0.0.1';
        
        // If REDIS_HOST is set to 'mock', use ioredis-mock for local development without Redis
        if (host === 'mock') {
          const RedisMock = require('ioredis-mock');
          return {
            connection: new RedisMock(),
          };
        }

        return {
          connection: {
            host,
            port: config.get('REDIS_PORT') || 6379,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            // Add a long delay between retries to stop spamming the console
            retryStrategy: (times: number) => {
              if (times % 10 === 0) {
                console.warn(`[Redis] Connection failed (Attempt ${times}). Please ensure Redis is running or set REDIS_HOST="mock" in .env`);
              }
              return Math.min(times * 1000, 30000); // Max 30s delay
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    CartModule,
    OrdersModule,
    CustomersModule,
    AdminUsersModule,
    RolesModule,
    NotificationsModule,
    ActivityLogsModule,
    DeliveryModule,
    InvoicesModule,
    ReportsModule,
    SettingsModule,
    FraudModule,
    MarketingModule,
    AutomationModule,
    StorefrontModule,
    AdminProductsModule,
    AnalyticsModule,
    AdminCustomersModule,
    BannersModule,
    ReviewsModule,
    TestimonialsModule,
    SubscribersModule,
    UploadModule,
    AnnouncementsModule,
    CustomerVideoReviewsModule,
    HeroCampaignsModule,
    CouponsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}