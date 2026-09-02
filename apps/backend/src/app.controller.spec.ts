import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';

describe('AppController', () => {
  let appController: AppController;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      isHealthy: jest.fn().mockReturnValue(true),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return system status ok when database is connected', () => {
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((data) => data),
      };

      const result: any = appController.getHealth(mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(result.service).toBe('vanijya-backend');
      expect(result.sihProblemStatement).toContain('26132');
    });

    it('should return 503 degraded status when database is disconnected', () => {
      mockDatabaseService.isHealthy.mockReturnValue(false);
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((data) => data),
      };

      const result: any = appController.getHealth(mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(result.status).toBe('degraded');
      expect(result.database).toBe('disconnected');
    });
  });
});
