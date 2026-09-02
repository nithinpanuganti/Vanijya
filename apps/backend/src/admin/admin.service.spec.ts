import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UserRepository,
  LotRepository,
  CropRepository,
  BidRepository,
  TransactionRepository,
  PaymentRepository,
  AuditRepository,
} from '../repositories';
import {
  Role,
  ApprovalStatus,
  VerificationStatus,
  AuditAction,
  NotificationType,
} from '../database/enums';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AdminService (Registration Verification Workflow)', () => {
  let service: AdminService;
  let auditService: AuditService;
  let notificationsService: NotificationsService;

  const mockUserRepository = {
    countByRole: jest.fn().mockResolvedValue(2),
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({
      _id: 'usr-farmer-new',
      name: 'New Farmer',
      role: Role.FARMER,
      approvalStatus: ApprovalStatus.PENDING,
    }),
    updateApprovalStatus: jest.fn().mockResolvedValue({
      _id: 'usr-farmer-new',
      id: 'usr-farmer-new',
      name: 'New Farmer',
      role: Role.FARMER,
      approvalStatus: ApprovalStatus.APPROVED,
      verificationStatus: VerificationStatus.VERIFIED,
      isVerified: true,
    }),
  };

  const mockLotRepository = {
    countByStatus: jest.fn().mockResolvedValue(0),
    findLots: jest.fn().mockResolvedValue([]),
    findFarmerLots: jest.fn().mockResolvedValue([]),
  };

  const mockCropRepository = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockBidRepository = {
    countByStatus: jest.fn().mockResolvedValue(0),
    findAll: jest.fn().mockResolvedValue([]),
    findByBuyer: jest.fn().mockResolvedValue([]),
  };

  const mockTransactionRepository = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockPaymentRepository = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockAuditRepository = {
    findByActor: jest.fn().mockResolvedValue([]),
    findRecentActivity: jest.fn().mockResolvedValue([]),
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
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: LotRepository, useValue: mockLotRepository },
        { provide: CropRepository, useValue: mockCropRepository },
        { provide: BidRepository, useValue: mockBidRepository },
        { provide: TransactionRepository, useValue: mockTransactionRepository },
        { provide: PaymentRepository, useValue: mockPaymentRepository },
        { provide: AuditRepository, useValue: mockAuditRepository },
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
      mockUserRepository.findById.mockResolvedValueOnce({
        _id: 'usr-farmer-new',
        name: 'New Farmer',
        role: Role.FARMER,
      });
      mockUserRepository.updateApprovalStatus.mockResolvedValueOnce({
        _id: 'usr-farmer-new',
        name: 'New Farmer',
        role: Role.FARMER,
        approvalStatus: ApprovalStatus.APPROVED,
        verificationStatus: VerificationStatus.VERIFIED,
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
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(service.approveUser('non-existent-id', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rejectUser', () => {
    it('should reject applicant with reason, update status to REJECTED, log audit, and notify user', async () => {
      mockUserRepository.findById.mockResolvedValueOnce({
        _id: 'usr-buyer-new',
        name: 'Bad Buyer',
        role: Role.BUYER,
      });
      mockUserRepository.updateApprovalStatus.mockResolvedValueOnce({
        _id: 'usr-buyer-new',
        name: 'Bad Buyer',
        role: Role.BUYER,
        approvalStatus: ApprovalStatus.REJECTED,
        verificationStatus: VerificationStatus.REJECTED,
        rejectionReason: 'Invalid APMC license and duplicate mobile number.',
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
