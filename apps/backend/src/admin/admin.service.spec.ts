import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  User,
  CropLot,
  Crop,
  Bid,
  Transaction,
  Payment,
  AuditLog,
  Role,
  ApprovalStatus,
  VerificationStatus,
  AuditAction,
  NotificationType,
} from '../database/schemas';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AdminService (Registration Verification Workflow)', () => {
  let service: AdminService;
  let auditService: AuditService;
  let notificationsService: NotificationsService;

  const mockUserModel = {
    countDocuments: jest.fn().mockResolvedValue(2),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      lean: jest.fn().mockResolvedValue([]),
    }),
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'usr-farmer-new',
        name: 'New Farmer',
        role: Role.FARMER,
        approvalStatus: ApprovalStatus.PENDING,
      }),
    }),
    findByIdAndUpdate: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'usr-farmer-new',
        id: 'usr-farmer-new',
        name: 'New Farmer',
        role: Role.FARMER,
        approvalStatus: ApprovalStatus.APPROVED,
        verificationStatus: VerificationStatus.VERIFIED,
        isVerified: true,
      }),
    }),
  };

  const mockCropLotModel = {
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      lean: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockBidModel = {
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      lean: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockTransactionModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      lean: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockPaymentModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      lean: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockAuditLogModel = {
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    getRecent: jest.fn().mockResolvedValue([]),
  };

  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(CropLot.name), useValue: mockCropLotModel },
        {
          provide: getModelToken(Crop.name),
          useValue: {
            find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
          },
        },
        { provide: getModelToken(Bid.name), useValue: mockBidModel },
        { provide: getModelToken(Transaction.name), useValue: mockTransactionModel },
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        { provide: getModelToken(AuditLog.name), useValue: mockAuditLogModel },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    auditService = module.get<AuditService>(AuditService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('approveUser', () => {
    it('should approve a pending user, update verificationStatus to VERIFIED, log audit, and notify user', async () => {
      mockUserModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: 'usr-farmer-new',
          name: 'New Farmer',
          role: Role.FARMER,
        }),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: 'usr-farmer-new',
          id: 'usr-farmer-new',
          name: 'New Farmer',
          role: Role.FARMER,
          approvalStatus: ApprovalStatus.APPROVED,
          verificationStatus: VerificationStatus.VERIFIED,
          isVerified: true,
        }),
      });

      const result = await service.approveUser('usr-farmer-new', 'admin-id-1');

      expect(result.success).toBe(true);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.USER_APPROVED }),
      );
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'usr-farmer-new',
          type: NotificationType.SYSTEM,
        }),
      );
    });

    it('should throw NotFoundException if applicant does not exist', async () => {
      mockUserModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(service.approveUser('non-existent-id', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rejectUser', () => {
    it('should reject applicant with reason, update status to REJECTED, log audit, and notify user', async () => {
      mockUserModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: 'usr-buyer-new',
          name: 'Bad Buyer',
          role: Role.BUYER,
        }),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: 'usr-buyer-new',
          id: 'usr-buyer-new',
          name: 'Bad Buyer',
          role: Role.BUYER,
          approvalStatus: ApprovalStatus.REJECTED,
          verificationStatus: VerificationStatus.REJECTED,
          isVerified: false,
          rejectionReason: 'Invalid APMC license and duplicate mobile number.',
        }),
      });

      const result = await service.rejectUser(
        'usr-buyer-new',
        'admin-id-1',
        'Invalid APMC license and duplicate mobile number.',
      );

      expect(result.success).toBe(true);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.USER_REJECTED }),
      );
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'usr-buyer-new',
          type: NotificationType.SYSTEM,
          message: expect.stringContaining('Invalid APMC license and duplicate mobile number.'),
        }),
      );
    });

    it('should reject rejection attempt without reason', async () => {
      await expect(service.rejectUser('usr-buyer-new', 'admin-id-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
