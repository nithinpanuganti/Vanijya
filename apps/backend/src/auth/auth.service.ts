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
import { CaptchaService } from './captcha.service';
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
    private readonly captchaService: CaptchaService,
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

    // 3. Verify Visual CAPTCHA
    const captchaResult = this.captchaService.verifyCaptcha(dto.captchaId, dto.captchaAnswer);
    if (!captchaResult.success) {
      throw new UnauthorizedException(
        captchaResult.error || 'Incorrect CAPTCHA. Please try again.',
      );
    }

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
          `reg_${dto.phone || Date.now()}.jpg`,
          mimeType,
        );
      } catch (err: any) {
        this.logger.warn(`Photo storage fallback during registration: ${err.message}`);
        profilePhoto = {
          url: dto.profilePhotoUrl || '/images/avatars/default.svg',
          mimeType: 'image/svg+xml',
          size: 0,
          uploadedAt: new Date(),
        };
      }
    } else if (dto.profilePhotoUrl) {
      profilePhoto = {
        url: dto.profilePhotoUrl,
        mimeType: 'image/svg+xml',
        size: 0,
        uploadedAt: new Date(),
      };
    }

    const userId = `usr-${Date.now()}`;
    const userData: Partial<User> = {
      _id: userId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email || null,
      passwordHash,
      role: dto.role,
      verificationStatus: VerificationStatus.PENDING,
      approvalStatus: ApprovalStatus.PENDING,
      rejectionReason: null,
      approvedBy: null,
      approvedAt: null,
      profilePhoto,
      district: dto.district,
      state: dto.state,
      village: dto.village || null,
      location: dto.location || null,
      geoPoint,
      primaryCrop: dto.primaryCrop || null,
      farmSize: dto.farmSize ? Number(dto.farmSize) : null,
      preferredLanguage: dto.preferredLanguage || 'en',
      organization: dto.organization || null,
      contactPerson: dto.contactPerson || null,
      businessType: dto.businessType || null,
      warehouseLocation: dto.warehouseLocation || null,
      gstin: dto.gstin || null,
      fssai: dto.fssai || null,
      kccNumber: dto.kccNumber || null,
      apmcLicense: dto.apmcLicense || null,
      isVerified: false,
    };

    if (dto.phone) {
      const existingPhone = await this.userModel.findOne({ phone: dto.phone }).lean();
      if (existingPhone) {
        throw new ConflictException('Mobile number is already registered.');
      }
    }

    if (dto.email) {
      const existingEmail = await this.userModel.findOne({ email: dto.email }).lean();
      if (existingEmail) {
        throw new ConflictException('Email address is already registered.');
      }
    }

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

    // 1. Verify Visual Alphanumeric CAPTCHA challenge
    const captchaResult = this.captchaService.verifyCaptcha(dto.captchaId, dto.captchaAnswer);
    if (!captchaResult.success) {
      throw new UnauthorizedException(
        captchaResult.error || 'Incorrect CAPTCHA. Please try again.',
      );
    }

    // 2. MongoDB Lookup
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

    // Approval Status Check
    if (user.approvalStatus === ApprovalStatus.PENDING) {
      throw new ForbiddenException(
        'Your account is awaiting admin approval. You will be able to sign in once an administrator approves your registration.',
      );
    }

    if (user.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ForbiddenException(
        `Your registration was rejected. Reason: ${user.rejectionReason || 'Application did not meet verification criteria.'}`,
      );
    }

    const completion = computeProfileCompletion(user);
    const userId = user._id || (user as any).id;
    const payload = { sub: userId, role: user.role, name: user.name };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: userId,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto,
        district: user.district,
        state: user.state,
        village: user.village,
        location: user.location,
        geoPoint: user.geoPoint,
        organization: user.organization,
        contactPerson: user.contactPerson,
        businessType: user.businessType,
        warehouseLocation: user.warehouseLocation,
        gstin: user.gstin,
        fssai: user.fssai,
        kccNumber: user.kccNumber,
        apmcLicense: user.apmcLicense,
        isVerified: user.isVerified,
        ...completion,
      },
    };
  }
}
