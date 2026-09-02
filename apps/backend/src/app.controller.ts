import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AppService } from './app.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Backend & Database Health Check' })
  @ApiResponse({ status: 200, description: 'System and MongoDB are connected and healthy' })
  @ApiResponse({ status: 503, description: 'Database connection is degraded or disconnected' })
  getHealth(@Res() res: Response) {
    const health = this.appService.getHealth();
    const httpStatus = health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(httpStatus).json(health);
  }
}
