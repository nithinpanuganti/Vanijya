import {
  Role,
  VerificationStatus,
  ApprovalStatus,
  CropLotStatus,
  BidStatus,
  TransactionStatus,
  PaymentStatus,
  PriceSource,
  QualityGrade,
  CropUnit,
  AuditAction,
  NotificationType,
} from './enums';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ProfilePhotoMeta {
  url?: string;
  fileId?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface UserEntity {
  _id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  passwordHash?: string | null;
  role: Role;
  verificationStatus: VerificationStatus;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
  isVerified: boolean;
  district?: string | null;
  state?: string | null;
  village?: string | null;
  location?: string | null;
  geoPoint?: GeoPoint | null;
  profilePhoto?: ProfilePhotoMeta | null;
  primaryCrop?: string | null;
  farmSize?: number | null;
  preferredLanguage?: string | null;
  organization?: string | null;
  contactPerson?: string | null;
  businessType?: string | null;
  warehouseLocation?: string | null;
  gstin?: string | null;
  fssai?: string | null;
  kccNumber?: string | null;
  apmcLicense?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CropEntity {
  _id: string;
  name: string;
  hindiName?: string | null;
  category: string;
  baseUnit: CropUnit;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketEntity {
  _id: string;
  name: string;
  state: string;
  district: string;
  location: GeoPoint;
  latitude: number;
  longitude: number;
  isApmc: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MandiPriceEntity {
  _id: string;
  cropId: string;
  marketId: string;
  state: string;
  district: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  arrivalQuantity: number;
  priceDate: Date;
  source: PriceSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface CropLotEntity {
  _id: string;
  farmerId: string;
  cropId: string;
  quantity: number;
  unit: CropUnit;
  expectedPrice: number;
  qualityGrade: QualityGrade;
  harvestDate: Date;
  district: string;
  state: string;
  location: string;
  description?: string | null;
  status: CropLotStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface BidEntity {
  _id: string;
  lotId: string;
  buyerId: string;
  amount: number;
  quantity: number;
  status: BidStatus;
  previousQuantity?: number | null;
  modifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionEntity {
  _id: string;
  lotId: string;
  bidId: string;
  farmerId: string;
  buyerId: string;
  cropId: string;
  quantity: number;
  agreedPrice: number;
  totalAmount: number;
  status: TransactionStatus;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentEntity {
  _id: string;
  transactionId: string;
  amount: number;
  status: PaymentStatus;
  utrNumber?: string | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationEntity {
  _id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntity {
  _id: string;
  actorId: string;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  timestamp: Date;
  createdAt: Date;
}
