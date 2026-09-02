import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { BidsService } from './bids.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import {
  Bid,
  CropLot,
  Crop,
  User,
  Transaction,
  Payment,
  BidStatus,
  CropLotStatus,
  Role,
  AuditAction,
  NotificationType,
} from '../database/schemas';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('BidsService', () => {
  let service: BidsService;
  let audit: AuditService;

  const mockBidModel = {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      lean: jest.fn().mockResolvedValue([]),
    }),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
  };

  const mockCropLotModel = {
    findById: jest.fn(),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      lean: jest.fn().mockResolvedValue([]),
    }),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
  };

  const mockUserModel = {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'usr-buyer-1',
        name: 'FreshCart Agro Ltd.',
        role: Role.BUYER,
        district: 'Mumbai',
        state: 'Maharashtra',
      }),
    }),
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockCropModel = {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'crop-tomato',
        name: 'Tomato',
        category: 'Vegetables',
      }),
    }),
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockTransactionModel = {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockPaymentModel = {
    create: jest.fn(),
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockConnection = {
    startSession: jest.fn().mockResolvedValue(null),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    getRecent: jest.fn().mockResolvedValue([]),
  };

  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  const mockUsersService = {
    getProfile: jest.fn().mockResolvedValue({
      id: 'buyer-1',
      name: 'FreshCart Agro Ltd.',
      role: 'BUYER',
      district: 'Mumbai',
      state: 'Maharashtra',
      location: 'Vashi APMC',
      organization: 'FreshCart Agro Ltd',
      profileCompletionStatus: 'COMPLETE',
      profileCompletionPercentage: 100,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidsService,
        { provide: getModelToken(Bid.name), useValue: mockBidModel },
        { provide: getModelToken(CropLot.name), useValue: mockCropLotModel },
        { provide: getModelToken(Crop.name), useValue: mockCropModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Transaction.name), useValue: mockTransactionModel },
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<BidsService>(BidsService);
    audit = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBid', () => {
    it('should reject self-bidding (farmer bidding on own lot)', async () => {
      mockCropLotModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'lot-1',
          farmerId: 'farmer-1',
          status: CropLotStatus.OPEN,
          quantity: 50,
        }),
      });

      await expect(
        service.createBid('lot-1', 'farmer-1', { price: 2300, quantity: 50 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bids with quantity exceeding lot available limit', async () => {
      mockCropLotModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'lot-1',
          farmerId: 'farmer-1',
          status: CropLotStatus.OPEN,
          quantity: 50,
          unit: 'QUINTAL',
        }),
      });

      await expect(
        service.createBid('lot-1', 'buyer-1', { price: 2300, quantity: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bids on already SOLD lots', async () => {
      mockCropLotModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'lot-1',
          farmerId: 'farmer-1',
          status: CropLotStatus.SOLD,
          quantity: 50,
        }),
      });

      await expect(
        service.createBid('lot-1', 'buyer-1', { price: 2300, quantity: 50 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject bids if buyer profile is incomplete', async () => {
      mockUsersService.getProfile.mockResolvedValueOnce({
        id: 'buyer-2',
        name: 'Incomplete Buyer',
        role: 'BUYER',
        district: null,
        state: null,
        location: null,
        organization: null,
        profileCompletionStatus: 'INCOMPLETE',
        missingFields: ['district', 'state', 'location', 'organization'],
      });

      await expect(
        service.createBid('lot-1', 'buyer-2', { price: 2300, quantity: 50 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('modifyBidQuantity', () => {
    it('should reject modification from non-owner buyer', async () => {
      mockBidModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          status: BidStatus.PENDING,
          lotId: 'lot-1',
        }),
      });

      await expect(
        service.modifyBidQuantity('bid-1', 'buyer-2', Role.BUYER, 60),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject quantity modification exceeding available lot quantity', async () => {
      mockBidModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          quantity: 80,
          status: BidStatus.PENDING,
          lotId: 'lot-1',
        }),
      });
      mockCropLotModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'lot-1',
          quantity: 100,
          unit: 'QUINTAL',
          farmerId: 'farmer-1',
        }),
      });

      await expect(
        service.modifyBidQuantity('bid-1', 'buyer-1', Role.BUYER, 120),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject modification of non-pending bids', async () => {
      mockBidModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          quantity: 80,
          status: BidStatus.ACCEPTED,
          lotId: 'lot-1',
        }),
      });

      await expect(
        service.modifyBidQuantity('bid-1', 'buyer-1', Role.BUYER, 60),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow valid quantity reduction and update bid', async () => {
      mockBidModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          lotId: 'lot-1',
          quantity: 80,
          price: 2250,
          status: BidStatus.PENDING,
        }),
      });
      mockCropLotModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'lot-1',
          quantity: 100,
          unit: 'QUINTAL',
          farmerId: 'farmer-1',
          cropId: 'crop-1',
        }),
      });
      mockBidModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          quantity: 60,
          price: 2250,
          status: BidStatus.PENDING,
        }),
      });

      const updated = await service.modifyBidQuantity('bid-1', 'buyer-1', Role.BUYER, 60);
      expect(updated.quantity).toBe(60);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.BID_MODIFIED,
          previousQuantity: 80,
          newQuantity: 60,
        }),
      );
    });
  });

  describe('cancelBid', () => {
    it('should reject cancellation by unauthorized user', async () => {
      mockBidModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          status: BidStatus.PENDING,
          lotId: 'lot-1',
        }),
      });

      await expect(
        service.cancelBid('bid-1', 'other-buyer', Role.BUYER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject cancellation of an already accepted bid', async () => {
      mockBidModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          status: BidStatus.ACCEPTED,
          lotId: 'lot-1',
        }),
      });

      await expect(
        service.cancelBid('bid-1', 'buyer-1', Role.BUYER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark pending bid as WITHDRAWN and log audit record and notify farmer', async () => {
      mockBidModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          lotId: 'lot-1',
          price: 2250,
          quantity: 100,
          status: BidStatus.PENDING,
        }),
      });
      mockCropLotModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'lot-1',
          farmerId: 'farmer-1',
          unit: 'QUINTAL',
          cropId: 'crop-1',
        }),
      });
      mockBidModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          buyerId: 'buyer-1',
          status: BidStatus.WITHDRAWN,
        }),
      });

      const result = await service.cancelBid('bid-1', 'buyer-1', Role.BUYER);
      expect(result.status).toBe(BidStatus.WITHDRAWN);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.BID_CANCELLED,
        }),
      );
    });
  });

  describe('acceptBid', () => {
    it('should cleanly accept bid and create transaction without circular JSON references', async () => {
      mockBidModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'bid-1',
          lotId: 'lot-1',
          buyerId: 'buyer-1',
          price: 2250,
          quantity: 100,
          status: BidStatus.PENDING,
        }),
      });
      mockCropLotModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'lot-1',
          farmerId: 'farmer-1',
          status: CropLotStatus.BIDDING,
          quantity: 100,
          unit: 'QUINTAL',
          cropId: 'crop-1',
        }),
      });
      mockBidModel.findByIdAndUpdate.mockResolvedValue({});
      mockCropLotModel.findByIdAndUpdate.mockResolvedValue({});
      mockBidModel.updateMany.mockResolvedValue({});
      mockTransactionModel.create.mockResolvedValue({
        _id: 'txn-1',
        lotId: 'lot-1',
        bidId: 'bid-1',
        farmerId: 'farmer-1',
        buyerId: 'buyer-1',
        agreedPrice: 2250,
        quantity: 100,
        totalAmount: 225000,
        status: 'COMPLETED',
        toObject: () => ({
          _id: 'txn-1',
          lotId: 'lot-1',
          bidId: 'bid-1',
          farmerId: 'farmer-1',
          buyerId: 'buyer-1',
          agreedPrice: 2250,
          quantity: 100,
          totalAmount: 225000,
          status: 'COMPLETED',
        }),
      });
      mockPaymentModel.create.mockResolvedValue({
        _id: 'pay-1',
        transactionId: 'txn-1',
        amount: 225000,
        status: 'PAID',
        paymentReference: 'VNJ-UPI-123',
        toObject: () => ({
          _id: 'pay-1',
          transactionId: 'txn-1',
          amount: 225000,
          status: 'PAID',
          paymentReference: 'VNJ-UPI-123',
        }),
      });

      const result = await service.acceptBid('bid-1', 'farmer-1', Role.FARMER);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('transaction');

      // Crucial verification: Must be 100% serializable by JSON.stringify without circular reference errors
      expect(() => JSON.stringify(result)).not.toThrow();
      expect(() => JSON.stringify(result.transaction)).not.toThrow();
    });
  });
});
