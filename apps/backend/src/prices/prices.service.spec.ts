import { Test, TestingModule } from '@nestjs/testing';
import { PricesService } from './prices.service';
import { PriceAnalyticsService } from './services/price-analytics.service';
import { PriceCacheService } from './services/price-cache.service';
import { MockMarketDataProvider } from './providers/mock-market-data.provider';
import { MARKET_DATA_PROVIDER_TOKEN } from './providers/market-data.constants';
import { MandiPriceRepository, CropRepository, MarketRepository } from '../repositories';

describe('PricesService & Market Intelligence', () => {
  let service: PricesService;
  let mockProvider: MockMarketDataProvider;
  let analyticsService: PriceAnalyticsService;

  const mockMandiPriceRepository = {
    findAll: jest.fn().mockResolvedValue([]),
    findLatestPrice: jest.fn().mockResolvedValue(null),
    findHistory: jest.fn().mockResolvedValue([]),
  };

  const mockCropRepository = {
    findAll: jest.fn().mockResolvedValue([]),
    findByName: jest.fn().mockResolvedValue(null),
  };

  const mockMarketRepository = {
    findAll: jest.fn().mockResolvedValue([]),
    findNearby: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricesService,
        PriceAnalyticsService,
        PriceCacheService,
        MockMarketDataProvider,
        {
          provide: MARKET_DATA_PROVIDER_TOKEN,
          useClass: MockMarketDataProvider,
        },
        { provide: MandiPriceRepository, useValue: mockMandiPriceRepository },
        { provide: CropRepository, useValue: mockCropRepository },
        { provide: MarketRepository, useValue: mockMarketRepository },
      ],
    }).compile();

    service = module.get<PricesService>(PricesService);
    mockProvider = module.get<MockMarketDataProvider>(MockMarketDataProvider);
    analyticsService = module.get<PriceAnalyticsService>(PriceAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('MockMarketDataProvider', () => {
    it('should return realistic prices for Tomato across Nashik and Lasalgaon', async () => {
      const prices = await mockProvider.getLatestPrices({ cropName: 'Tomato' });
      expect(prices.length).toBeGreaterThanOrEqual(2);
      expect(prices[0].cropName).toBe('Tomato');
      expect(prices[0].modalPrice).toBeGreaterThan(1500);
      expect(prices[0].source).toBe('MOCK');
    });

    it('should generate 7-day historical prices with non-linear fluctuation', async () => {
      const history = await mockProvider.getPriceHistory('Tomato', 'Nashik', 7);
      expect(history.history.length).toBe(7);
      expect(history.cropName).toBe('Tomato');
      expect(history.currentModalPrice).toBeGreaterThan(0);
    });

    it('should compute nearby market comparison with Haversine distance and transport offset', async () => {
      const comparison = await mockProvider.getNearbyMarketComparison('Tomato', 19.9975, 73.7898);
      expect(comparison.markets.length).toBeGreaterThanOrEqual(2);
      expect(comparison.bestMarket).toBeDefined();
      expect(comparison.bestMarket?.distanceKm).toBeDefined();
      expect(comparison.bestMarket?.netRealizablePrice).toBeDefined();
    });
  });

  describe('PricesService Integration', () => {
    it('should return 7-day price trends and rule-based insights', async () => {
      const trends = await service.getPriceTrends({ cropName: 'Tomato', days: '7' });
      expect(trends.crop).toBe('Tomato');
      expect(trends.history.length).toBe(7);
      expect(['BULLISH', 'BEARISH', 'STABLE']).toContain(trends.trendDirection);
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(trends.volatility);
      expect(trends.insight).toBeDefined();
    });

    it('should return farmer market intelligence dashboard with Best Selling Window', async () => {
      const dashboard = await service.getDashboardSummary({
        cropName: 'Tomato',
        district: 'Nashik',
        userLat: 19.9975,
        userLng: 73.7898,
      });

      expect(dashboard.crop).toBe('Tomato');
      expect(dashboard.district).toBe('Nashik');
      expect(dashboard.todayPrice).toBeGreaterThan(0);
      expect(dashboard.weeklyAverage).toBeGreaterThan(0);
      expect(dashboard.bestNearbyMarket).toBeDefined();
      expect(dashboard.sellingWindow).toBeDefined();
      expect(dashboard.sellingWindow.recommendation).toBeDefined();
      expect(['HIGH', 'MEDIUM', 'MODERATE']).toContain(dashboard.sellingWindow.confidence);
    });
  });
});
