import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  Payment,
  PaymentDocument,
  CropLot,
  CropLotDocument,
  Crop,
  CropDocument,
  User,
  UserDocument,
  Role,
} from '../database/schemas';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(CropLot.name) private readonly cropLotModel: Model<CropLotDocument>,
    @InjectModel(Crop.name) private readonly cropModel: Model<CropDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll(userId: string, role: Role) {
    const filter: any = {};
    if (role === Role.FARMER) filter.farmerId = userId;
    if (role === Role.BUYER) filter.buyerId = userId;

    const txns = await this.transactionModel.find(filter).sort({ createdAt: -1 }).lean();
    if (!txns || txns.length === 0) return [];

    const lots = await this.cropLotModel.find().lean();
    const crops = await this.cropModel.find().lean();
    const users = await this.userModel.find().lean();
    const payments = await this.paymentModel.find().lean();

    const lotMap = new Map(lots.map((l) => [l._id, l]));
    const cropMap = new Map(crops.map((c) => [c._id, c]));
    const userMap = new Map(users.map((u) => [u._id, u]));
    const paymentMap = new Map(payments.map((p) => [p.transactionId, p]));

    return txns.map((t) => {
      const lot = lotMap.get(t.lotId);
      const crop = lot ? cropMap.get(lot.cropId) : null;
      const buyer = userMap.get(t.buyerId);
      const farmer = userMap.get(t.farmerId);
      const payment = paymentMap.get(t._id);

      return {
        ...t,
        id: t._id,
        lot: lot ? { ...lot, id: lot._id, crop: crop || { name: 'Produce' } } : null,
        buyer: buyer
          ? {
              name: buyer.name,
              district: buyer.district,
              state: buyer.state,
              phone: buyer.phone,
              email: buyer.email,
            }
          : { name: 'Buyer' },
        farmer: farmer
          ? {
              name: farmer.name,
              district: farmer.district,
              state: farmer.state,
              phone: farmer.phone,
            }
          : { name: 'Farmer' },
        payment: payment ? { ...payment, id: payment._id } : null,
      };
    });
  }

  async findOne(id: string, userId: string, role: Role) {
    const transaction = await this.transactionModel.findById(id).lean();
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found.`);
    }

    if (
      role !== Role.ADMIN &&
      transaction.farmerId !== userId &&
      transaction.buyerId !== userId
    ) {
      throw new ForbiddenException('You are not authorized to view this transaction.');
    }

    const lot = await this.cropLotModel.findById(transaction.lotId).lean();
    const crop = lot ? await this.cropModel.findById(lot.cropId).lean() : null;
    const buyer = await this.userModel.findById(transaction.buyerId).lean();
    const farmer = await this.userModel.findById(transaction.farmerId).lean();
    const payment = await this.paymentModel.findOne({ transactionId: transaction._id }).lean();

    return {
      ...transaction,
      id: transaction._id,
      lot: lot ? { ...lot, id: lot._id, crop: crop || { name: 'Produce' } } : null,
      buyer: buyer
        ? {
            name: buyer.name,
            district: buyer.district,
            phone: buyer.phone,
            email: buyer.email,
          }
        : { name: 'Buyer' },
      farmer: farmer
        ? {
            name: farmer.name,
            district: farmer.district,
            phone: farmer.phone,
          }
        : { name: 'Farmer' },
      payment: payment ? { ...payment, id: payment._id } : null,
    };
  }
}
