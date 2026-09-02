import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { UserRepository } from '../repositories';
import { Role } from '../database/enums';
import { UpdateUserDto } from './dto/update-user.dto';

export interface ProfileCompletionResult {
  profileCompletionPercentage: number;
  profileCompletionStatus: 'COMPLETE' | 'INCOMPLETE';
  missingFields: string[];
}

export function computeProfileCompletion(user: any): ProfileCompletionResult {
  if (!user) {
    return {
      profileCompletionPercentage: 0,
      profileCompletionStatus: 'INCOMPLETE',
      missingFields: ['name', 'contact', 'district', 'state', 'location', 'profilePhoto'],
    };
  }

  const role = user.role || Role.FARMER;
  const missing: string[] = [];

  // Common identity checks
  if (!user.name || user.name.trim() === '') missing.push('name');
  if ((!user.phone || user.phone.trim() === '') && (!user.email || user.email.trim() === '')) {
    missing.push('contact');
  }

  // Profile Photo Check
  const hasPhoto = user.profilePhoto && (user.profilePhoto.url || user.profilePhoto.fileId);
  if (!hasPhoto) missing.push('profilePhoto');

  let totalRequired = 6;

  if (role === Role.FARMER) {
    if (!user.district || user.district.trim() === '') missing.push('district');
    if (!user.state || user.state.trim() === '') missing.push('state');
    if (!user.location || user.location.trim() === '') missing.push('location');
    totalRequired = 6;
  } else if (role === Role.BUYER) {
    if (!user.district || user.district.trim() === '') missing.push('district');
    if (!user.state || user.state.trim() === '') missing.push('state');
    if (!user.location || user.location.trim() === '') missing.push('location');
    if (!user.organization || user.organization.trim() === '') missing.push('organization');
    totalRequired = 7;
  } else {
    // ADMIN
    totalRequired = 3;
  }

  const completedCount = Math.max(0, totalRequired - missing.length);
  const percentage = Math.round((completedCount / totalRequired) * 100);

  return {
    profileCompletionPercentage: percentage,
    profileCompletionStatus: missing.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    missingFields: missing,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const safeUser = this.sanitizeUser(user);
    const completion = computeProfileCompletion(safeUser);
    return { ...safeUser, ...completion };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const updated = await this.userRepository.update(userId, dto as any);
    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    const safeUser = this.sanitizeUser(updated);
    const completion = computeProfileCompletion(safeUser);
    return { ...safeUser, ...completion };
  }

  async updateProfilePhoto(
    userId: string,
    photoData: { fileId: string; url: string; mimeType: string; size: number; uploadedAt: Date },
  ) {
    const updated = await this.userRepository.update(userId, { profilePhoto: photoData as any });
    if (!updated) {
      throw new NotFoundException('User not found.');
    }

    return this.sanitizeUser(updated);
  }

  private sanitizeUser(user: any) {
    const { password, passwordHash, ...safe } = user;
    return {
      ...safe,
      id: user._id || user.id,
    };
  }
}
