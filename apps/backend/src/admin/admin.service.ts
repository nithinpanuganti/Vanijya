import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import {
  UserRepository,
  LotRepository,
  CropRepository,
  BidRepository,
  TransactionRepository,
  PaymentRepository,
  AuditRepository,
} from '../repositories';
import {
  CropLotStatus,
  BidStatus,
  PaymentStatus,
  Role,
  AuditAction,
  ApprovalStatus,
  VerificationStatus,
  NotificationType,
} from '../database/enums';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly lotRepository: LotRepository,
    private readonly cropRepository: CropRepository,
    private readonly bidRepository: BidRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly auditRepository: AuditRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getDashboardStats() {
    const recentActivity = await this.auditService.getRecent(10);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalFarmers,
      totalBuyers,
      pendingFarmers,
      pendingBuyers,
      allUsers,
      activeLots,
      activeBiddingLots,
      soldLots,
      cancelledLots,
      pendingBids,
      acceptedBids,
      cancelledBids,
      transactions,
      payments,
    ] = await Promise.all([
      this.userRepository.countByRole(Role.FARMER),
      this.userRepository.countByRole(Role.BUYER),
      this.userRepository.countByRole(Role.FARMER, ApprovalStatus.PENDING),
      this.userRepository.countByRole(Role.BUYER, ApprovalStatus.PENDING),
      this.userRepository.findAll(),
      this.lotRepository.findLots({ status: { $in: [CropLotStatus.OPEN, CropLotStatus.BIDDING] } } as any).then((l) => l.length),
      this.lotRepository.countByStatus(CropLotStatus.BIDDING),
      this.lotRepository.countByStatus(CropLotStatus.SOLD),
      this.lotRepository.countByStatus(CropLotStatus.CANCELLED),
      this.bidRepository.countByStatus(BidStatus.PENDING),
      this.bidRepository.countByStatus(BidStatus.ACCEPTED),
      this.bidRepository.countByStatus(BidStatus.WITHDRAWN),
      this.transactionRepository.findAll(),
      this.paymentRepository.findAll(),
    ]);

    const approvedToday = allUsers.filter(
      (u) => u.approvalStatus === ApprovalStatus.APPROVED && u.approvedAt && new Date(u.approvedAt) >= todayStart,
    ).length;

    const rejectedToday = allUsers.filter(
      (u) => u.approvalStatus === ApprovalStatus.REJECTED && u.updatedAt && new Date(u.updatedAt) >= todayStart,
    ).length;

    const totalTransactionValue = transactions.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
    const completedPaymentsValue = payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((acc, p) => acc + (p.amount || 0), 0);
    const pendingPaymentsValue = payments
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((acc, p) => acc + (p.amount || 0), 0);

    return {
      kpis: {
        totalFarmers,
        totalBuyers,
        pendingFarmers,
        pendingBuyers,
        approvedToday,
        rejectedToday,
        activeLots,
        activeBiddingLots,
        soldLots,
        cancelledLots,
        pendingBids,
        acceptedBids,
        cancelledBids,
        totalTransactionValue,
        completedPaymentsValue,
        pendingPaymentsValue,
        platformFeeEliminatedSavings: Math.round(totalTransactionValue * 0.04),
      },
      recentActivity,
    };
  }

  async getRegistrations(filters?: {
    role?: Role;
    status?: ApprovalStatus;
    search?: string;
    sort?: 'asc' | 'desc';
  }) {
    const query: any = {};
    if (filters?.role) query.role = filters.role;
    if (filters?.status) query.approvalStatus = filters.status;

    let users = await this.userRepository.findAll(query);
    if (filters?.sort === 'asc') {
      users = users.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      users = users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    if (filters?.search && filters.search.trim() !== '') {
      const s = filters.search.toLowerCase().trim();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(s) ||
          (u.phone && u.phone.includes(s)) ||
          (u.email && u.email.toLowerCase().includes(s)) ||
          (u.organization && u.organization.toLowerCase().includes(s)) ||
          (u.district && u.district.toLowerCase().includes(s)) ||
          (u.state && u.state.toLowerCase().includes(s)),
      );
    }

    return users.map((u) => ({
      id: u._id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: u.role,
      approvalStatus: u.approvalStatus || ApprovalStatus.APPROVED,
      verificationStatus: u.verificationStatus || VerificationStatus.VERIFIED,
      rejectionReason: u.rejectionReason,
      profilePhoto: u.profilePhoto,
      district: u.district,
      state: u.state,
      village: u.village,
      location: u.location,
      geoPoint: u.geoPoint,
      organization: u.organization,
      contactPerson: u.contactPerson,
      businessType: u.businessType,
      warehouseLocation: u.warehouseLocation,
      primaryCrop: u.primaryCrop,
      farmSize: u.farmSize,
      gstin: u.gstin,
      fssai: u.fssai,
      kccNumber: u.kccNumber,
      apmcLicense: u.apmcLicense,
      createdAt: u.createdAt,
      approvedAt: u.approvedAt,
    }));
  }

  async getRegistrationById(id: string) {
    return this.getUserDossier(id);
  }

  async getUserDossier(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const auditLogs = await this.auditModelLogsForActor(userId);
    let lots: any[] = [];
    let bids: any[] = [];

    if (user.role === Role.FARMER) {
      lots = await this.lotRepository.findFarmerLots(userId);
    } else if (user.role === Role.BUYER) {
      bids = await this.bidRepository.findByBuyer(userId);
    }

    return {
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
        verificationStatus: user.verificationStatus,
        rejectionReason: user.rejectionReason,
        profilePhoto: user.profilePhoto,
        district: user.district,
        state: user.state,
        village: user.village,
        location: user.location,
        geoPoint: user.geoPoint,
        organization: user.organization,
        contactPerson: user.contactPerson,
        businessType: user.businessType,
        warehouseLocation: user.warehouseLocation,
        primaryCrop: user.primaryCrop,
        farmSize: user.farmSize,
        gstin: user.gstin,
        fssai: user.fssai,
        kccNumber: user.kccNumber,
        apmcLicense: user.apmcLicense,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        approvedAt: user.approvedAt,
      },
      lots: lots.map((l) => ({ ...l, id: l._id })),
      bids: bids.map((b) => ({ ...b, id: b._id, price: b.amount })),
      auditLogs,
    };
  }

  private async auditModelLogsForActor(actorId: string) {
    const logs = await this.auditRepository.findByActor(actorId, 20);
    return logs.map((l) => ({ ...l, id: l._id }));
  }

  async approveUser(userId: string, adminId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const updated = await this.userRepository.updateApprovalStatus(
      userId,
      ApprovalStatus.APPROVED,
      adminId,
    );

    await this.auditService.log({
      actorId: adminId,
      action: AuditAction.USER_APPROVED,
      metadata: { targetUserId: userId, role: user.role, name: user.name },
    });

    await this.notificationsService.create({
      recipientId: userId,
      type: NotificationType.SYSTEM,
      title: 'Vanijya Account Approved & Verified',
      message:
        'Your registration application has been verified and approved by the Ministry Administrator. You now have full access to the portal.',
      entityType: 'USER',
      entityId: userId,
    });

    return {
      success: true,
      message: `User ${user.name} has been approved and verified.`,
      user: {
        id: updated!._id,
        name: updated!.name,
        role: updated!.role,
        approvalStatus: updated!.approvalStatus,
        verificationStatus: updated!.verificationStatus,
      },
    };
  }

  async rejectUser(userId: string, adminId: string, reason: string) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('A constructive rejection reason is required.');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const updated = await this.userRepository.updateApprovalStatus(
      userId,
      ApprovalStatus.REJECTED,
      adminId,
      reason.trim(),
    );

    await this.auditService.log({
      actorId: adminId,
      action: AuditAction.USER_REJECTED,
      metadata: { targetUserId: userId, role: user.role, name: user.name, reason },
    });

    await this.notificationsService.create({
      recipientId: userId,
      type: NotificationType.SYSTEM,
      title: 'Registration Application Update',
      message: `Your Vanijya registration could not be approved at this time. Reason: ${reason.trim()}`,
      entityType: 'USER',
      entityId: userId,
    });

    return {
      success: true,
      message: `User ${user.name} application has been rejected.`,
      user: {
        id: updated!._id,
        name: updated!.name,
        role: updated!.role,
        approvalStatus: updated!.approvalStatus,
        rejectionReason: updated!.rejectionReason,
      },
    };
  }

  async getUsers() {
    return this.getAllUsers();
  }

  async getAllUsers(role?: Role) {
    const query: any = {};
    if (role) query.role = role;
    const users = await this.userRepository.findAll(query);
    return users.map((u) => ({
      id: u._id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: u.role,
      approvalStatus: u.approvalStatus || ApprovalStatus.APPROVED,
      verificationStatus: u.verificationStatus || VerificationStatus.VERIFIED,
      profilePhoto: u.profilePhoto,
      district: u.district,
      state: u.state,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
    }));
  }

  async getAllLots(status?: any) {
    const query: any = {};
    if (typeof status === 'string') query.status = status;
    else if (status && typeof status === 'object') Object.assign(query, status);

    const lots = await this.lotRepository.findLots(query);
    const crops = await this.cropRepository.findAll();
    const farmers = await this.userRepository.findAll();
    const bids = await this.bidRepository.findAll();

    const cropMap = new Map(crops.map((c) => [c._id, c]));
    const farmerMap = new Map(farmers.map((f) => [f._id, f]));

    return lots.map((l) => {
      const lotBids = bids.filter((b) => b.lotId === l._id);
      const farmer = farmerMap.get(l.farmerId);
      return {
        ...l,
        id: l._id,
        crop: cropMap.get(l.cropId) || { name: 'Crop' },
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
        _count: { bids: lotBids.length },
      };
    });
  }

  async getAllBids(status?: any) {
    const query: any = {};
    if (typeof status === 'string') query.status = status;
    else if (status && typeof status === 'object') Object.assign(query, status);

    const bids = await this.bidRepository.findAll(query);
    const buyers = await this.userRepository.findAll();
    const lots = await this.lotRepository.findLots();
    const crops = await this.cropRepository.findAll();

    const buyerMap = new Map(buyers.map((u) => [u._id, u]));
    const lotMap = new Map(lots.map((l) => [l._id, l]));
    const cropMap = new Map(crops.map((c) => [c._id, c]));

    return bids.map((b) => {
      const buyer = buyerMap.get(b.buyerId);
      const lot = lotMap.get(b.lotId);
      const crop = lot ? cropMap.get(lot.cropId) : null;
      return {
        ...b,
        id: b._id,
        price: b.amount,
        buyer: buyer
          ? {
              id: buyer._id,
              name: buyer.name,
              phone: buyer.phone,
              district: buyer.district,
              state: buyer.state,
              organization: buyer.organization,
              isVerified: buyer.isVerified,
              profilePhoto: buyer.profilePhoto,
            }
          : { name: 'Buyer' },
        lot: lot ? { id: lot._id, crop: crop || { name: 'Crop' } } : null,
      };
    });
  }

  async getActivityFeed(limit: number = 50) {
    return this.auditService.getRecent(limit);
  }

  async getPlatformMetrics() {
    const [farmers, buyers, lots, bids, txns, payments] = await Promise.all([
      this.userRepository.findAll({ role: Role.FARMER } as any),
      this.userRepository.findAll({ role: Role.BUYER } as any),
      this.lotRepository.findLots(),
      this.bidRepository.findAll(),
      this.transactionRepository.findAll(),
      this.paymentRepository.findAll(),
    ]);

    const totalTransactionValue = txns.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
    const completedPaymentsValue = payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((acc, p) => acc + (p.amount || 0), 0);

    return {
      activeParticipants: {
        farmers: farmers.map((f) => ({
          id: f._id,
          name: f.name,
          district: f.district,
          state: f.state,
          primaryCrop: f.primaryCrop,
          activeLots: lots.filter((l) => l.farmerId === f._id && l.status !== CropLotStatus.SOLD)
            .length,
          soldLots: lots.filter((l) => l.farmerId === f._id && l.status === CropLotStatus.SOLD)
            .length,
        })),
        buyers: buyers.map((b) => ({
          id: b._id,
          name: b.name,
          organization: b.organization,
          district: b.district,
          state: b.state,
          activeBids: bids.filter((bid) => bid.buyerId === b._id && bid.status === BidStatus.PENDING)
            .length,
          acceptedBids: bids.filter(
            (bid) => bid.buyerId === b._id && bid.status === BidStatus.ACCEPTED,
          ).length,
          cancelledBids: bids.filter(
            (bid) => bid.buyerId === b._id && bid.status === BidStatus.WITHDRAWN,
          ).length,
        })),
      },
      gmv: totalTransactionValue,
      settledGmv: completedPaymentsValue,
      platformFeeSavings: Math.round(totalTransactionValue * 0.04),
    };
  }
}
