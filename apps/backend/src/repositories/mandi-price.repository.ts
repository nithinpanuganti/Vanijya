import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { MandiPriceEntity } from '../database/types';
import { Filter } from 'mongodb';

@Injectable()
export class MandiPriceRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<MandiPriceEntity>(COLLECTIONS.MANDI_PRICES);
  }

  async create(price: MandiPriceEntity): Promise<MandiPriceEntity> {
    await this.collection.insertOne(price as any);
    return price;
  }

  async insertMany(prices: MandiPriceEntity[]): Promise<void> {
    if (prices.length > 0) {
      await this.collection.insertMany(prices as any);
    }
  }

  async findAll(filter?: Filter<MandiPriceEntity>, limit = 100): Promise<MandiPriceEntity[]> {
    return this.collection.find(filter || {}).sort({ date: -1 }).limit(limit).toArray();
  }

  async findByCropAndMarket(cropId: string, marketId: string, limit = 30): Promise<MandiPriceEntity[]> {
    return this.collection
      .find({ cropId, marketId })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();
  }

  async findLatestPrice(cropId: string, marketId?: string): Promise<MandiPriceEntity | null> {
    const query: Filter<MandiPriceEntity> = { cropId };
    if (marketId) query.marketId = marketId;
    return this.collection.findOne(query, { sort: { date: -1 } });
  }

  async findHistory(cropId: string, days = 30): Promise<MandiPriceEntity[]> {
    const since = new Date(Date.now() - days * 86400000);
    return this.collection
      .find({ cropId, date: { $gte: since } })
      .sort({ date: 1 })
      .toArray();
  }

  async count(): Promise<number> {
    return this.collection.countDocuments();
  }
}
