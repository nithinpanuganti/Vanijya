import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Market, MarketDocument, MandiPrice, MandiPriceDocument } from '../database/schemas';

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(
    @InjectModel(Market.name) private readonly marketModel: Model<MarketDocument>,
    @InjectModel(MandiPrice.name) private readonly mandiPriceModel: Model<MandiPriceDocument>,
  ) {}

  async findAll() {
    const markets = await this.marketModel.find().sort({ name: 1 }).lean();
    return markets.map((m) => ({ ...m, id: m._id }));
  }

  async findOne(id: string) {
    const market = await this.marketModel.findById(id).lean();
    if (!market) {
      throw new NotFoundException(`Market APMC with ID ${id} not found.`);
    }

    const prices = await this.mandiPriceModel
      .find({ marketId: market._id })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    return {
      ...market,
      id: market._id,
      mandiPrices: prices.map((p) => ({ ...p, id: p._id })),
    };
  }
}
