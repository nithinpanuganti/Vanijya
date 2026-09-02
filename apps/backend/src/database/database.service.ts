import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Db, GridFSBucket, ClientSession, Collection, IndexSpecification } from 'mongodb';
import * as bcrypt from 'bcrypt';
import { COLLECTIONS, DB_NAME } from './database.constants';
import {
  Role,
  VerificationStatus,
  ApprovalStatus,
  CropLotStatus,
  BidStatus,
  PriceSource,
  QualityGrade,
  CropUnit,
  AuditAction,
  NotificationType,
} from './enums';
import {
  UserEntity,
  CropEntity,
  MarketEntity,
  MandiPriceEntity,
  CropLotEntity,
  BidEntity,
  NotificationEntity,
  AuditLogEntity,
} from './types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private gridFSBucket: GridFSBucket | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to MongoDB using the official native Node.js driver
   */
  async connect() {
    const uri = this.configService.get<string>('MONGODB_URI') || process.env.MONGODB_URI;

    if (!uri || uri.trim() === '') {
      const errorMsg =
        'MONGODB_URI is not configured. Create apps/backend/.env from .env.example and provide a valid MongoDB connection string.';
      this.logger.error(`\n❌ [Database Configuration Error]\n${errorMsg}\n`);
      throw new Error(errorMsg);
    }

    this.logger.log('🍃 Connecting to MongoDB with official native driver...');

    try {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      await this.client.connect();
      this.db = this.client.db();
      this.gridFSBucket = new GridFSBucket(this.db, {
        bucketName: 'profile_photos',
      });
      this.isConnected = true;

      this.logger.log('🍃 MongoDB connected successfully via official native driver.');

      // Ensure all collection indexes
      await this.ensureIndexes();

      // Seed initial data if empty
      await this.seedInitialData();
    } catch (err: any) {
      this.isConnected = false;
      this.logger.error(`❌ MongoDB connection failed: ${err.message || err}. Ensure your MongoDB service is running.`);
      throw err;
    }
  }

  /**
   * Graceful disconnection on shutdown
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
        this.isConnected = false;
        this.logger.log('🍃 MongoDB client disconnected.');
      } catch (err: any) {
        this.logger.warn(`Error closing MongoDB client: ${err.message}`);
      }
    }
  }

  /**
   * Check connection health
   */
  isHealthy(): boolean {
    return this.isConnected && this.client !== null && this.db !== null;
  }

  /**
   * Get typed native collection
   */
  getCollection<T = any>(collectionName: string): Collection<T> {
    if (!this.db) {
      throw new Error('Database is not connected. Ensure MongoDB is running and MONGODB_URI is valid.');
    }
    return this.db.collection<T>(collectionName);
  }

  /**
   * Get native GridFSBucket for profile photo streaming
   */
  getGridFSBucket(): GridFSBucket {
    if (!this.gridFSBucket) {
      if (!this.db) {
        throw new Error('Database is not connected.');
      }
      this.gridFSBucket = new GridFSBucket(this.db, { bucketName: 'profile_photos' });
    }
    return this.gridFSBucket;
  }

  /**
   * Execute atomic transactions using MongoDB sessions
   */
  async withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    if (!this.client) {
      throw new Error('MongoDB client is not connected.');
    }

    const session = this.client.startSession();
    try {
      let result: T;
      try {
        await session.withTransaction(async () => {
          result = await work(session);
        });
        return result!;
      } catch (txnError: any) {
        // If standalone MongoDB instance without replica set doesn't support sessions/transactions,
        // execute directly as single-node fallback
        if (
          txnError.message &&
          (txnError.message.includes('Transaction numbers are only allowed on a replica set') ||
            txnError.message.includes('Standalone'))
        ) {
          this.logger.warn('Running without replica set transaction support (single node). Executing operations sequentially.');
          return await work(session);
        }
        throw txnError;
      }
    } finally {
      await session.endSession();
    }
  }

  /**
   * Creates required MongoDB indexes (geospatial 2dsphere, unique constraints, and query indexes)
   */
  async ensureIndexes() {
    if (!this.db) return;

    try {
      // 1. Users Indexes
      const usersCol = this.getCollection(COLLECTIONS.USERS);
      await usersCol.createIndex({ phone: 1 }, { unique: true, sparse: true });
      await usersCol.createIndex({ email: 1 }, { unique: true, sparse: true });
      await usersCol.createIndex({ role: 1 });
      await usersCol.createIndex({ approvalStatus: 1 });
      await usersCol.createIndex({ geoPoint: '2dsphere' }, { sparse: true });

      // 2. Crops Indexes
      const cropsCol = this.getCollection(COLLECTIONS.CROPS);
      await cropsCol.createIndex({ name: 1 }, { unique: true });
      await cropsCol.createIndex({ category: 1 });

      // 3. Markets Indexes
      const marketsCol = this.getCollection(COLLECTIONS.MARKETS);
      await marketsCol.createIndex({ geoPoint: '2dsphere' });
      await marketsCol.createIndex({ district: 1, state: 1 });

      // 4. Mandi Prices Indexes
      const pricesCol = this.getCollection(COLLECTIONS.MANDI_PRICES);
      await pricesCol.createIndex({ cropId: 1, marketId: 1, date: -1 });
      await pricesCol.createIndex({ state: 1, district: 1 });

      // 5. Crop Lots Indexes
      const lotsCol = this.getCollection(COLLECTIONS.CROP_LOTS);
      await lotsCol.createIndex({ farmerId: 1 });
      await lotsCol.createIndex({ cropId: 1 });
      await lotsCol.createIndex({ status: 1 });
      await lotsCol.createIndex({ createdAt: -1 });

      // 6. Bids Indexes
      const bidsCol = this.getCollection(COLLECTIONS.BIDS);
      await bidsCol.createIndex({ lotId: 1 });
      await bidsCol.createIndex({ buyerId: 1 });
      await bidsCol.createIndex({ status: 1 });
      await bidsCol.createIndex({ createdAt: -1 });

      // 7. Transactions Indexes
      const txCol = this.getCollection(COLLECTIONS.TRANSACTIONS);
      await txCol.createIndex({ lotId: 1 }, { unique: true });
      await txCol.createIndex({ farmerId: 1 });
      await txCol.createIndex({ buyerId: 1 });
      await txCol.createIndex({ status: 1 });

      // 8. Payments Indexes
      const payCol = this.getCollection(COLLECTIONS.PAYMENTS);
      await payCol.createIndex({ transactionId: 1 }, { unique: true });
      await payCol.createIndex({ status: 1 });

      // 9. Notifications Indexes
      const notifsCol = this.getCollection(COLLECTIONS.NOTIFICATIONS);
      await notifsCol.createIndex({ recipientId: 1, isRead: 1 });
      await notifsCol.createIndex({ createdAt: -1 });

      // 10. Audit Logs Indexes
      const auditCol = this.getCollection(COLLECTIONS.AUDIT_LOGS);
      await auditCol.createIndex({ actorId: 1 });
      await auditCol.createIndex({ entityId: 1 });
      await auditCol.createIndex({ timestamp: -1 });

      this.logger.log('⚡ MongoDB native indexes verified successfully.');
    } catch (err: any) {
      this.logger.warn(`Index verification note: ${err.message}`);
    }
  }

  /**
   * Seed initial dataset if database is empty
   */
  async seedInitialData() {
    if (!this.db) return;

    try {
      const usersCol = this.getCollection<UserEntity>(COLLECTIONS.USERS);
      const count = await usersCol.countDocuments();
      if (count > 0) {
        return;
      }

      this.logger.log('🌱 Seeding initial MongoDB dataset for fresh environment...');

      const defaultHash = await bcrypt.hash('Farmer@123', 10);
      const buyerHash = await bcrypt.hash('asdfcv321', 10);
      const adminHash = await bcrypt.hash('Admin@123', 10);

      // 1. Seed Users
      const usersData: UserEntity[] = [
        {
          _id: 'usr-farmer-1',
          name: 'Ramesh Patel',
          phone: '9876543210',
          email: 'ramesh.patel@farmer.in',
          passwordHash: defaultHash,
          role: Role.FARMER,
          verificationStatus: VerificationStatus.VERIFIED,
          approvalStatus: ApprovalStatus.APPROVED,
          rejectionReason: null,
          approvedBy: 'usr-admin-1',
          approvedAt: new Date(Date.now() - 86400000 * 30),
          profilePhoto: {
            url: '/images/avatars/farmer-ramesh.svg',
            mimeType: 'image/svg+xml',
            sizeBytes: 1024,
          },
          location: 'Village Pimpalgaon, Niphad Taluka, Nashik',
          geoPoint: {
            type: 'Point',
            coordinates: [73.9854, 20.1718],
          },
          district: 'Nashik',
          state: 'Maharashtra',
          village: 'Pimpalgaon Baswant',
          primaryCrop: 'Tomato',
          farmSize: 5.5,
          preferredLanguage: 'hi',
          kccNumber: 'KCC-MH-NSK-8821',
          apmcLicense: 'APMC-NSK-FMR-1042',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'usr-farmer-2',
          name: 'Gurpreet Singh',
          phone: '9876543211',
          email: 'gurpreet.singh@farmer.in',
          passwordHash: defaultHash,
          role: Role.FARMER,
          verificationStatus: VerificationStatus.VERIFIED,
          approvalStatus: ApprovalStatus.APPROVED,
          rejectionReason: null,
          approvedBy: 'usr-admin-1',
          approvedAt: new Date(Date.now() - 86400000 * 20),
          profilePhoto: {
            url: '/images/avatars/farmer-gurpreet.svg',
            mimeType: 'image/svg+xml',
            sizeBytes: 1024,
          },
          location: 'VPO Khanna, Ludhiana District',
          geoPoint: {
            type: 'Point',
            coordinates: [76.2167, 30.7046],
          },
          district: 'Ludhiana',
          state: 'Punjab',
          village: 'Khanna',
          primaryCrop: 'Wheat',
          farmSize: 12.0,
          preferredLanguage: 'en',
          kccNumber: 'KCC-PB-LDH-4412',
          apmcLicense: 'APMC-LDH-FMR-0981',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'usr-buyer-1',
          name: 'FreshCart Agro Ltd. (Praveen Kumar)',
          phone: '9876543212',
          email: 'buyer@freshcart.com',
          passwordHash: buyerHash,
          role: Role.BUYER,
          verificationStatus: VerificationStatus.VERIFIED,
          approvalStatus: ApprovalStatus.APPROVED,
          rejectionReason: null,
          approvedBy: 'usr-admin-1',
          approvedAt: new Date(Date.now() - 86400000 * 25),
          profilePhoto: {
            url: '/images/avatars/buyer-freshcart.svg',
            mimeType: 'image/svg+xml',
            sizeBytes: 1024,
          },
          location: 'Vashi APMC Complex, Navi Mumbai',
          geoPoint: {
            type: 'Point',
            coordinates: [73.0033, 19.076],
          },
          district: 'Mumbai',
          state: 'Maharashtra',
          organization: 'FreshCart Agro Limited',
          contactPerson: 'Praveen Kumar',
          businessType: 'Wholesale Food Processor',
          warehouseLocation: 'Vashi APMC Sector 19, Navi Mumbai',
          gstin: '27AABCU9603R1ZM',
          fssai: '10019022009876',
          apmcLicense: 'APMC-VSH-BYR-550',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'usr-buyer-2',
          name: 'GreenSpire Foods Pvt Ltd (Ananya Sharma)',
          phone: '9876543213',
          email: 'procurement@greenspire.in',
          passwordHash: buyerHash,
          role: Role.BUYER,
          verificationStatus: VerificationStatus.VERIFIED,
          approvalStatus: ApprovalStatus.APPROVED,
          rejectionReason: null,
          approvedBy: 'usr-admin-1',
          approvedAt: new Date(Date.now() - 86400000 * 15),
          profilePhoto: {
            url: '/images/avatars/buyer-greenspire.svg',
            mimeType: 'image/svg+xml',
            sizeBytes: 1024,
          },
          location: 'Bawana Industrial Area, Sector 2, Delhi',
          geoPoint: {
            type: 'Point',
            coordinates: [77.0505, 28.7952],
          },
          district: 'North Delhi',
          state: 'Delhi',
          organization: 'GreenSpire Foods Private Limited',
          contactPerson: 'Ananya Sharma',
          businessType: 'Institutional Supply & Retail Chain',
          warehouseLocation: 'Azadpur Terminal Yard C, Delhi',
          gstin: '07AAECG4412Q1Z8',
          fssai: '10021011003421',
          apmcLicense: 'APMC-AZD-BYR-112',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'usr-admin-1',
          name: 'Vanijya System Admin',
          phone: '9876543214',
          email: 'admin@vanijya.gov.in',
          passwordHash: adminHash,
          role: Role.ADMIN,
          verificationStatus: VerificationStatus.VERIFIED,
          approvalStatus: ApprovalStatus.APPROVED,
          rejectionReason: null,
          approvedBy: 'SYSTEM',
          approvedAt: new Date(Date.now() - 86400000 * 60),
          profilePhoto: {
            url: '/images/avatars/admin-system.svg',
            mimeType: 'image/svg+xml',
            sizeBytes: 1024,
          },
          location: 'Krishi Bhawan, Dr. Rajendra Prasad Road, New Delhi',
          district: 'New Delhi',
          state: 'Delhi',
          organization: 'Ministry of Agriculture & Farmers Welfare',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await usersCol.insertMany(usersData);

      // 2. Seed Crops
      const cropsCol = this.getCollection<CropEntity>(COLLECTIONS.CROPS);
      const cropsData: CropEntity[] = [
        { _id: 'crop-tomato', name: 'Tomato', hindiName: 'टमाटर', category: 'Vegetables', baseUnit: CropUnit.QUINTAL, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'crop-onion', name: 'Onion', hindiName: 'प्याज', category: 'Vegetables', baseUnit: CropUnit.QUINTAL, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'crop-potato', name: 'Potato', hindiName: 'आलू', category: 'Vegetables', baseUnit: CropUnit.QUINTAL, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'crop-wheat', name: 'Wheat', hindiName: 'गेहूं', category: 'Cereals & Grains', baseUnit: CropUnit.QUINTAL, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'crop-rice', name: 'Rice (Basmati)', hindiName: 'चावल (बासमती)', category: 'Cereals & Grains', baseUnit: CropUnit.QUINTAL, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'crop-cotton', name: 'Cotton', hindiName: 'कपास', category: 'Commercial Crops', baseUnit: CropUnit.QUINTAL, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'crop-soybean', name: 'Soybean', hindiName: 'सोयाबीन', category: 'Oilseeds', baseUnit: CropUnit.QUINTAL, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'crop-maize', name: 'Maize', hindiName: 'मक्का', category: 'Coarse Cereals', baseUnit: CropUnit.QUINTAL, createdAt: new Date(), updatedAt: new Date() },
      ];
      await cropsCol.insertMany(cropsData);

      // 3. Seed Markets
      const marketsCol = this.getCollection<MarketEntity>(COLLECTIONS.MARKETS);
      const marketsData: MarketEntity[] = [
        {
          _id: 'mkt-nashik',
          name: 'Pimpalgaon Baswant APMC',
          district: 'Nashik',
          state: 'Maharashtra',
          latitude: 20.1718,
          longitude: 73.9854,
          location: { type: 'Point', coordinates: [73.9854, 20.1718] },
          isApmc: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'mkt-lasalgaon',
          name: 'Lasalgaon Main APMC',
          district: 'Nashik',
          state: 'Maharashtra',
          latitude: 20.1472,
          longitude: 74.2281,
          location: { type: 'Point', coordinates: [74.2281, 20.1472] },
          isApmc: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'mkt-vashi',
          name: 'Vashi Wholesale APMC',
          district: 'Mumbai Suburban',
          state: 'Maharashtra',
          latitude: 19.076,
          longitude: 73.0033,
          location: { type: 'Point', coordinates: [73.0033, 19.076] },
          isApmc: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'mkt-azadpur',
          name: 'Azadpur National Mandi',
          district: 'North Delhi',
          state: 'Delhi',
          latitude: 28.7041,
          longitude: 77.1025,
          location: { type: 'Point', coordinates: [77.1025, 28.7041] },
          isApmc: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'mkt-khanna',
          name: 'Khanna Grain Market',
          district: 'Ludhiana',
          state: 'Punjab',
          latitude: 30.7046,
          longitude: 76.2167,
          location: { type: 'Point', coordinates: [76.2167, 30.7046] },
          isApmc: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await marketsCol.insertMany(marketsData);

      // 4. Seed Mandi Prices
      const pricesCol = this.getCollection<MandiPriceEntity>(COLLECTIONS.MANDI_PRICES);
      const pricesData: MandiPriceEntity[] = [
        { _id: 'prc-1', cropId: 'crop-tomato', marketId: 'mkt-nashik', district: 'Nashik', state: 'Maharashtra', minPrice: 1950, maxPrice: 2450, modalPrice: 2200, arrivalQuantity: 450, priceDate: new Date(), source: PriceSource.MOCK, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'prc-2', cropId: 'crop-tomato', marketId: 'mkt-vashi', district: 'Mumbai Suburban', state: 'Maharashtra', minPrice: 2400, maxPrice: 2900, modalPrice: 2650, arrivalQuantity: 820, priceDate: new Date(), source: PriceSource.MOCK, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'prc-3', cropId: 'crop-onion', marketId: 'mkt-lasalgaon', district: 'Nashik', state: 'Maharashtra', minPrice: 1400, maxPrice: 1850, modalPrice: 1650, arrivalQuantity: 1200, priceDate: new Date(), source: PriceSource.MOCK, createdAt: new Date(), updatedAt: new Date() },
        { _id: 'prc-4', cropId: 'crop-wheat', marketId: 'mkt-khanna', district: 'Ludhiana', state: 'Punjab', minPrice: 2275, maxPrice: 2450, modalPrice: 2350, arrivalQuantity: 3400, priceDate: new Date(), source: PriceSource.MOCK, createdAt: new Date(), updatedAt: new Date() },
      ];
      await pricesCol.insertMany(pricesData);

      // 5. Seed Lots
      const lotsCol = this.getCollection<CropLotEntity>(COLLECTIONS.CROP_LOTS);
      const lotsData: CropLotEntity[] = [
        {
          _id: 'lot-demo-1',
          farmerId: 'usr-farmer-1',
          cropId: 'crop-tomato',
          quantity: 100,
          unit: CropUnit.QUINTAL,
          expectedPrice: 2200,
          qualityGrade: QualityGrade.GRADE_A,
          district: 'Nashik',
          state: 'Maharashtra',
          location: 'Pimpalgaon Baswant, Nashik',
          harvestDate: new Date(),
          status: CropLotStatus.BIDDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'lot-demo-2',
          farmerId: 'usr-farmer-2',
          cropId: 'crop-wheat',
          quantity: 250,
          unit: CropUnit.QUINTAL,
          expectedPrice: 2350,
          qualityGrade: QualityGrade.GRADE_A,
          district: 'Ludhiana',
          state: 'Punjab',
          location: 'Khanna, Ludhiana',
          harvestDate: new Date(),
          status: CropLotStatus.OPEN,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await lotsCol.insertMany(lotsData);

      // 6. Seed Bid
      const bidsCol = this.getCollection<BidEntity>(COLLECTIONS.BIDS);
      const bidsData: BidEntity[] = [
        {
          _id: 'bid-demo-1',
          lotId: 'lot-demo-1',
          buyerId: 'usr-buyer-1',
          amount: 2250,
          quantity: 100,
          status: BidStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await bidsCol.insertMany(bidsData);

      // 7. Seed Notifications
      const notifsCol = this.getCollection<NotificationEntity>(COLLECTIONS.NOTIFICATIONS);
      const notifsData: NotificationEntity[] = [
        {
          _id: 'notif-demo-1',
          recipientId: 'usr-farmer-1',
          type: NotificationType.BID_RECEIVED,
          title: 'New Bid Received for Tomato Lot',
          message: 'FreshCart Agro Ltd. has placed a bid of ₹2,250/Quintal for 100 Quintals.',
          entityType: 'LOT',
          entityId: 'lot-demo-1',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      await notifsCol.insertMany(notifsData);

      // 8. Seed Audit Log
      const auditCol = this.getCollection<AuditLogEntity>(COLLECTIONS.AUDIT_LOGS);
      const auditData: AuditLogEntity[] = [
        {
          _id: 'audit-demo-1',
          actorId: 'usr-admin-1',
          action: AuditAction.USER_APPROVED,
          metadata: { systemInit: true, message: 'Vanijya system initialized and verified demo accounts.' },
          timestamp: new Date(),
          createdAt: new Date(),
        },
      ];
      await auditCol.insertMany(auditData);

      this.logger.log('✅ MongoDB initial dataset seeded successfully via native driver.');
    } catch (err: any) {
      this.logger.error(`Failed to seed MongoDB initial data: ${err.message}`);
    }
  }
}
