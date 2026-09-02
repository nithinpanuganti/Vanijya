import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { COLLECTIONS } from '../database/database.constants';
import { PaymentEntity } from '../database/types';
import { PaymentStatus } from '../database/enums';
import { ClientSession, Filter } from 'mongodb';

@Injectable()
export class PaymentRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get collection() {
    return this.databaseService.getCollection<PaymentEntity>(COLLECTIONS.PAYMENTS);
  }

  async create(payment: PaymentEntity, session?: ClientSession): Promise<PaymentEntity> {
    await this.collection.insertOne(payment as any, { session });
    return payment;
  }

  async findById(id: string): Promise<PaymentEntity | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByTransactionId(transactionId: string): Promise<PaymentEntity | null> {
    return this.collection.findOne({ transactionId });
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    utrNumber?: string,
    session?: ClientSession,
  ): Promise<PaymentEntity | null> {
    const updates: Partial<PaymentEntity> = {
      status,
      updatedAt: new Date(),
    };
    if (utrNumber) {
      updates.utrNumber = utrNumber;
    }
    if (status === PaymentStatus.PAID) {
      updates.paidAt = new Date();
    }

    await this.collection.updateOne({ _id: id }, { $set: updates }, { session });
    return this.findById(id);
  }

  async updateByTransactionId(
    transactionId: string,
    status: PaymentStatus,
    utrNumber?: string,
    session?: ClientSession,
  ): Promise<PaymentEntity | null> {
    const updates: Partial<PaymentEntity> = {
      status,
      updatedAt: new Date(),
    };
    if (utrNumber) {
      updates.utrNumber = utrNumber;
    }
    if (status === PaymentStatus.PAID) {
      updates.paidAt = new Date();
    }

    await this.collection.updateOne({ transactionId }, { $set: updates }, { session });
    return this.findByTransactionId(transactionId);
  }

  async countByStatus(status?: PaymentStatus): Promise<number> {
    const query: Filter<PaymentEntity> = status ? { status } : {};
    return this.collection.countDocuments(query);
  }

  async findAll(filter?: Filter<PaymentEntity>): Promise<PaymentEntity[]> {
    return this.collection.find(filter || {}).sort({ createdAt: -1 }).toArray();
  }
}
