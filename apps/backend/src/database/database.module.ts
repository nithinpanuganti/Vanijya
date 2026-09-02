import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import {
  UserRepository,
  CropRepository,
  MarketRepository,
  MandiPriceRepository,
  LotRepository,
  BidRepository,
  TransactionRepository,
  PaymentRepository,
  NotificationRepository,
  AuditRepository,
} from '../repositories';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseService,
    UserRepository,
    CropRepository,
    MarketRepository,
    MandiPriceRepository,
    LotRepository,
    BidRepository,
    TransactionRepository,
    PaymentRepository,
    NotificationRepository,
    AuditRepository,
  ],
  exports: [
    DatabaseService,
    UserRepository,
    CropRepository,
    MarketRepository,
    MandiPriceRepository,
    LotRepository,
    BidRepository,
    TransactionRepository,
    PaymentRepository,
    NotificationRepository,
    AuditRepository,
  ],
})
export class DatabaseModule {}
