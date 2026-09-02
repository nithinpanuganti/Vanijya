import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserDocument,
  Role,
  VerificationStatus,
  ApprovalStatus,
  AuditAction,
  NotificationType,
} from '../database/schemas';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { computeProfileCompletion } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PhotoStorageService } from '../users/photo-storage.service';

interface LoginAttemptTracker {
  count: number;
  resetAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private loginAttempts = new Map<string, LoginAttemptTracker>();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly photoStorageService: PhotoStorageService,
  ) {}

  private checkRateLimit(key: string) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxAttempts = 15;

    const record = this.loginAttempts.get(key);
    if (!record || now > record.resetAt) {
      this.loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (record.count >= maxAttempts) {
      throw new HttpException(
        'Too many login attempts. Please try again in 1 minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count++;
  }

  private validatePasswordRules(password: string): void {
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      );
    }
  }

  async register(dto: RegisterDto) {
    // 1. Admin accounts cannot be self-registered
    if (dto.role === Role.ADMIN) {
      throw new BadRequestException('Administrator accounts cannot be self-registered.');
    }

    // 2. Validate Password Rules
    this.validatePasswordRules(dto.password);

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Build GeoJSON Point if coordinates supplied
    let geoPoint: any = null;
    if (dto.longitude !== undefined && dto.latitude !== undefined) {
      geoPoint = {
        type: 'Point',
        coordinates: [Number(dto.longitude), Number(dto.latitude)],
      };
    }

    // Handle Profile Photo if uploaded during registration
    let profilePhoto: any = null;
    if (dto.profilePhotoBase64) {
      try {
        const matches = dto.profilePhotoBase64.match(/^data:([A-Za-z-+]+);base64,(.+)$/);
        let buffer: Buffer;
        let mimeType = 'image/jpeg';
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(dto.profilePhotoBase64, 'base64');
        }

        profilePhoto = await this.photoStorageService.storeProfilePhoto(
          buffer,
          `reg_${Date.now()}.jpg`,
          mimeType,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to process registration profile photo: ${err.message}`);
        if (dto.profilePhotoUrl) {
          profilePhoto = { url: dto.profilePhotoUrl };
        }
      }
    } else if (dto.profilePhotoUrl) {
      profilePhoto = { url: dto.profilePhotoUrl };
    }

    // Build unique ID
    const rolePrefix = dto.role === Role.FARMER ? 'usr-farmer' : 'usr-buyer';
    const userId = `${rolePrefix}-${Date.now()}`;

    // Duplicate Check
    const existingPhone = await this.userModel.findOne({ phone: dto.phone }).lean();
    if (existingPhone) {
      throw new ConflictException('A user with this mobile number is already registered.');
    }

    if (dto.email) {
      const existingEmail = await this.userModel.findOne({ email: dto.email }).lean();
      if (existingEmail) {
        throw new ConflictException('A user with this email address is already registered.');
      }
    }

    const userData: any = {
      _id: userId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email || null,
      passwordHash,
      role: dto.role,
      approvalStatus: ApprovalStatus.PENDING,
      verificationStatus: VerificationStatus.PENDING,
      rejectionReason: null,
      isVerified: false,
      state: dto.state,
      district: dto.district,
      village: dto.village || null,
      location: dto.location || `${dto.district}, ${dto.state}`,
      geoPoint: geoPoint || null,
      profilePhoto: profilePhoto || null,
      primaryCrop: dto.primaryCrop || null,
      farmSize: dto.farmSize || null,
      preferredLanguage: dto.preferredLanguage || 'en',
      organization: dto.organization || null,
      contactPerson: dto.contactPerson || null,
      businessType: dto.businessType || null,
      warehouseLocation: dto.warehouseLocation || null,
      gstin: dto.gstin || null,
      fssai: dto.fssai || null,
      kccNumber: dto.kccNumber || null,
      apmcLicense: dto.apmcLicense || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.userModel.create(userData);
    this.logger.log(`Created new MongoDB user: ${userId} (${dto.name})`);

    // Audit Log
    await this.auditService.log({
      actorId: userId,
      action: AuditAction.USER_REGISTERED,
      metadata: { role: dto.role, name: dto.name, phone: dto.phone },
    });

    // Notify Admins
    await this.notificationsService.create({
      recipientId: 'usr-admin-1',
      type: NotificationType.SYSTEM,
      title: `New ${dto.role === Role.FARMER ? 'Farmer' : 'Buyer'} Registration Request`,
      message: `${dto.name} (${dto.district}, ${dto.state}) has submitted a registration application for admin review.`,
      entityType: 'USER',
      entityId: userId,
    });

    // Notify User
    await this.notificationsService.create({
      recipientId: userId,
      type: NotificationType.SYSTEM,
      title: 'Registration Submitted for Verification',
      message:
        'Your Vanijya account has been submitted for admin verification. You will be able to sign in once an administrator approves your account.',
      entityType: 'USER',
      entityId: userId,
    });

    return {
      success: true,
      message:
        'Your Vanijya account has been submitted for verification. You can sign in once an administrator approves your account.',
      userId,
      approvalStatus: ApprovalStatus.PENDING,
    };
  }

  async login(dto: LoginDto, remoteIp?: string): Promise<AuthResponseDto> {
    const rateLimitKey = remoteIp || dto.identifier || 'anonymous';
    this.checkRateLimit(rateLimitKey);

    // 1. MongoDB Lookup
    const user = await this.userModel
      .findOne({
        $or: [{ phone: dto.identifier }, { email: dto.identifier }],
      })
      .lean();

    if (!user) {
      throw new UnauthorizedException('Invalid phone/email or password.');
    }

    // Check Password
    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(dto.password, user.passwordHash).catch(() => false);
    }

    if (!isMatch) {
      throw new UnauthorizedException('Invalid phone/email or password.');
    }

    // Role matching check
    if (dto.role && user.role !== dto.role) {
      throw new UnauthorizedException(
        `This account is registered as ${user.role}. Selected account type does not match.`,
      );
    }

    // Verification / Approval Gate
    const approvalStatus = user.approvalStatus || ApprovalStatus.APPROVED;

    if (approvalStatus === ApprovalStatus.PENDING) {
      throw new ForbiddenException(
        'Your registration is currently PENDING_APPROVAL by the administrator. Please wait for verification.',
      );
    }

    if (approvalStatus === ApprovalStatus.REJECTED) {
      const reason = user.rejectionReason || 'Application details could not be verified.';
      throw new ForbiddenException(`Your registration was rejected by the administrator. Reason: ${reason}`);
    }

    const payload = {
      sub: user._id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      name: user.name,
      district: user.district,
      state: user.state,
      approvalStatus: user.approvalStatus,
      verificationStatus: user.verificationStatus,
    };

    const accessToken = this.jwtService.sign(payload);
    const completion = computeProfileCompletion(user);

    return {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone || null,
        email: user.email || null,
        role: user.role,
        district: user.district || null,
        state: user.state || null,
        village: user.village || null,
        location: user.location || null,
        geoPoint: user.geoPoint || null,
        profilePhoto: user.profilePhoto || null,
        isVerified: user.isVerified || false,
        approvalStatus: user.approvalStatus || ApprovalStatus.APPROVED,
        verificationStatus: user.verificationStatus || VerificationStatus.VERIFIED,
        rejectionReason: user.rejectionReason || null,
        primaryCrop: user.primaryCrop || null,
        farmSize: user.farmSize || null,
        preferredLanguage: user.preferredLanguage || 'en',
        organization: user.organization || null,
        contactPerson: user.contactPerson || null,
        businessType: user.businessType || null,
        warehouseLocation: user.warehouseLocation || null,
        gstin: user.gstin || null,
        fssai: user.fssai || null,
        kccNumber: user.kccNumber || null,
        apmcLicense: user.apmcLicense || null,
        profileCompletionPercentage: completion.profileCompletionPercentage,
        profileCompletionStatus: completion.profileCompletionStatus,
        missingFields: completion.missingFields,
      },
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
