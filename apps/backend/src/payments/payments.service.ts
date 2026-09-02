import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PaymentRepository, TransactionRepository } from '../repositories';
import { PaymentStatus, Role, TransactionStatus, NotificationType } from '../database/enums';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getPaymentByTransaction(transactionId: string, userId: string, role: Role) {
    const payment = await this.paymentRepository.findByTransactionId(transactionId);
    if (!payment) {
      throw new NotFoundException(`Payment record for transaction ${transactionId} not found.`);
    }

    const txn = await this.transactionRepository.findById(transactionId);
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
    const payment = await this.paymentRepository.findByTransactionId(transactionId);
    const txn = await this.transactionRepository.findById(transactionId);

    if (!payment || !txn) {
      throw new NotFoundException(`Payment record or transaction ${transactionId} not found.`);
    }

    if (role !== Role.ADMIN && txn.buyerId !== userId && txn.farmerId !== userId) {
      throw new ForbiddenException('You are not authorized to update this payment.');
    }

    if (payment.status === PaymentStatus.PAID && dto.status !== PaymentStatus.PAID) {
      throw new BadRequestException('Settled payments cannot be reverted.');
    }

    const updated = await this.paymentRepository.updateByTransactionId(
      transactionId,
      dto.status,
      dto.paymentReference || (dto as any).utrNumber,
    );

    if (dto.status === PaymentStatus.PAID) {
      await this.transactionRepository.updateStatus(transactionId, TransactionStatus.COMPLETED);

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
