import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { TransactionEntity } from '../database/types';
import { TransactionStatus } from '../database/enums';
import { ClientSession, Filter } from 'mongodb';

@Injectable()
export class TransactionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<TransactionEntity>(COLLECTIONS.TRANSACTIONS);
  }

  async create(transaction: TransactionEntity, session?: ClientSession): Promise<TransactionEntity> {
    await this.collection.insertOne(transaction as any, { session });
    return transaction;
  }

  async findById(id: string): Promise<TransactionEntity | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByLotId(lotId: string): Promise<TransactionEntity | null> {
    return this.collection.findOne({ lotId });
  }

  async findByUser(userId: string, role?: string): Promise<TransactionEntity[]> {
    const query: Filter<TransactionEntity> =
      role === 'FARMER'
        ? { farmerId: userId }
        : role === 'BUYER'
        ? { buyerId: userId }
        : { $or: [{ farmerId: userId }, { buyerId: userId }] };

    return this.collection.find(query).sort({ createdAt: -1 }).toArray();
  }

  async findByFarmer(farmerId: string): Promise<TransactionEntity[]> {
    return this.collection.find({ farmerId }).sort({ createdAt: -1 }).toArray();
  }

  async findByBuyer(buyerId: string): Promise<TransactionEntity[]> {
    return this.collection.find({ buyerId }).sort({ createdAt: -1 }).toArray();
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    session?: ClientSession,
  ): Promise<TransactionEntity | null> {
    const updates: Partial<TransactionEntity> = {
      status,
      updatedAt: new Date(),
    };
    if (status === TransactionStatus.COMPLETED) {
      updates.completedAt = new Date();
    }
    await this.collection.updateOne({ _id: id }, { $set: updates }, { session });
    return this.findById(id);
  }

  async findAll(filter?: Filter<TransactionEntity>): Promise<TransactionEntity[]> {
    return this.collection.find(filter || {}).sort({ createdAt: -1 }).toArray();
  }

  async countByStatus(status?: TransactionStatus): Promise<number> {
    const query: Filter<TransactionEntity> = status ? { status } : {};
    return this.collection.countDocuments(query);
  }

  async aggregateTotalGmv(): Promise<number> {
    const result = await this.collection
      .aggregate([{ $group: { _id: null, totalGmv: { $sum: '$totalAmount' } } }])
      .toArray();

    return result[0]?.totalGmv || 0;
  }

  async calculateFarmerSalesVolume(farmerId: string): Promise<{ totalAmount: number; count: number }> {
    const result = await this.collection
      .aggregate([
        { $match: { farmerId } },
        { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ])
      .toArray();

    return {
      totalAmount: result[0]?.totalAmount || 0,
      count: result[0]?.count || 0,
    };
  }

  async calculateBuyerProcurementVolume(buyerId: string): Promise<{ totalAmount: number; count: number }> {
    const result = await this.collection
      .aggregate([
        { $match: { buyerId } },
        { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ])
      .toArray();

    return {
      totalAmount: result[0]?.totalAmount || 0,
      count: result[0]?.count || 0,
    };
  }
}
