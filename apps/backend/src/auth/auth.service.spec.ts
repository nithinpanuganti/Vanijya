import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PhotoStorageService } from '../users/photo-storage.service';
import { UserRepository } from '../repositories/user.repository';
import { Role, ApprovalStatus, VerificationStatus } from '../database/enums';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService (Native MongoDB Driver)', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockUserRepository = {
    findByPhone: jest.fn(),
    findByEmail: jest.fn(),
    findByIdentifier: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };

  const mockPhotoStorageService = {
    storeProfilePhoto: jest.fn().mockResolvedValue({
      url: '/api/users/photo/file-123',
      fileId: 'file-123',
      mimeType: 'image/jpeg',
      size: 1024,
      uploadedAt: new Date(),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: PhotoStorageService, useValue: mockPhotoStorageService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Registration Workflow', () => {
    it('1. Farmer registration: valid data creates PENDING user and no JWT issued', async () => {
      mockUserRepository.findByPhone.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        _id: 'usr-farmer-1',
        name: 'Ramesh Patel',
        phone: '9876543210',
        email: 'ramesh@farmer.in',
        role: Role.FARMER,
        verificationStatus: VerificationStatus.PENDING,
        approvalStatus: ApprovalStatus.PENDING,
      });

      const result = await service.register({
        name: 'Ramesh Patel',
        phone: '9876543210',
        email: 'ramesh@farmer.in',
        password: 'Password@123',
        role: Role.FARMER,
        district: 'Nashik',
        state: 'Maharashtra',
      });

      expect(result.success).toBe(true);
      expect(result.approvalStatus).toBe(ApprovalStatus.PENDING);
      expect(result).not.toHaveProperty('accessToken');
      expect(mockNotificationsService.create).toHaveBeenCalled();
    });

    it('2. Buyer registration: valid data creates PENDING user and no JWT issued', async () => {
      mockUserRepository.findByPhone.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        _id: 'usr-buyer-1',
        name: 'FreshCart Agro',
        phone: '9876543211',
        email: 'procurement@freshcart.com',
        role: Role.BUYER,
        approvalStatus: ApprovalStatus.PENDING,
      });

      const result = await service.register({
        name: 'FreshCart Agro',
        phone: '9876543211',
        email: 'procurement@freshcart.com',
        password: 'BuyerPass@123',
        role: Role.BUYER,
        district: 'Mumbai',
        state: 'Maharashtra',
        organization: 'FreshCart Agro Ltd',
      });

      expect(result.success).toBe(true);
      expect(result.approvalStatus).toBe(ApprovalStatus.PENDING);
      expect(result).not.toHaveProperty('accessToken');
    });

    it('3. Duplicate phone registration is rejected', async () => {
      mockUserRepository.findByPhone.mockResolvedValueOnce({ _id: 'existing-user' });

      await expect(
        service.register({
          name: 'Duplicate User',
          phone: '9876543210',
          password: 'Password@123',
          role: Role.FARMER,
          district: 'Nashik',
          state: 'Maharashtra',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('4. Duplicate email registration is rejected', async () => {
      mockUserRepository.findByPhone.mockResolvedValueOnce(null);
      mockUserRepository.findByEmail.mockResolvedValueOnce({ _id: 'existing-user' });

      await expect(
        service.register({
          name: 'Duplicate Email User',
          phone: '9876543299',
          email: 'duplicate@farmer.in',
          password: 'Password@123',
          role: Role.FARMER,
          district: 'Nashik',
          state: 'Maharashtra',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('5. Rejects self-registration as ADMIN', async () => {
      await expect(
        service.register({
          name: 'Fake Admin',
          phone: '9999999999',
          password: 'Password@123',
          role: Role.ADMIN,
          district: 'Delhi',
          state: 'Delhi',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. Rejects weak password missing required rules', async () => {
      await expect(
        service.register({
          name: 'Ramesh Patel',
          phone: '9876543210',
          password: 'weakpassword',
          role: Role.FARMER,
          district: 'Nashik',
          state: 'Maharashtra',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Login & Approval Gatekeeping', () => {
    it('1. Valid approved user + valid password = successful login with JWT', async () => {
      const passwordHash = await bcrypt.hash('Farmer@123', 10);
      mockUserRepository.findByIdentifier.mockResolvedValue({
        _id: 'usr-farmer-1',
        name: 'Ramesh Patel',
        phone: '9876543210',
        passwordHash,
        role: Role.FARMER,
        approvalStatus: ApprovalStatus.APPROVED,
        verificationStatus: VerificationStatus.VERIFIED,
        district: 'Nashik',
        state: 'Maharashtra',
      });

      const result = await service.login({
        identifier: '9876543210',
        password: 'Farmer@123',
      });

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user.name).toBe('Ramesh Patel');
      expect(result.user.role).toBe(Role.FARMER);
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('2. Invalid password = login rejected (401)', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword@123', 10);
      mockUserRepository.findByIdentifier.mockResolvedValue({
        _id: 'usr-farmer-1',
        name: 'Ramesh Patel',
        phone: '9876543210',
        passwordHash,
        role: Role.FARMER,
        approvalStatus: ApprovalStatus.APPROVED,
      });

      await expect(
        service.login({
          identifier: '9876543210',
          password: 'WrongPassword@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('3. Unknown user = login rejected (401)', async () => {
      mockUserRepository.findByIdentifier.mockResolvedValue(null);

      await expect(
        service.login({
          identifier: '0000000000',
          password: 'AnyPassword@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('4. Pending user = login blocked with 403 Forbidden', async () => {
      const passwordHash = await bcrypt.hash('Farmer@123', 10);
      mockUserRepository.findByIdentifier.mockResolvedValue({
        _id: 'usr-farmer-pending',
        name: 'Pending Farmer',
        phone: '9876543210',
        passwordHash,
        role: Role.FARMER,
        approvalStatus: ApprovalStatus.PENDING,
        verificationStatus: VerificationStatus.PENDING,
      });

      await expect(
        service.login({
          identifier: '9876543210',
          password: 'Farmer@123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('5. Rejected user = login blocked with constructive rejection reason (403)', async () => {
      const passwordHash = await bcrypt.hash('Farmer@123', 10);
      mockUserRepository.findByIdentifier.mockResolvedValue({
        _id: 'usr-farmer-rejected',
        name: 'Rejected Farmer',
        phone: '9876543210',
        passwordHash,
        role: Role.FARMER,
        approvalStatus: ApprovalStatus.REJECTED,
        verificationStatus: VerificationStatus.REJECTED,
        rejectionReason: 'Invalid APMC license and identity proof.',
      });

      await expect(
        service.login({
          identifier: '9876543210',
          password: 'Farmer@123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('6. Approved Buyer login succeeds', async () => {
      const passwordHash = await bcrypt.hash('Buyer@123', 10);
      mockUserRepository.findByIdentifier.mockResolvedValue({
        _id: 'usr-buyer-1',
        name: 'FreshCart Agro',
        email: 'buyer@freshcart.com',
        passwordHash,
        role: Role.BUYER,
        approvalStatus: ApprovalStatus.APPROVED,
        verificationStatus: VerificationStatus.VERIFIED,
      });

      const result = await service.login({
        identifier: 'buyer@freshcart.com',
        password: 'Buyer@123',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.role).toBe(Role.BUYER);
    });

    it('7. Approved Admin login succeeds', async () => {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      mockUserRepository.findByIdentifier.mockResolvedValue({
        _id: 'usr-admin-1',
        name: 'Ministry Admin',
        email: 'admin@vanijya.gov.in',
        passwordHash,
        role: Role.ADMIN,
        approvalStatus: ApprovalStatus.APPROVED,
        verificationStatus: VerificationStatus.VERIFIED,
      });

      const result = await service.login({
        identifier: 'admin@vanijya.gov.in',
        password: 'Admin@123',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.role).toBe(Role.ADMIN);
    });
  });
});
