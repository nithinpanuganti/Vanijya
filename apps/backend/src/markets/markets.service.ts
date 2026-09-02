import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { MarketRepository, MandiPriceRepository } from '../repositories';

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(
    private readonly marketRepository: MarketRepository,
    private readonly mandiPriceRepository: MandiPriceRepository,
  ) {}

  async findAll() {
    const markets = await this.marketRepository.findAll();
    return markets.map((m) => ({ ...m, id: m._id }));
  }

  async findOne(id: string) {
    const market = await this.marketRepository.findById(id);
    if (!market) {
      throw new NotFoundException(`Market APMC with ID ${id} not found.`);
    }

    const prices = await this.mandiPriceRepository.findAll({ marketId: market._id }, 10);

    return {
      ...market,
      id: market._id,
      mandiPrices: prices.map((p) => ({ ...p, id: p._id })),
    };
  }
}
