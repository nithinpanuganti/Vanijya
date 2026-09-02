import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UsersService } from './users.service';
import { PhotoStorageService } from './photo-storage.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly photoStorageService: PhotoStorageService,
  ) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current logged-in user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update profile details (name, district, state, location)' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('profile-photo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and set profile photo via multipart or base64' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary' },
        base64: { type: 'string', description: 'Optional base64 image data URI' },
      },
    },
  })
  async uploadProfilePhoto(
    @CurrentUser('id') userId: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body('base64') base64Data?: string,
  ) {
    let buffer: Buffer;
    let mimeType = 'image/jpeg';
    let filename = `user_${userId}.jpg`;

    if (file) {
      buffer = file.buffer;
      mimeType = file.mimetype;
      filename = file.originalname;
    } else if (base64Data) {
      const matches = base64Data.match(/^data:([A-Za-z-+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }
    } else {
      throw new BadRequestException('No photo provided. Upload a file or provide a base64 image.');
    }

    const stored = await this.photoStorageService.storeProfilePhoto(buffer, filename, mimeType);
    const updatedUser = await this.usersService.updateProfilePhoto(userId, stored);
    return {
      message: 'Profile photo updated successfully',
      photo: stored,
      user: updatedUser,
    };
  }

  @Get('photo/:fileId')
  @ApiOperation({ summary: 'Stream user profile photo by file ID' })
  async getPhoto(@Param('fileId') fileId: string, @Res() res: Response) {
    const { stream, mimeType } = await this.photoStorageService.getPhotoStream(fileId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  }

  @Get(':id/profile-photo')
  @ApiOperation({ summary: 'Get profile photo information for a user' })
  async getUserProfilePhoto(@Param('id') userId: string) {
    const user = await this.usersService.getProfile(userId);
    return user.profilePhoto || null;
  }
}
