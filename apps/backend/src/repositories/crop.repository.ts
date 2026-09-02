import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { CropEntity } from '../database/types';
import { Filter } from 'mongodb';

@Injectable()
export class CropRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<CropEntity>(COLLECTIONS.CROPS);
  }

  async create(crop: CropEntity): Promise<CropEntity> {
    await this.collection.insertOne(crop as any);
    return crop;
  }

  async findAll(filter?: Filter<CropEntity>): Promise<CropEntity[]> {
    return this.collection.find(filter || {}).sort({ name: 1 }).toArray();
  }

  async findById(id: string): Promise<CropEntity | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByName(name: string): Promise<CropEntity | null> {
    return this.collection.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });
  }

  async count(): Promise<number> {
    return this.collection.countDocuments();
  }
}
