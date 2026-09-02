import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseService } from './database.service';
import {
  User,
  UserSchema,
  Crop,
  CropSchema,
  Market,
  MarketSchema,
  MandiPrice,
  MandiPriceSchema,
  CropLot,
  CropLotSchema,
  Bid,
  BidSchema,
  Transaction,
  TransactionSchema,
  Payment,
  PaymentSchema,
  Notification,
  NotificationSchema,
  AuditLog,
  AuditLogSchema,
} from './schemas';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI') || process.env.MONGODB_URI;

        if (!uri || uri.trim() === '') {
          const errorMsg =
            'MONGODB_URI is not configured. Create apps/backend/.env from .env.example and provide a valid MongoDB connection string.';
          Logger.error(`\n❌ [Database Configuration Error]\n${errorMsg}\n`, 'DatabaseModule');
          throw new Error(errorMsg);
        }

        // Log safe message without revealing URI or credentials
        Logger.log('🍃 Connecting to MongoDB...', 'DatabaseModule');

        return {
          uri,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          retryAttempts: 2,
          retryDelay: 1000,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              Logger.log('🍃 MongoDB connected successfully.', 'DatabaseModule');
            });
            connection.on('error', (err: any) => {
              Logger.error(
                `❌ MongoDB connection failed: ${err.message || err}. Ensure your MongoDB service is running and your connection string in apps/backend/.env is valid.`,
                'DatabaseModule',
              );
            });
            connection.on('disconnected', () => {
              Logger.warn('⚠️ MongoDB disconnected.', 'DatabaseModule');
            });
            return connection;
          },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Crop.name, schema: CropSchema },
      { name: Market.name, schema: MarketSchema },
      { name: MandiPrice.name, schema: MandiPriceSchema },
      { name: CropLot.name, schema: CropLotSchema },
      { name: Bid.name, schema: BidSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, MongooseModule],
})
export class DatabaseModule {}
