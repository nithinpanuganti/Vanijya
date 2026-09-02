import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository, UserRepository } from '../repositories';
import { AuditLogEntity } from '../database/types';
import { AuditAction } from '../database/enums';

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
    private readonly auditRepository: AuditRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async log(entry: AuditEntry) {
    const actor = await this.userRepository.findById(entry.actorId);
    const logId = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const metadata = {
      ...(entry.metadata || {}),
      lotId: entry.lotId || null,
      bidId: entry.bidId || null,
      transactionId: entry.transactionId || null,
      paymentId: entry.paymentId || null,
      price: entry.price || null,
      previousQuantity: entry.previousQuantity || null,
      newQuantity: entry.newQuantity || null,
      actorRole: actor?.role || 'FARMER',
    };

    const logDoc: AuditLogEntity = {
      _id: logId,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.lotId ? 'LOT' : entry.transactionId ? 'TRANSACTION' : entry.bidId ? 'BID' : 'USER',
      entityId: entry.lotId || entry.transactionId || entry.bidId || entry.actorId,
      metadata,
      timestamp: entry.createdAt || new Date(),
      createdAt: new Date(),
    };

    const created = await this.auditRepository.create(logDoc);

    return {
      ...created,
      id: created._id,
      actorName: actor?.name || 'System User',
    };
  }

  async getRecent(limit: number = 50) {
    const logs = await this.auditRepository.findRecentActivity(limit);
    if (!logs || logs.length === 0) return [];

    const actorIds = Array.from(new Set(logs.map((l) => l.actorId)));
    const users = await this.userRepository.findAll({ _id: { $in: actorIds } } as any);
    const userMap = new Map(users.map((u) => [u._id, u]));

    return logs.map((l) => {
      const actor = userMap.get(l.actorId);
      return {
        ...l,
        id: l._id,
        actorName: actor?.name || 'User',
        actorRole: actor?.role || (l.metadata as any)?.actorRole || 'FARMER',
      };
    });
  }
}
