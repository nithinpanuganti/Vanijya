import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { NotificationEntity } from '../database/types';
import { ClientSession, Filter } from 'mongodb';

@Injectable()
export class NotificationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<NotificationEntity>(COLLECTIONS.NOTIFICATIONS);
  }

  async create(notification: NotificationEntity, session?: ClientSession): Promise<NotificationEntity> {
    await this.collection.insertOne(notification as any, { session });
    return notification;
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByRecipient(recipientId: string, limit = 50): Promise<NotificationEntity[]> {
    return this.collection
      .find({ recipientId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.collection.countDocuments({ recipientId, isRead: false });
  }

  async markRead(id: string, recipientId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id, recipientId },
      { $set: { isRead: true, updatedAt: new Date() } },
    );
    return result.modifiedCount > 0;
  }

  async markAllRead(recipientId: string): Promise<number> {
    const result = await this.collection.updateMany(
      { recipientId, isRead: false },
      { $set: { isRead: true, updatedAt: new Date() } },
    );
    return result.modifiedCount;
  }

  async countAll(): Promise<number> {
    return this.collection.countDocuments();
  }
}
