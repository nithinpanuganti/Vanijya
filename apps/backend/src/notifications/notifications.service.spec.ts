import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationType } from '../database/enums';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockNotificationRepository = {
    create: jest.fn(),
    findByRecipient: jest.fn().mockResolvedValue([]),
    countUnread: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationRepository, useValue: mockNotificationRepository },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create notification in MongoDB when connected', async () => {
    mockNotificationRepository.create.mockResolvedValue({
      _id: 'notif-101',
      recipientId: 'usr-farmer-1',
      type: NotificationType.BID_RECEIVED,
      title: 'New Bid Received',
      message: 'New bid placed',
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create({
      recipientId: 'usr-farmer-1',
      type: NotificationType.BID_RECEIVED,
      title: 'New Bid Received',
      message: 'New bid placed',
    });

    expect(result.id).toBe('notif-101');
    expect(mockNotificationRepository.create).toHaveBeenCalled();
  });

  it('should return unread count for user', async () => {
    mockNotificationRepository.countUnread.mockResolvedValue(3);
    const count = await service.getUnreadCount('usr-farmer-1');
    expect(count).toBe(3);
  });

  it('should mark all notifications as read', async () => {
    mockNotificationRepository.markAllRead.mockResolvedValue(4);
    const result = await service.markAllAsRead('usr-farmer-1');
    expect(result.count).toBe(4);
  });
});
