import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  constructor(private readonly databaseService: DatabaseService) {}

  getHealth() {
    const isDbConnected =
      this.databaseService.connection && this.databaseService.connection.readyState === 1;

    if (isDbConnected) {
      return {
        status: 'ok',
        database: 'connected',
        service: 'vanijya-backend',
        timestamp: new Date().toISOString(),
        sihProblemStatement:
          '26132 - Strengthening Market Linkages & Price Discovery for Farmers',
      };
    }

    return {
      status: 'degraded',
      database: 'disconnected',
      message:
        'MongoDB connection is unavailable. Ensure MONGODB_URI is configured and the database service is running.',
      service: 'vanijya-backend',
      timestamp: new Date().toISOString(),
      sihProblemStatement:
        '26132 - Strengthening Market Linkages & Price Discovery for Farmers',
    };
  }
}
