import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument, User, UserDocument, AuditAction } from '../database/schemas';

export interface AuditEntry {
  id?: string;
  bidId?: string;
  lotId?: string;
  transactionId?: string;
  paymentId?: string;
  previousQuantity?: number;
  newQuantity?: number;
  actorId: string;
  action: AuditAction;
  price?: number;
  metadata?: any;
  createdAt?: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async log(entry: AuditEntry) {
    const actor = await this.userModel.findById(entry.actorId).lean();
    const logId = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const logDoc = await this.auditLogModel.create({
      _id: logId,
      actorId: entry.actorId,
      actorRole: actor?.role || 'FARMER',
      action: entry.action,
      lotId: entry.lotId || null,
      bidId: entry.bidId || null,
      transactionId: entry.transactionId || null,
      paymentId: entry.paymentId || null,
      price: entry.price || null,
      previousQuantity: entry.previousQuantity || null,
      newQuantity: entry.newQuantity || null,
      metadata: entry.metadata || null,
      timestamp: entry.createdAt || new Date(),
    });

    return {
      ...logDoc.toObject(),
      id: logDoc._id,
      actorName: actor?.name || 'System User',
    };
  }

  async getRecent(limit: number = 50) {
    const logs = await this.auditLogModel
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    if (!logs || logs.length === 0) return [];

    const actorIds = Array.from(new Set(logs.map((l) => l.actorId)));
    const users = await this.userModel.find({ _id: { $in: actorIds } }).lean();
    const userMap = new Map(users.map((u) => [u._id, u]));

    return logs.map((l) => {
      const actor = userMap.get(l.actorId);
      return {
        ...l,
        id: l._id,
        actorName: actor?.name || 'User',
        actorRole: actor?.role || l.actorRole || 'FARMER',
      };
    });
  }
}
