import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CropsModule } from './crops/crops.module';
import { MarketsModule } from './markets/markets.module';
import { PricesModule } from './prices/prices.module';
import { LotsModule } from './lots/lots.module';
import { BidsModule } from './bids/bids.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PaymentsModule } from './payments/payments.module';
import { DemoModule } from './demo/demo.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/backend/.env', '.env.local', 'apps/backend/.env.local'],
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CropsModule,
    MarketsModule,
    PricesModule,
    LotsModule,
    BidsModule,
    TransactionsModule,
    PaymentsModule,
    DemoModule,
    AnalyticsModule,
    AdminModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
