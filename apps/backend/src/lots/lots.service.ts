import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import {
  LotRepository,
  CropRepository,
  UserRepository,
  BidRepository,
  TransactionRepository,
  PaymentRepository,
} from '../repositories';
import {
  CropLotEntity,
  CropLotStatus,
  QualityGrade,
  CropUnit,
  Role,
  AuditAction,
} from '../database';
import { CreateCropLotDto, UpdateCropLotDto, QueryLotsDto } from './dto/create-lot.dto';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class LotsService {
  private readonly logger = new Logger(LotsService.name);

  constructor(
    private readonly lotRepository: LotRepository,
    private readonly cropRepository: CropRepository,
    private readonly userRepository: UserRepository,
    private readonly bidRepository: BidRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly auditService: AuditService,
    private readonly usersService: UsersService,
  ) {}

  private enrichLot(lot: any) {
    const bids = lot.bids || [];
    const activeBids = bids.filter((b: any) => b.status === 'PENDING');
    const highestBid = bids.length > 0 ? Math.max(...bids.map((b: any) => b.price || b.amount)) : null;
    const highestActiveBid = activeBids.length > 0 ? Math.max(...activeBids.map((b: any) => b.price || b.amount)) : null;

    return {
      ...lot,
      id: lot._id || lot.id,
      highestBid: highestActiveBid || highestBid,
      bidCount: lot._count?.bids ?? bids.length,
    };
  }

  async create(farmerId: string, dto: CreateCropLotDto) {
    // Profile Completion Gate Check
    const profile = await this.usersService.getProfile(farmerId).catch(() => null);
    if (profile && profile.profileCompletionStatus === 'INCOMPLETE') {
      const missing = profile.missingFields?.join(', ') || 'required fields';
      throw new BadRequestException(
        `Please complete your profile details (${missing}) before publishing a crop lot.`,
      );
    }

    if (Number(dto.quantity) <= 0) {
      throw new BadRequestException('Quantity must be greater than 0.');
    }
    if (Number(dto.expectedPrice) <= 0) {
      throw new BadRequestException('Expected price must be greater than 0.');
    }

    const lotId = `lot-${Date.now()}`;
    const lotData: CropLotEntity = {
      _id: lotId,
      farmerId,
      cropId: dto.cropId,
      quantity: Number(dto.quantity),
      unit: (dto.unit as CropUnit) || CropUnit.QUINTAL,
      expectedPrice: Number(dto.expectedPrice),
      qualityGrade: (dto.qualityGrade as QualityGrade) || QualityGrade.GRADE_A,
      district: profile?.district || 'Nashik',
      state: profile?.state || 'Maharashtra',
      location: dto.location || profile?.location || 'Pimpalgaon Farm Gate, Niphad, Nashik',
      harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : new Date(),
      status: CropLotStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const crop = await this.cropRepository.findById(dto.cropId);
    const created = await this.lotRepository.create(lotData);

    await this.auditService.log({
      actorId: farmerId,
      action: AuditAction.LOT_CREATED,
      lotId: created._id,
      price: created.expectedPrice,
      newQuantity: created.quantity,
      metadata: { cropName: crop?.name || 'Produce', location: created.location },
    });

    return this.enrichLot({
      ...created,
      crop: crop || { name: 'Crop', category: 'General' },
      farmer: profile || { name: 'Farmer' },
      bids: [],
      _count: { bids: 0 },
    });
  }

  async findAll(query: QueryLotsDto) {
    const filter: any = {};
    if (query.cropId) filter.cropId = query.cropId;
    if (query.farmerId) filter.farmerId = query.farmerId;
    if (query.status) filter.status = query.status;
    if (query.qualityGrade) filter.qualityGrade = query.qualityGrade;

    const lots = await this.lotRepository.findLots(filter);
    if (!lots || lots.length === 0) {
      return [];
    }

    const crops = await this.cropRepository.findAll();
    const farmers = await this.userRepository.findAll();
    const bids = await this.bidRepository.findAll();
    const txns = await this.transactionRepository.findAll();
    const payments = await this.paymentRepository.findAll();

    const cropMap = new Map(crops.map((c) => [c._id, c]));
    const farmerMap = new Map(farmers.map((f) => [f._id, f]));
    const paymentMap = new Map(payments.map((p) => [p.transactionId, p]));

    return lots.map((lot) => {
      const lotBids = bids.filter((b) => b.lotId === lot._id);
      const txn = txns.find((t) => t.lotId === lot._id);
      const farmer = farmerMap.get(lot.farmerId);
      const buyer = txn ? farmerMap.get(txn.buyerId) : null;

      return this.enrichLot({
        ...lot,
        id: lot._id,
        crop: cropMap.get(lot.cropId) || { name: 'Crop', category: 'General' },
        farmer: farmer
          ? {
              id: farmer._id,
              name: farmer.name,
              phone: farmer.phone,
              district: farmer.district,
              state: farmer.state,
              isVerified: farmer.isVerified,
              profilePhoto: farmer.profilePhoto,
            }
          : { name: 'Farmer' },
        bids: lotBids.map((b) => ({ ...b, id: b._id, price: b.amount })),
        transaction: txn
          ? {
              ...txn,
              id: txn._id,
              buyer: buyer ? { name: buyer.name, district: buyer.district } : { name: 'Buyer' },
              payment: paymentMap.get(txn._id) || { status: 'PENDING' },
            }
          : null,
        _count: { bids: lotBids.length },
      });
    });
  }

  async findOne(id: string) {
    const lot = await this.lotRepository.findById(id);
    if (!lot) {
      throw new NotFoundException(`Crop Lot with ID ${id} not found.`);
    }

    const crop = await this.cropRepository.findById(lot.cropId);
    const farmer = await this.userRepository.findById(lot.farmerId);
    const bids = await this.bidRepository.findByLot(lot._id);
    const txn = await this.transactionRepository.findByLotId(lot._id);
    let payment: any = null;
    let buyer: any = null;
    if (txn) {
      payment = await this.paymentRepository.findByTransactionId(txn._id);
      buyer = await this.userRepository.findById(txn.buyerId);
    }

    return this.enrichLot({
      ...lot,
      id: lot._id,
      crop: crop || { name: 'Crop', category: 'General' },
      farmer: farmer
        ? {
            id: farmer._id,
            name: farmer.name,
            phone: farmer.phone,
            district: farmer.district,
            state: farmer.state,
            isVerified: farmer.isVerified,
            profilePhoto: farmer.profilePhoto,
          }
        : { name: 'Farmer' },
      bids: bids.map((b) => ({ ...b, id: b._id, price: b.amount })),
      transaction: txn
        ? {
            ...txn,
            id: txn._id,
            buyer: buyer ? { name: buyer.name, district: buyer.district } : { name: 'Buyer' },
            payment,
          }
        : null,
      _count: { bids: bids.length },
    });
  }

  async update(lotId: string, userId: string, userRole: Role, dto: UpdateCropLotDto) {
    const lot = await this.findOne(lotId);
    if (lot.farmerId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You are not authorized to modify this lot.');
    }
    if (lot.status === CropLotStatus.SOLD) {
      throw new BadRequestException('Sold lots cannot be modified.');
    }

    const updated = await this.lotRepository.update(lotId, dto as any);
    if (!updated) {
      throw new NotFoundException(`Crop Lot with ID ${lotId} not found.`);
    }

    return this.enrichLot({ ...lot, ...updated });
  }

  async cancel(lotId: string, userId: string, userRole: Role) {
    const lot = await this.findOne(lotId);
    if (lot.farmerId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You are not authorized to cancel this lot.');
    }
    if (lot.status === CropLotStatus.SOLD) {
      throw new BadRequestException('A sold lot cannot be cancelled.');
    }

    const updated = await this.lotRepository.updateStatus(lotId, CropLotStatus.CANCELLED);
    if (!updated) {
      throw new NotFoundException(`Crop Lot with ID ${lotId} not found.`);
    }

    return this.enrichLot({ ...lot, status: CropLotStatus.CANCELLED });
  }
}
