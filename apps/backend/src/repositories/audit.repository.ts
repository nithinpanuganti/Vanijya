import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { AuditLogEntity } from '../database/types';
import { ClientSession, Filter } from 'mongodb';

@Injectable()
export class AuditRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<AuditLogEntity>(COLLECTIONS.AUDIT_LOGS);
  }

  async create(log: AuditLogEntity, session?: ClientSession): Promise<AuditLogEntity> {
    await this.collection.insertOne(log as any, { session });
    return log;
  }

  async findRecentActivity(limit = 100): Promise<AuditLogEntity[]> {
    return this.collection
      .find({})
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async findByEntity(entityType: string, entityId: string, limit = 50): Promise<AuditLogEntity[]> {
    return this.collection
      .find({ entityType, entityId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async findByActor(actorId: string, limit = 50): Promise<AuditLogEntity[]> {
    return this.collection
      .find({ actorId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async countAll(): Promise<number> {
    return this.collection.countDocuments();
  }

  async findAll(filter?: Filter<AuditLogEntity>): Promise<AuditLogEntity[]> {
    return this.collection.find(filter || {}).sort({ timestamp: -1 }).toArray();
  }
}
