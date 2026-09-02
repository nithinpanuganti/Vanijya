import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Payment,
  PaymentDocument,
  Transaction,
  TransactionDocument,
  PaymentStatus,
  Role,
  TransactionStatus,
  NotificationType,
} from '../database/schemas';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getPaymentByTransaction(transactionId: string, userId: string, role: Role) {
    const payment = await this.paymentModel.findOne({ transactionId }).lean();
    if (!payment) {
      throw new NotFoundException(`Payment record for transaction ${transactionId} not found.`);
    }

    const txn = await this.transactionModel.findById(transactionId).lean();
    if (role !== Role.ADMIN && txn?.buyerId !== userId && txn?.farmerId !== userId) {
      throw new ForbiddenException('You are not authorized to view this payment.');
    }

    return {
      ...payment,
      id: payment._id,
      transaction: txn ? { ...txn, id: txn._id } : null,
    };
  }

  async updatePaymentStatus(
    transactionId: string,
    userId: string,
    role: Role,
    dto: UpdatePaymentStatusDto,
  ) {
    const payment = await this.paymentModel.findOne({ transactionId }).lean();
    const txn = await this.transactionModel.findById(transactionId).lean();

    if (!payment || !txn) {
      throw new NotFoundException(`Payment record or transaction ${transactionId} not found.`);
    }

    if (role !== Role.ADMIN && txn.buyerId !== userId && txn.farmerId !== userId) {
      throw new ForbiddenException('You are not authorized to update this payment.');
    }

    if (payment.status === PaymentStatus.PAID && dto.status !== PaymentStatus.PAID) {
      throw new BadRequestException('Settled payments cannot be reverted.');
    }

    const updated = await this.paymentModel
      .findByIdAndUpdate(
        payment._id,
        {
          $set: {
            status: dto.status,
            paymentReference: dto.paymentReference || payment.paymentReference,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();

    if (dto.status === PaymentStatus.PAID) {
      await this.transactionModel.findByIdAndUpdate(transactionId, {
        $set: { status: TransactionStatus.COMPLETED, updatedAt: new Date() },
      });

      await this.notificationsService.create({
        recipientId: txn.farmerId,
        type: NotificationType.PAYMENT_PAID,
        title: 'Payment Received & Settled',
        message: `Payment of ₹${payment.amount.toLocaleString('en-IN')} has been marked as PAID (Ref: ${dto.paymentReference || 'UPI-SETTLED'}).`,
        entityType: 'TRANSACTION',
        entityId: transactionId,
      });
    }

    return { ...updated, id: updated?._id };
  }
}
