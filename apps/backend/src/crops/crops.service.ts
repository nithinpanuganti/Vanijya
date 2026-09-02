import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Crop, CropDocument, MandiPrice, MandiPriceDocument } from '../database/schemas';

@Injectable()
export class CropsService {
  private readonly logger = new Logger(CropsService.name);

  constructor(
    @InjectModel(Crop.name) private readonly cropModel: Model<CropDocument>,
    @InjectModel(MandiPrice.name) private readonly mandiPriceModel: Model<MandiPriceDocument>,
  ) {}

  async findAll() {
    const crops = await this.cropModel.find().sort({ name: 1 }).lean();
    return crops.map((c) => ({ ...c, id: c._id }));
  }

  async findOne(id: string) {
    const crop = await this.cropModel
      .findOne({
        $or: [{ _id: id }, { name: new RegExp(`^${id}$`, 'i') }],
      })
      .lean();

    if (!crop) {
      throw new NotFoundException(`Crop with ID ${id} not found.`);
    }

    const prices = await this.mandiPriceModel
      .find({ cropId: crop._id })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    return {
      ...crop,
      id: crop._id,
      mandiPrices: prices.map((p) => ({ ...p, id: p._id })),
    };
  }
}
