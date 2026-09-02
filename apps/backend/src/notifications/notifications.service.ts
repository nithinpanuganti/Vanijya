import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from '../repositories';
import { NotificationEntity } from '../database/types';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly notificationRepository: NotificationRepository) {}

  async create(dto: CreateNotificationDto) {
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const notificationData: NotificationEntity = {
      _id: notifId,
      recipientId: dto.recipientId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      entityType: dto.entityType || null,
      entityId: dto.entityId || null,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.notificationRepository.create(notificationData);
    return { ...created, id: created._id };
  }

  async findAllForUser(userId: string, limit: number = 20) {
    const list = await this.notificationRepository.findByRecipient(userId, limit);
    return list.map((n) => ({ ...n, id: n._id }));
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnread(userId);
  }

  async markAsRead(notificationId: string, userId: string) {
    const success = await this.notificationRepository.markRead(notificationId, userId);
    return { success };
  }

  async markAllAsRead(userId: string) {
    const count = await this.notificationRepository.markAllRead(userId);
    return { success: true, count };
  }
}
