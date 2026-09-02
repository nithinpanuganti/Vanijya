import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { CropLotEntity } from '../database/types';
import { CropLotStatus } from '../database/enums';
import { ClientSession, Filter } from 'mongodb';

@Injectable()
export class LotRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<CropLotEntity>(COLLECTIONS.CROP_LOTS);
  }

  async create(lot: CropLotEntity, session?: ClientSession): Promise<CropLotEntity> {
    await this.collection.insertOne(lot as any, { session });
    return lot;
  }

  async findById(id: string): Promise<CropLotEntity | null> {
    return this.collection.findOne({ _id: id });
  }

  async findLots(filter?: Filter<CropLotEntity>): Promise<CropLotEntity[]> {
    return this.collection.find(filter || {}).sort({ createdAt: -1 }).toArray();
  }

  async findFarmerLots(farmerId: string, status?: CropLotStatus): Promise<CropLotEntity[]> {
    const query: Filter<CropLotEntity> = { farmerId };
    if (status) {
      query.status = status;
    }
    return this.collection.find(query).sort({ createdAt: -1 }).toArray();
  }

  async update(id: string, updates: Partial<CropLotEntity>, session?: ClientSession): Promise<CropLotEntity | null> {
    const updated = {
      ...updates,
      updatedAt: new Date(),
    };
    await this.collection.updateOne({ _id: id }, { $set: updated }, { session });
    return this.findById(id);
  }

  async updateStatus(id: string, status: CropLotStatus, session?: ClientSession): Promise<CropLotEntity | null> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { status, updatedAt: new Date() } },
      { session },
    );
    return this.findById(id);
  }

  async countByStatus(status?: CropLotStatus): Promise<number> {
    const query: Filter<CropLotEntity> = status ? { status } : {};
    return this.collection.countDocuments(query);
  }

  async countFarmerLots(farmerId: string, status?: CropLotStatus): Promise<number> {
    const query: Filter<CropLotEntity> = { farmerId };
    if (status) query.status = status;
    return this.collection.countDocuments(query);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}
