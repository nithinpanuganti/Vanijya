import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserDocument,
  Crop,
  CropDocument,
  Market,
  MarketDocument,
  MandiPrice,
  MandiPriceDocument,
  CropLot,
  CropLotDocument,
  Bid,
  BidDocument,
  Transaction,
  TransactionDocument,
  Payment,
  PaymentDocument,
  Notification,
  NotificationDocument,
  AuditLog,
  AuditLogDocument,
  Role,
  VerificationStatus,
  ApprovalStatus,
  CropLotStatus,
  BidStatus,
  TransactionStatus,
  PaymentStatus,
  PriceSource,
  QualityGrade,
  CropUnit,
  AuditAction,
  NotificationType,
} from './schemas';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  public isConnected = false;

  constructor(
    @InjectConnection() public readonly connection: Connection,
    @InjectModel(User.name) public readonly userModel: Model<UserDocument>,
    @InjectModel(Crop.name) public readonly cropModel: Model<CropDocument>,
    @InjectModel(Market.name) public readonly marketModel: Model<MarketDocument>,
    @InjectModel(MandiPrice.name) public readonly mandiPriceModel: Model<MandiPriceDocument>,
    @InjectModel(CropLot.name) public readonly cropLotModel: Model<CropLotDocument>,
    @InjectModel(Bid.name) public readonly bidModel: Model<BidDocument>,
    @InjectModel(Transaction.name) public readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Payment.name) public readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Notification.name) public readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(AuditLog.name) public readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async onModuleInit() {
    this.connection.on('connected', async () => {
      this.isConnected = true;
      this.logger.log('🍃 MongoDB connection established.');
      await this.seedInitialData();
    });

    this.connection.on('error', (err) => {
      this.isConnected = false;
      this.logger.error(`❌ MongoDB connection error: ${err.message}`);
    });

    this.connection.on('disconnected', () => {
      this.isConnected = false;
      this.logger.warn('⚠️ MongoDB disconnected.');
    });

    if (this.connection.readyState === 1) {
      this.isConnected = true;
      await this.seedInitialData();
    }
  }

  /**
   * Seeds demo data (Farmers, Buyers, Admin, Crops, Markets, MandiPrices, Lots, Bids, Transactions, Payments, Notifications, AuditLogs)
   */
  async seedInitialData() {
    try {
      const userCount = await this.userModel.countDocuments();
      if (userCount > 0) {
        this.logger.log('Database already contains records. Skipping seed.');
        return;
      }

      this.logger.log('🌱 Seeding initial MongoDB dataset for fresh environment...');

      const defaultHash = await bcrypt.hash('Farmer@123', 10);
      const buyerHash = await bcrypt.hash('asdfcv321', 10);
      const adminHash = await bcrypt.hash('Admin@123', 10);

      // 1. Seed Users
      const usersData: Partial<User>[] = [
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
            size: 1024,
            uploadedAt: new Date(),
          },
          location: 'Village Pimpalgaon, Niphad Taluka, Nashik',
          geoPoint: {
            type: 'Point',
            coordinates: [73.9854, 20.1718], // [lng, lat]
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
            size: 1024,
            uploadedAt: new Date(),
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
            size: 1024,
            uploadedAt: new Date(),
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
            size: 1024,
            uploadedAt: new Date(),
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
            size: 1024,
            uploadedAt: new Date(),
          },
          location: 'Krishi Bhawan, Dr. Rajendra Prasad Road, New Delhi',
          district: 'New Delhi',
          state: 'Delhi',
          organization: 'Ministry of Agriculture & Farmers Welfare',
          isVerified: true,
        },
      ];

      await this.userModel.insertMany(usersData);

      // 2. Seed Crops
      const cropsData: Partial<Crop>[] = [
        { _id: 'crop-tomato', name: 'Tomato', category: 'Vegetables', defaultUnit: CropUnit.QUINTAL },
        { _id: 'crop-onion', name: 'Onion', category: 'Vegetables', defaultUnit: CropUnit.QUINTAL },
        { _id: 'crop-potato', name: 'Potato', category: 'Vegetables', defaultUnit: CropUnit.QUINTAL },
        { _id: 'crop-wheat', name: 'Wheat', category: 'Cereals & Grains', defaultUnit: CropUnit.QUINTAL },
        { _id: 'crop-rice', name: 'Rice (Basmati)', category: 'Cereals & Grains', defaultUnit: CropUnit.QUINTAL },
        { _id: 'crop-cotton', name: 'Cotton', category: 'Commercial Crops', defaultUnit: CropUnit.QUINTAL },
        { _id: 'crop-soybean', name: 'Soybean', category: 'Oilseeds', defaultUnit: CropUnit.QUINTAL },
        { _id: 'crop-maize', name: 'Maize', category: 'Coarse Cereals', defaultUnit: CropUnit.QUINTAL },
      ];
      await this.cropModel.insertMany(cropsData);

      // 3. Seed Markets
      const marketsData: Partial<Market>[] = [
        {
          _id: 'mkt-nashik',
          name: 'Pimpalgaon Baswant APMC',
          district: 'Nashik',
          state: 'Maharashtra',
          latitude: 20.1718,
          longitude: 73.9854,
          geoPoint: { type: 'Point', coordinates: [73.9854, 20.1718] },
        },
        {
          _id: 'mkt-lasalgaon',
          name: 'Lasalgaon Main APMC',
          district: 'Nashik',
          state: 'Maharashtra',
          latitude: 20.1472,
          longitude: 74.2281,
          geoPoint: { type: 'Point', coordinates: [74.2281, 20.1472] },
        },
        {
          _id: 'mkt-vashi',
          name: 'Vashi Wholesale APMC',
          district: 'Mumbai Suburban',
          state: 'Maharashtra',
          latitude: 19.076,
          longitude: 73.0033,
          geoPoint: { type: 'Point', coordinates: [73.0033, 19.076] },
        },
        {
          _id: 'mkt-azadpur',
          name: 'Azadpur National Mandi',
          district: 'North Delhi',
          state: 'Delhi',
          latitude: 28.7041,
          longitude: 77.1025,
          geoPoint: { type: 'Point', coordinates: [77.1025, 28.7041] },
        },
        {
          _id: 'mkt-khanna',
          name: 'Khanna Grain Market',
          district: 'Ludhiana',
          state: 'Punjab',
          latitude: 30.7046,
          longitude: 76.2167,
          geoPoint: { type: 'Point', coordinates: [76.2167, 30.7046] },
        },
      ];
      await this.marketModel.insertMany(marketsData);

      // 4. Seed Mandi Prices
      const pricesData: Partial<MandiPrice>[] = [
        { _id: 'prc-1', cropId: 'crop-tomato', marketId: 'mkt-nashik', minPrice: 1950, maxPrice: 2450, modalPrice: 2200, arrivalQuantity: 450, date: new Date(), source: PriceSource.MOCK },
        { _id: 'prc-2', cropId: 'crop-tomato', marketId: 'mkt-vashi', minPrice: 2400, maxPrice: 2900, modalPrice: 2650, arrivalQuantity: 820, date: new Date(), source: PriceSource.MOCK },
        { _id: 'prc-3', cropId: 'crop-onion', marketId: 'mkt-lasalgaon', minPrice: 1400, maxPrice: 1850, modalPrice: 1650, arrivalQuantity: 1200, date: new Date(), source: PriceSource.MOCK },
        { _id: 'prc-4', cropId: 'crop-wheat', marketId: 'mkt-khanna', minPrice: 2275, maxPrice: 2450, modalPrice: 2350, arrivalQuantity: 3400, date: new Date(), source: PriceSource.MOCK },
      ];
      await this.mandiPriceModel.insertMany(pricesData);

      // 5. Seed Lots
      const lotsData: Partial<CropLot>[] = [
        {
          _id: 'lot-demo-1',
          farmerId: 'usr-farmer-1',
          cropId: 'crop-tomato',
          quantity: 100,
          unit: 'QUINTAL',
          expectedPrice: 2200,
          qualityGrade: QualityGrade.GRADE_A,
          location: 'Pimpalgaon Baswant, Nashik',
          geoPoint: { type: 'Point', coordinates: [73.9854, 20.1718] },
          status: CropLotStatus.BIDDING,
        },
        {
          _id: 'lot-demo-2',
          farmerId: 'usr-farmer-2',
          cropId: 'crop-wheat',
          quantity: 250,
          unit: 'QUINTAL',
          expectedPrice: 2350,
          qualityGrade: QualityGrade.GRADE_A,
          location: 'Khanna, Ludhiana',
          geoPoint: { type: 'Point', coordinates: [76.2167, 30.7046] },
          status: CropLotStatus.OPEN,
        },
      ];
      await this.cropLotModel.insertMany(lotsData);

      // 6. Seed Bid
      const bidsData: Partial<Bid>[] = [
        {
          _id: 'bid-demo-1',
          lotId: 'lot-demo-1',
          buyerId: 'usr-buyer-1',
          price: 2250,
          quantity: 100,
          message: 'Direct procurement for supermarket supply chain.',
          status: BidStatus.PENDING,
        },
      ];
      await this.bidModel.insertMany(bidsData);

      // 7. Seed Notifications
      const notifsData: Partial<Notification>[] = [
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
        },
      ];
      await this.notificationModel.insertMany(notifsData);

      // 8. Seed Audit Log
      const auditData: Partial<AuditLog>[] = [
        {
          _id: 'audit-demo-1',
          actorId: 'usr-admin-1',
          actorRole: 'ADMIN',
          action: AuditAction.USER_APPROVED,
          metadata: { systemInit: true, message: 'Vanijya system initialized and verified demo accounts.' },
          timestamp: new Date(),
        },
      ];
      await this.auditLogModel.insertMany(auditData);

      this.logger.log('✅ MongoDB initial dataset seeded successfully.');
    } catch (err: any) {
      this.logger.error(`Failed to seed MongoDB initial data: ${err.message}`);
    }
  }
}
