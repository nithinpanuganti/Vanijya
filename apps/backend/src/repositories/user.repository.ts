import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { UserEntity } from '../database/types';
import { Role, ApprovalStatus, VerificationStatus } from '../database/enums';
import { ClientSession, Filter } from 'mongodb';

@Injectable()
export class UserRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<UserEntity>(COLLECTIONS.USERS);
  }

  async create(user: UserEntity, session?: ClientSession): Promise<UserEntity> {
    await this.collection.insertOne(user as any, { session });
    return user;
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    return this.collection.findOne({ phone });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.collection.findOne({ email });
  }

  async findByIdentifier(identifier: string): Promise<UserEntity | null> {
    return this.collection.findOne({
      $or: [{ phone: identifier }, { email: identifier }],
    });
  }

  async update(id: string, updates: Partial<UserEntity>, session?: ClientSession): Promise<UserEntity | null> {
    const updated = {
      ...updates,
      updatedAt: new Date(),
    };
    await this.collection.updateOne({ _id: id }, { $set: updated }, { session });
    return this.findById(id);
  }

  async updateApprovalStatus(
    id: string,
    approvalStatus: ApprovalStatus,
    adminId: string,
    rejectionReason?: string,
    session?: ClientSession,
  ): Promise<UserEntity | null> {
    const updates: Partial<UserEntity> = {
      approvalStatus,
      verificationStatus:
        approvalStatus === ApprovalStatus.APPROVED
          ? VerificationStatus.VERIFIED
          : approvalStatus === ApprovalStatus.REJECTED
          ? VerificationStatus.REJECTED
          : VerificationStatus.PENDING,
      isVerified: approvalStatus === ApprovalStatus.APPROVED,
      approvedBy: adminId,
      approvedAt: new Date(),
      rejectionReason: rejectionReason || null,
      updatedAt: new Date(),
    };

    await this.collection.updateOne({ _id: id }, { $set: updates }, { session });
    return this.findById(id);
  }

  async findPendingRegistrations(filter?: { role?: Role; search?: string }): Promise<UserEntity[]> {
    const query: Filter<UserEntity> = { approvalStatus: ApprovalStatus.PENDING };
    if (filter?.role) {
      query.role = filter.role;
    }
    if (filter?.search) {
      const reg = new RegExp(filter.search, 'i');
      query.$or = [{ name: reg }, { phone: reg }, { organization: reg }, { district: reg }, { state: reg }];
    }
    return this.collection.find(query).sort({ createdAt: -1 }).toArray();
  }

  async countByRole(role?: Role, approvalStatus?: ApprovalStatus): Promise<number> {
    const query: Filter<UserEntity> = {};
    if (role) query.role = role;
    if (approvalStatus) query.approvalStatus = approvalStatus;
    return this.collection.countDocuments(query);
  }

  async findAll(filter?: Filter<UserEntity>): Promise<UserEntity[]> {
    return this.collection.find(filter || {}).sort({ createdAt: -1 }).toArray();
  }
}
