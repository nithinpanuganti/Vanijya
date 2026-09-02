import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { MarketEntity } from '../database/types';
import { Filter } from 'mongodb';

@Injectable()
export class MarketRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<MarketEntity>(COLLECTIONS.MARKETS);
  }

  async create(market: MarketEntity): Promise<MarketEntity> {
    await this.collection.insertOne(market as any);
    return market;
  }

  async findAll(filter?: Filter<MarketEntity>): Promise<MarketEntity[]> {
    return this.collection.find(filter || {}).sort({ name: 1 }).toArray();
  }

  async findById(id: string): Promise<MarketEntity | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByDistrict(district: string, state?: string): Promise<MarketEntity[]> {
    const query: Filter<MarketEntity> = {
      district: { $regex: new RegExp(district, 'i') },
    };
    if (state) {
      query.state = { $regex: new RegExp(state, 'i') };
    }
    return this.collection.find(query).toArray();
  }

  async findNearby(longitude: number, latitude: number, maxDistanceMeters = 200000): Promise<MarketEntity[]> {
    try {
      return await this.collection
        .find({
          geoPoint: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
              $maxDistance: maxDistanceMeters,
            },
          },
        } as any)
        .toArray();
    } catch {
      // Fallback if 2dsphere index is building
      return this.findAll();
    }
  }

  async count(): Promise<number> {
    return this.collection.countDocuments();
  }
}
