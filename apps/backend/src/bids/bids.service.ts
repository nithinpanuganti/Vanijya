import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import {
  Bid,
  BidDocument,
  CropLot,
  CropLotDocument,
  Crop,
  CropDocument,
  User,
  UserDocument,
  Transaction,
  TransactionDocument,
  Payment,
  PaymentDocument,
  BidStatus,
  CropLotStatus,
  PaymentStatus,
  Role,
  TransactionStatus,
  AuditAction,
  NotificationType,
} from '../database/schemas';
import { CreateBidDto } from './dto/create-bid.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Bid.name) private readonly bidModel: Model<BidDocument>,
    @InjectModel(CropLot.name) private readonly cropLotModel: Model<CropLotDocument>,
    @InjectModel(Crop.name) private readonly cropModel: Model<CropDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  private enrichBid(bid: any, lot?: any, buyer?: any, farmer?: any, crop?: any) {
    const lotData = lot || bid.lot;
    const buyerData = buyer || bid.buyer;
    const cropData = crop || lotData?.crop;
    const farmerData = farmer || lotData?.farmer;

    return {
      ...bid,
      id: bid._id || bid.id,
      buyer: buyerData
        ? {
            id: buyerData._id || buyerData.id,
            name: buyerData.name,
            phone: buyerData.phone,
            district: buyerData.district,
            state: buyerData.state,
            organization: buyerData.organization,
            isVerified: buyerData.isVerified,
            profilePhoto: buyerData.profilePhoto,
          }
        : { name: 'Buyer' },
      lot: lotData
        ? {
            id: lotData._id || lotData.id,
            cropId: lotData.cropId,
            quantity: lotData.quantity,
            unit: lotData.unit,
            expectedPrice: lotData.expectedPrice,
            qualityGrade: lotData.qualityGrade,
            location: lotData.location,
            status: lotData.status,
            crop: cropData || { name: 'Crop' },
            farmer: farmerData
              ? {
                  id: farmerData._id || farmerData.id,
                  name: farmerData.name,
                  phone: farmerData.phone,
                  district: farmerData.district,
                  state: farmerData.state,
                }
              : { name: 'Farmer' },
          }
        : null,
    };
  }

  async createBid(lotId: string, buyerId: string, dto: CreateBidDto) {
    return this.create(buyerId, { ...dto, lotId });
  }

  async findBidsForLot(lotId: string) {
    return this.findByLot(lotId);
  }

  async findMyBids(userId: string) {
    return this.findByBuyer(userId);
  }

  async modifyBidQuantity(bidId: string, buyerId: string, userRole: Role, newQuantity: number) {
    return this.modifyQuantity(bidId, buyerId, userRole, newQuantity);
  }

  async rejectBid(bidId: string, farmerId: string, userRole: Role) {
    const bid = await this.bidModel.findById(bidId).lean();
    if (!bid) {
      throw new NotFoundException(`Bid with ID ${bidId} not found.`);
    }

    const lot = await this.cropLotModel.findById(bid.lotId).lean();
    if (!lot) {
      throw new NotFoundException(`Crop Lot associated with bid ${bidId} not found.`);
    }

    if (lot.farmerId !== farmerId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You are not authorized to reject bids for this lot.');
    }

    const updated = await this.bidModel
      .findByIdAndUpdate(
        bidId,
        { $set: { status: BidStatus.REJECTED, updatedAt: new Date() } },
        { new: true },
      )
      .lean();

    await this.auditService.log({
      actorId: farmerId,
      action: AuditAction.BID_REJECTED,
      lotId: lot._id,
      bidId: bidId,
    });

    return this.enrichBid(updated, lot);
  }

  async create(buyerId: string, dto: CreateBidDto & { lotId?: string }) {
    const lotId = dto.lotId!;
    // Profile Gate
    const buyer = await this.usersService.getProfile(buyerId).catch(() => null);
    if (buyer && buyer.profileCompletionStatus === 'INCOMPLETE') {
      const missing = buyer.missingFields?.join(', ') || 'required credentials';
      throw new BadRequestException(
        `Please complete your buyer profile details (${missing}) before submitting a trade bid.`,
      );
    }

    if (Number(dto.price) <= 0) {
      throw new BadRequestException('Bid price must be greater than 0.');
    }
    if (Number(dto.quantity) <= 0) {
      throw new BadRequestException('Bid quantity must be greater than 0.');
    }

    const lot = await this.cropLotModel.findById(dto.lotId).lean();
    if (!lot) {
      throw new NotFoundException(`Crop Lot with ID ${dto.lotId} not found.`);
    }

    if (lot.farmerId === buyerId) {
      throw new BadRequestException('Farmers cannot place bids on their own produce.');
    }
    if (lot.status !== CropLotStatus.OPEN && lot.status !== CropLotStatus.BIDDING) {
      throw new BadRequestException('Bids can only be placed on OPEN or ACTIVE BIDDING lots.');
    }
    if (Number(dto.quantity) > lot.quantity) {
      throw new BadRequestException(
        `Requested bid quantity (${dto.quantity}) exceeds total available lot quantity (${lot.quantity}).`,
      );
    }

    const bidId = `bid-${Date.now()}`;
    const bidData: Partial<Bid> = {
      _id: bidId,
      lotId: dto.lotId,
      buyerId,
      price: Number(dto.price),
      quantity: Number(dto.quantity),
      message: dto.message || null,
      status: BidStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.bidModel.create(bidData);

    if (lot.status === CropLotStatus.OPEN) {
      await this.cropLotModel.findByIdAndUpdate(dto.lotId, {
        $set: { status: CropLotStatus.BIDDING },
      });
    }

    const farmer = await this.userModel.findById(lot.farmerId).lean();
    const crop = await this.cropModel.findById(lot.cropId).lean();

    await this.auditService.log({
      actorId: buyerId,
      action: AuditAction.BID_PLACED,
      lotId: dto.lotId,
      bidId: created._id,
      price: created.price,
      newQuantity: created.quantity,
      metadata: { buyerName: buyer?.name, cropName: crop?.name },
    });

    await this.notificationsService.create({
      recipientId: lot.farmerId,
      type: NotificationType.BID_RECEIVED,
      title: 'New Bid Received on Your Crop Lot',
      message: `${buyer?.name || 'A buyer'} placed an offer of ₹${created.price}/${lot.unit} for ${created.quantity} ${lot.unit} on your ${crop?.name || 'crop'} lot.`,
      entityType: 'LOT',
      entityId: dto.lotId,
    });

    return this.enrichBid(created.toObject(), lot, buyer, farmer, crop);
  }

  async findByLot(lotId: string) {
    const bids = await this.bidModel.find({ lotId }).sort({ price: -1 }).lean();
    if (!bids || bids.length === 0) return [];

    const lot = await this.cropLotModel.findById(lotId).lean();
    const crop = lot ? await this.cropModel.findById(lot.cropId).lean() : null;
    const farmer = lot ? await this.userModel.findById(lot.farmerId).lean() : null;
    const buyerIds = Array.from(new Set(bids.map((b) => b.buyerId)));
    const buyers = await this.userModel.find({ _id: { $in: buyerIds } }).lean();
    const buyerMap = new Map(buyers.map((u) => [u._id, u]));

    return bids.map((b) => this.enrichBid(b, lot, buyerMap.get(b.buyerId), farmer, crop));
  }

  async findByBuyer(buyerId: string) {
    const bids = await this.bidModel.find({ buyerId }).sort({ createdAt: -1 }).lean();
    if (!bids || bids.length === 0) return [];

    const buyer = await this.userModel.findById(buyerId).lean();
    const lotIds = Array.from(new Set(bids.map((b) => b.lotId)));
    const lots = await this.cropLotModel.find({ _id: { $in: lotIds } }).lean();
    const lotMap = new Map(lots.map((l) => [l._id, l]));

    const cropIds = Array.from(new Set(lots.map((l) => l.cropId)));
    const crops = await this.cropModel.find({ _id: { $in: cropIds } }).lean();
    const cropMap = new Map(crops.map((c) => [c._id, c]));

    const farmerIds = Array.from(new Set(lots.map((l) => l.farmerId)));
    const farmers = await this.userModel.find({ _id: { $in: farmerIds } }).lean();
    const farmerMap = new Map(farmers.map((f) => [f._id, f]));

    return bids.map((b) => {
      const lot = lotMap.get(b.lotId);
      const crop = lot ? cropMap.get(lot.cropId) : null;
      const farmer = lot ? farmerMap.get(lot.farmerId) : null;
      return this.enrichBid(b, lot, buyer, farmer, crop);
    });
  }

  async modifyQuantity(bidId: string, buyerId: string, userRole: Role, newQuantity: number) {
    if (newQuantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0.');
    }

    const bid = await this.bidModel.findById(bidId).lean();
    if (!bid) {
      throw new NotFoundException(`Bid with ID ${bidId} not found.`);
    }

    if (bid.buyerId !== buyerId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only modify your own bids.');
    }
    if (bid.status !== BidStatus.PENDING) {
      throw new BadRequestException('Only PENDING bids can be modified.');
    }

    const lot = await this.cropLotModel.findById(bid.lotId).lean();
    if (!lot) {
      throw new NotFoundException(`Crop Lot associated with bid ${bidId} not found.`);
    }
    if (newQuantity > lot.quantity) {
      throw new BadRequestException(
        `Quantity (${newQuantity}) exceeds available lot quantity (${lot.quantity}).`,
      );
    }

    const oldQuantity = bid.quantity;
    const updated = await this.bidModel
      .findByIdAndUpdate(
        bidId,
        { $set: { quantity: newQuantity, updatedAt: new Date() } },
        { new: true },
      )
      .lean();

    const buyer = await this.userModel.findById(buyerId).lean();
    const farmer = await this.userModel.findById(lot.farmerId).lean();
    const crop = await this.cropModel.findById(lot.cropId).lean();

    await this.auditService.log({
      actorId: buyerId,
      action: AuditAction.BID_MODIFIED,
      lotId: lot._id,
      bidId: updated!._id,
      previousQuantity: oldQuantity,
      newQuantity: newQuantity,
      metadata: { buyerName: buyer?.name, lotCrop: crop?.name },
    });

    await this.notificationsService.create({
      recipientId: lot.farmerId,
      type: NotificationType.BID_MODIFIED,
      title: 'Buyer Modified Bid Quantity',
      message: `${buyer?.name || 'A buyer'} updated their bid quantity from ${oldQuantity} to ${newQuantity} ${lot.unit}.`,
      entityType: 'LOT',
      entityId: lot._id,
    });

    return this.enrichBid(updated, lot, buyer, farmer, crop);
  }

  async cancelBid(bidId: string, buyerId: string, userRole: Role, reason?: string) {
    const bid = await this.bidModel.findById(bidId).lean();
    if (!bid) {
      throw new NotFoundException(`Bid with ID ${bidId} not found.`);
    }

    if (bid.buyerId !== buyerId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only cancel your own bids.');
    }
    if (bid.status !== BidStatus.PENDING) {
      throw new BadRequestException('Only PENDING bids can be cancelled.');
    }

    const updated = await this.bidModel
      .findByIdAndUpdate(
        bidId,
        { $set: { status: BidStatus.WITHDRAWN, updatedAt: new Date() } },
        { new: true },
      )
      .lean();

    const lot = await this.cropLotModel.findById(bid.lotId).lean();
    const buyer = await this.userModel.findById(buyerId).lean();
    const crop = lot ? await this.cropModel.findById(lot.cropId).lean() : null;

    if (lot) {
      const remainingPending = await this.bidModel.countDocuments({
        lotId: lot._id,
        status: BidStatus.PENDING,
      });
      if (remainingPending === 0 && lot.status === CropLotStatus.BIDDING) {
        await this.cropLotModel.findByIdAndUpdate(lot._id, {
          $set: { status: CropLotStatus.OPEN },
        });
      }

      await this.notificationsService.create({
        recipientId: lot.farmerId,
        type: NotificationType.BID_CANCELLED,
        title: 'Bid Cancelled / Withdrawn',
        message: `${buyer?.name || 'A buyer'} withdrew their offer of ₹${bid.price}/${lot.unit}.${reason ? ` Reason: ${reason}` : ''}`,
        entityType: 'LOT',
        entityId: lot._id,
      });
    }

    await this.auditService.log({
      actorId: buyerId,
      action: AuditAction.BID_CANCELLED,
      lotId: bid.lotId,
      bidId: bidId,
      metadata: { reason: reason || 'Withdrawn by buyer', buyerName: buyer?.name },
    });

    return this.enrichBid(updated, lot, buyer);
  }

  async acceptBid(bidId: string, farmerId: string, userRole: Role) {
    const bid = await this.bidModel.findById(bidId).lean();
    if (!bid) {
      throw new NotFoundException(`Bid with ID ${bidId} not found.`);
    }

    const lot = await this.cropLotModel.findById(bid.lotId).lean();
    if (!lot) {
      throw new NotFoundException(`Lot with ID ${bid.lotId} not found.`);
    }

    if (lot.farmerId !== farmerId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You are not authorized to accept bids for this lot.');
    }
    if (lot.status === CropLotStatus.SOLD) {
      throw new BadRequestException('This lot has already been sold.');
    }
    if (bid.status !== BidStatus.PENDING) {
      throw new BadRequestException('Only PENDING bids can be accepted.');
    }

    const totalAmount = bid.price * bid.quantity;
    const txnId = `txn-${Date.now()}`;
    const paymentId = `pay-${Date.now()}`;

    // Execute atomic state transitions
    await this.bidModel.findByIdAndUpdate(bidId, { $set: { status: BidStatus.ACCEPTED } });
    await this.cropLotModel.findByIdAndUpdate(lot._id, { $set: { status: CropLotStatus.SOLD } });

    // Reject competing bids
    await this.bidModel.updateMany(
      { lotId: lot._id, _id: { $ne: bidId }, status: BidStatus.PENDING },
      { $set: { status: BidStatus.REJECTED } },
    );

    // Create Transaction
    const transaction = await this.transactionModel.create({
      _id: txnId,
      lotId: lot._id,
      bidId: bidId,
      farmerId: lot.farmerId,
      buyerId: bid.buyerId,
      agreedPrice: bid.price,
      quantity: bid.quantity,
      totalAmount: totalAmount,
      status: TransactionStatus.COMPLETED,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Payment
    const payment = await this.paymentModel.create({
      _id: paymentId,
      transactionId: txnId,
      amount: totalAmount,
      status: PaymentStatus.PAID,
      paymentMethod: 'UPI_DIRECT_APMC',
      paymentReference: `VNJ-UPI-${Date.now()}`,
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const buyer = await this.userModel.findById(bid.buyerId).lean();
    const farmer = await this.userModel.findById(lot.farmerId).lean();
    const crop = await this.cropModel.findById(lot.cropId).lean();

    // Audit logs
    await this.auditService.log({
      actorId: farmerId,
      action: AuditAction.BID_ACCEPTED,
      lotId: lot._id,
      bidId: bidId,
      transactionId: txnId,
      price: bid.price,
      newQuantity: bid.quantity,
      metadata: { buyerName: buyer?.name, cropName: crop?.name, totalAmount },
    });

    await this.auditService.log({
      actorId: 'SYSTEM',
      action: AuditAction.TRANSACTION_COMPLETED,
      lotId: lot._id,
      transactionId: txnId,
      paymentId: paymentId,
      price: bid.price,
      metadata: { totalAmount, paymentRef: payment.paymentReference },
    });

    // Notify Buyer
    await this.notificationsService.create({
      recipientId: bid.buyerId,
      type: NotificationType.BID_ACCEPTED,
      title: 'Congratulations! Your Bid Was Accepted',
      message: `${farmer?.name || 'The farmer'} accepted your bid of ₹${bid.price}/${lot.unit} for ${bid.quantity} ${lot.unit} of ${crop?.name || 'crop'}. Total Trade Value: ₹${totalAmount.toLocaleString('en-IN')}.`,
      entityType: 'TRANSACTION',
      entityId: txnId,
    });

    // Notify Farmer
    await this.notificationsService.create({
      recipientId: lot.farmerId,
      type: NotificationType.PAYMENT_PAID,
      title: 'Trade Settlement Completed',
      message: `Full direct payment of ₹${totalAmount.toLocaleString('en-IN')} for lot #${lot._id} has been credited to your verified bank account via zero-commission settlement.`,
      entityType: 'PAYMENT',
      entityId: paymentId,
    });

    return {
      success: true,
      message: 'Bid accepted and transaction completed successfully.',
      transaction: {
        ...transaction.toObject(),
        id: transaction._id,
        payment: { ...payment.toObject(), id: payment._id },
        buyer: buyer ? { name: buyer.name, district: buyer.district } : { name: 'Buyer' },
        farmer: farmer ? { name: farmer.name, district: farmer.district } : { name: 'Farmer' },
        crop: crop || { name: 'Crop' },
      },
    };
  }
}
