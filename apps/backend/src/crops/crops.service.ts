import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CropRepository, MandiPriceRepository } from '../repositories';

@Injectable()
export class CropsService {
  private readonly logger = new Logger(CropsService.name);

  constructor(
    private readonly cropRepository: CropRepository,
    private readonly mandiPriceRepository: MandiPriceRepository,
  ) {}

  async findAll() {
    const crops = await this.cropRepository.findAll();
    return crops.map((c) => ({ ...c, id: c._id }));
  }

  async findOne(id: string) {
    let crop = await this.cropRepository.findById(id);
    if (!crop) {
      crop = await this.cropRepository.findByName(id);
    }

    if (!crop) {
      throw new NotFoundException(`Crop with ID ${id} not found.`);
    }

    const prices = await this.mandiPriceRepository.findAll({ cropId: crop._id }, 10);

    return {
      ...crop,
      id: crop._id,
      mandiPrices: prices.map((p) => ({ ...p, id: p._id })),
    };
  }
}
