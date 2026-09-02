import { Injectable, Inject, Logger } from '@nestjs/common';
import { MandiPriceRepository, CropRepository, MarketRepository } from '../repositories';
import {
  PriceQueryDto,
  PriceTrendsQueryDto,
  PriceCompareQueryDto,
  PriceDashboardQueryDto,
} from './dto/price-query.dto';
import {
  MarketDataProvider,
  NormalizedMandiPrice,
  NormalizedPriceHistory,
  MarketComparisonResult,
} from './providers/market-data-provider.interface';
import { MARKET_DATA_PROVIDER_TOKEN } from './providers/market-data.constants';
import { PriceAnalyticsService } from './services/price-analytics.service';
import { PriceCacheService } from './services/price-cache.service';

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(
    private readonly mandiPriceRepository: MandiPriceRepository,
    private readonly cropRepository: CropRepository,
    private readonly marketRepository: MarketRepository,
    @Inject(MARKET_DATA_PROVIDER_TOKEN)
    private readonly marketDataProvider: MarketDataProvider,
    private readonly analyticsService: PriceAnalyticsService,
    private readonly cacheService: PriceCacheService,
  ) {}

  async findAll(query: PriceQueryDto): Promise<NormalizedMandiPrice[]> {
    const cacheKey = `prices:all:${query.cropId || ''}:${query.cropName || ''}:${query.district || ''}:${query.state || ''}:${query.marketId || ''}`;
    const cached = this.cacheService.get<NormalizedMandiPrice[]>(cacheKey);
    if (cached) return cached;

    try {
      const filter: any = {};
      if (query.cropId) filter.cropId = query.cropId;
      if (query.marketId) filter.marketId = query.marketId;

      const dbPrices = await this.mandiPriceRepository.findAll(filter, 50);

      if (dbPrices && dbPrices.length > 0) {
        const crops = await this.cropRepository.findAll();
        const markets = await this.marketRepository.findAll();
        const cropMap = new Map(crops.map((c) => [c._id, c]));
        const marketMap = new Map(markets.map((m) => [m._id, m]));

        const normalized: NormalizedMandiPrice[] = dbPrices.map((p) => {
          const crop = cropMap.get(p.cropId);
          const market = marketMap.get(p.marketId);
          return {
            id: p._id,
            cropId: p.cropId,
            cropName: crop?.name || 'Tomato',
            category: crop?.category || 'Vegetables',
            marketId: p.marketId,
            marketName: market?.name || 'Local Mandi',
            district: market?.district || 'Nashik',
            state: market?.state || 'Maharashtra',
            latitude: market?.latitude,
            longitude: market?.longitude,
            minPrice: p.minPrice,
            maxPrice: p.maxPrice,
            modalPrice: p.modalPrice,
            arrivalQuantity: p.arrivalQuantity,
            unit: 'QUINTAL',
            date: new Date(p.priceDate || (p as any).date || Date.now()).toISOString().split('T')[0],
            source: p.source as any,
            updatedAt: new Date(p.createdAt || Date.now()).toISOString(),
          };
        });

        this.cacheService.set(cacheKey, normalized, 180000);
        return normalized;
      }
    } catch (err: any) {
      this.logger.warn(`MongoDB findAll prices fallback: ${err.message}`);
    }

    const providerResults = await this.marketDataProvider.getLatestPrices({
      cropName: query.cropName,
      cropId: query.cropId,
      district: query.district,
      state: query.state,
    });

    this.cacheService.set(cacheKey, providerResults, 180000);
    return providerResults;
  }

  async findLatest(query: PriceQueryDto): Promise<NormalizedMandiPrice[]> {
    const cacheKey = `prices:latest:${query.cropName || query.cropId || 'all'}:${query.district || ''}`;
    const cached = this.cacheService.get<NormalizedMandiPrice[]>(cacheKey);
    if (cached) return cached;

    const allPrices = await this.findAll(query);

    const map = new Map<string, NormalizedMandiPrice>();
    for (const item of allPrices) {
      const pairKey = `${item.cropName}_${item.marketName}`;
      if (!map.has(pairKey)) {
        map.set(pairKey, item);
      }
    }

    const latest = Array.from(map.values());
    this.cacheService.set(cacheKey, latest, 180000);
    return latest;
  }

  async getPriceTrends(query: PriceTrendsQueryDto) {
    const crop = query.cropName || 'Tomato';
    const days = parseInt(query.days || '7', 10);
    const cacheKey = `prices:trends:${crop}:${query.marketId || ''}:${days}`;

    const cached = this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const historyData: NormalizedPriceHistory = await this.marketDataProvider.getPriceHistory(
      crop,
      query.marketId,
      days,
    );

    const modalPrices = historyData.history.map((h) => h.modalPrice);
    const movingAverage = this.analyticsService.calculateMovingAverage(modalPrices);
    const trendDirection = this.analyticsService.detectTrend(modalPrices);
    const volatility = this.analyticsService.calculateVolatility(modalPrices);
    const currentPrice = historyData.currentModalPrice;
    const { percentage } = this.analyticsService.calculatePriceDelta(currentPrice, movingAverage);

    const insight = this.analyticsService.generateRuleBasedInsight(
      currentPrice,
      movingAverage,
      trendDirection,
      volatility,
    );

    const result = {
      crop: historyData.cropName,
      market: historyData.marketName,
      district: historyData.district,
      state: historyData.state,
      todayPrice: currentPrice,
      averageModalPrice: movingAverage,
      trendDirection,
      percentageChange: percentage,
      volatility,
      insight,
      history: historyData.history,
    };

    this.cacheService.set(cacheKey, result, 180000);
    return result;
  }

  async compareMarkets(query: PriceCompareQueryDto): Promise<MarketComparisonResult> {
    const crop = query.cropName || 'Tomato';
    const userLat = query.userLat || 19.9975;
    const userLng = query.userLng || 73.7898;
    const maxDistance = query.maxDistanceKm || 250;

    const cacheKey = `prices:compare:${crop}:${userLat}:${userLng}:${maxDistance}`;
    const cached = this.cacheService.get<MarketComparisonResult>(cacheKey);
    if (cached) return cached;

    const comparison = await this.marketDataProvider.getNearbyMarketComparison(
      crop,
      userLat,
      userLng,
      maxDistance,
    );

    this.cacheService.set(cacheKey, comparison, 180000);
    return comparison;
  }

  async getDashboardSummary(query: PriceDashboardQueryDto) {
    const crop = query.cropName || 'Tomato';
    const district = query.district || 'Nashik';
    const userLat = query.userLat || 19.9975;
    const userLng = query.userLng || 73.7898;

    const cacheKey = `prices:dashboard:${crop}:${district}:${userLat}:${userLng}`;
    const cached = this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const [trends, comparisons] = await Promise.all([
      this.getPriceTrends({ cropName: crop, days: '7' }),
      this.compareMarkets({ cropName: crop, userLat, userLng }),
    ]);

    const bestMarket = comparisons.bestMarket;
    const sellingWindow = this.analyticsService.generateBestSellingWindow(
      trends.todayPrice,
      trends.averageModalPrice,
      trends.trendDirection as any,
      trends.volatility as any,
      crop,
    );

    const summary = {
      crop,
      district,
      todayPrice: trends.todayPrice,
      weeklyAverage: trends.averageModalPrice,
      trend: trends.trendDirection,
      volatility: trends.volatility,
      bestNearbyMarket: bestMarket?.marketName || trends.market,
      bestNearbyPrice: bestMarket?.modalPrice || trends.todayPrice,
      arbitrageGainPerQuintal: bestMarket?.priceDifference || 0,
      insight: trends.insight,
      sellingWindow,
    };

    this.cacheService.set(cacheKey, summary, 180000);
    return summary;
  }
}
