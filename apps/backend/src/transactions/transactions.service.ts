import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import {
  TransactionRepository,
  PaymentRepository,
  LotRepository,
  CropRepository,
  UserRepository,
} from '../repositories';
import { Role } from '../database/enums';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly lotRepository: LotRepository,
    private readonly cropRepository: CropRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async findAll(userId: string, role: Role) {
    const txns = await this.transactionRepository.findByUser(userId, role);
    if (!txns || txns.length === 0) return [];

    const lots = await this.lotRepository.findLots();
    const crops = await this.cropRepository.findAll();
    const users = await this.userRepository.findAll();
    const payments = await this.paymentRepository.findAll();

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
    const transaction = await this.transactionRepository.findById(id);
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

    const lot = await this.lotRepository.findById(transaction.lotId);
    const crop = lot ? await this.cropRepository.findById(lot.cropId) : null;
    const buyer = await this.userRepository.findById(transaction.buyerId);
    const farmer = await this.userRepository.findById(transaction.farmerId);
    const payment = await this.paymentRepository.findByTransactionId(transaction._id);

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
