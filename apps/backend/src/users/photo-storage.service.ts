import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { ObjectId } from 'mongodb';
import { Readable } from 'stream';

export interface StoredPhotoResult {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

@Injectable()
export class PhotoStorageService {
  private readonly logger = new Logger(PhotoStorageService.name);
  private inMemoryPhotos = new Map<string, { buffer: Buffer; mimeType: string; filename: string }>();

  constructor(private readonly databaseService: DatabaseService) {}

  async storeProfilePhoto(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<StoredPhotoResult> {
    // 1. Validation: MIME Type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new BadRequestException('Invalid photo format. Only JPEG, PNG, and WebP are allowed.');
    }

    // 2. Validation: File Size (max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (fileBuffer.length > MAX_SIZE) {
      throw new BadRequestException('Photo size exceeds 5MB limit.');
    }

    const cleanFilename = `profile_${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    try {
      const bucket = this.databaseService.getGridFSBucket();
      if (bucket) {
        return await new Promise<StoredPhotoResult>((resolve, reject) => {
          const uploadStream = bucket.openUploadStream(cleanFilename, {
            contentType: mimeType,
            metadata: { uploadedAt: new Date() },
          });

          const readableStream = new Readable();
          readableStream.push(fileBuffer);
          readableStream.push(null);

          readableStream
            .pipe(uploadStream)
            .on('error', (err) => {
              this.logger.error(`GridFS upload error: ${err.message}`);
              const fallbackId = `photo-${Date.now()}`;
              this.inMemoryPhotos.set(fallbackId, { buffer: fileBuffer, mimeType, filename: cleanFilename });
              resolve({
                fileId: fallbackId,
                url: `/api/users/photo/${fallbackId}`,
                mimeType,
                size: fileBuffer.length,
                uploadedAt: new Date(),
              });
            })
            .on('finish', () => {
              const fileId = uploadStream.id.toString();
              this.inMemoryPhotos.set(fileId, { buffer: fileBuffer, mimeType, filename: cleanFilename });
              resolve({
                fileId,
                url: `/api/users/photo/${fileId}`,
                mimeType,
                size: fileBuffer.length,
                uploadedAt: new Date(),
              });
            });
        });
      }
    } catch (err: any) {
      this.logger.warn(`GridFS storage note: ${err.message}`);
    }

    const fallbackId = `photo-${Date.now()}`;
    this.inMemoryPhotos.set(fallbackId, { buffer: fileBuffer, mimeType, filename: cleanFilename });
    return {
      fileId: fallbackId,
      url: `/api/users/photo/${fallbackId}`,
      mimeType,
      size: fileBuffer.length,
      uploadedAt: new Date(),
    };
  }

  async getPhotoStream(
    fileId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
    if (this.inMemoryPhotos.has(fileId)) {
      const item = this.inMemoryPhotos.get(fileId)!;
      const stream = new Readable();
      stream.push(item.buffer);
      stream.push(null);
      return { stream, mimeType: item.mimeType };
    }

    if (ObjectId.isValid(fileId)) {
      try {
        const bucket = this.databaseService.getGridFSBucket();
        const objId = new ObjectId(fileId);
        const filesCol = this.databaseService.getCollection(COLLECTIONS.PROFILE_PHOTOS_FILES);
        const fileDoc = await filesCol.findOne({ _id: objId });

        if (fileDoc) {
          const mimeType = (fileDoc as any).contentType || 'image/jpeg';
          const downloadStream = bucket.openDownloadStream(objId);
          return { stream: downloadStream, mimeType };
        }
      } catch (err: any) {
        this.logger.warn(`GridFS download note for ${fileId}: ${err.message}`);
      }
    }

    throw new NotFoundException('Profile photo not found.');
  }

  seedDemoPhoto(id: string, base64Svg: string, mimeType = 'image/svg+xml') {
    const buffer = Buffer.from(base64Svg, 'utf-8');
    this.inMemoryPhotos.set(id, { buffer, mimeType, filename: `demo_${id}.svg` });
  }
}
