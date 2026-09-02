import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from '../database/schemas';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const created = await this.notificationModel.create({
      _id: notifId,
      recipientId: dto.recipientId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      entityType: dto.entityType || null,
      entityId: dto.entityId || null,
      isRead: false,
      createdAt: new Date(),
    });
    return { ...created.toObject(), id: created._id };
  }

  async findAllForUser(userId: string, limit: number = 20) {
    const list = await this.notificationModel
      .find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    if (!list || list.length === 0) return [];
    return list.map((n) => ({ ...n, id: n._id }));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const count = await this.notificationModel.countDocuments({
      recipientId: userId,
      isRead: false,
    });
    return count;
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.notificationModel.updateOne(
      { _id: notificationId, recipientId: userId },
      { $set: { isRead: true } },
    );
    return { success: true };
  }

  async markAllAsRead(userId: string) {
    const res = await this.notificationModel.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true } },
    );
    return { success: true, count: res.modifiedCount };
  }
}
