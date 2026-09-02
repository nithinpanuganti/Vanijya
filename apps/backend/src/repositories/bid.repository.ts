import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { BidEntity } from '../database/types';
import { BidStatus } from '../database/enums';
import { ClientSession, Filter } from 'mongodb';

@Injectable()
export class BidRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<BidEntity>(COLLECTIONS.BIDS);
  }

  async create(bid: BidEntity, session?: ClientSession): Promise<BidEntity> {
    await this.collection.insertOne(bid as any, { session });
    return bid;
  }

  async findById(id: string): Promise<BidEntity | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByLot(lotId: string, status?: BidStatus): Promise<BidEntity[]> {
    const query: Filter<BidEntity> = { lotId };
    if (status) query.status = status;
    return this.collection.find(query).sort({ amount: -1, createdAt: -1 }).toArray();
  }

  async findByBuyer(buyerId: string, status?: BidStatus): Promise<BidEntity[]> {
    const query: Filter<BidEntity> = { buyerId };
    if (status) query.status = status;
    return this.collection.find(query).sort({ createdAt: -1 }).toArray();
  }

  async updateQuantity(
    id: string,
    newQuantity: number,
    previousQuantity: number,
    session?: ClientSession,
  ): Promise<BidEntity | null> {
    await this.collection.updateOne(
      { _id: id },
      {
        $set: {
          quantity: newQuantity,
          previousQuantity,
          modifiedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { session },
    );
    return this.findById(id);
  }

  async updateStatus(id: string, status: BidStatus, session?: ClientSession): Promise<BidEntity | null> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { status, updatedAt: new Date() } },
      { session },
    );
    return this.findById(id);
  }

  async rejectOtherBidsForLot(lotId: string, winningBidId: string, session?: ClientSession): Promise<number> {
    const result = await this.collection.updateMany(
      { lotId, _id: { $ne: winningBidId }, status: BidStatus.PENDING },
      { $set: { status: BidStatus.REJECTED, updatedAt: new Date() } },
      { session },
    );
    return result.modifiedCount;
  }

  async countByStatus(status?: BidStatus): Promise<number> {
    const query: Filter<BidEntity> = status ? { status } : {};
    return this.collection.countDocuments(query);
  }

  async countModifiedBids(): Promise<number> {
    return this.collection.countDocuments({ modifiedAt: { $exists: true, $ne: null } });
  }

  async countWithdrawnBids(): Promise<number> {
    return this.collection.countDocuments({ status: BidStatus.WITHDRAWN });
  }

  async findAll(filter?: Filter<BidEntity>): Promise<BidEntity[]> {
    return this.collection.find(filter || {}).sort({ createdAt: -1 }).toArray();
  }
}
