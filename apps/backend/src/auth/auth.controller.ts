import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Request } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new Farmer or Buyer for admin verification' })
  @ApiResponse({ status: 201, description: 'Application successfully submitted for admin approval' })
  @ApiResponse({ status: 409, description: 'Phone or email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with phone/email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto, description: 'Login successful with JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid phone/email or password' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
    const remoteIp = Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : undefined;
    return this.authService.login(dto, remoteIp);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, type: UserProfileDto, description: 'Authenticated profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@CurrentUser() user: UserProfileDto): UserProfileDto {
    return user;
  }
}
