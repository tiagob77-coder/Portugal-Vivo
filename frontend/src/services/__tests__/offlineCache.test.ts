// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory mock storage
const mockStorage = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key, value) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockStorage))),
  multiRemove: jest.fn((keys) => {
    keys.forEach((k) => delete mockStorage[k]);
    return Promise.resolve();
  }),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Mock api functions used by syncOfflineActions
jest.mock('../api', () => ({
  recordDashboardVisit: jest.fn().mockResolvedValue({}),
  addFavorite: jest.fn().mockResolvedValue({}),
  createContribution: jest.fn().mockResolvedValue({}),
}));

// Import after mocks
import { offlineCache } from '../offlineCache'; // eslint-disable-line import/first

describe('OfflineCacheService', () => {
  beforeEach(() => {
    // Clear mock storage between tests
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.clearAllMocks();
  });

  describe('setCache / getCache', () => {
    it('saves data to AsyncStorage and retrieves it', async () => {
      const testData = { items: [1, 2, 3], label: 'test' };
      await offlineCache.setCache('test_key', testData, 60000);

      const result = await offlineCache.getCache('test_key');
      expect(result).toEqual(testData);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'test_key',
        expect.stringContaining('"items":[1,2,3]')
      );
    });

    it('returns null for non-existent keys', async () => {
      const result = await offlineCache.getCache('nonexistent_key');
      expect(result).toBeNull();
    });

    it('returns null for expired cache entries', async () => {
      // Store with 1ms expiry
      const entry = { data: 'old', timestamp: Date.now() - 10000, expiry: 1 };
      mockStorage['expired_key'] = JSON.stringify(entry);

      const result = await offlineCache.getCache('expired_key');
      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('expired_key');
    });
  });

  describe('Offline action queue', () => {
    it('queues a pending action', async () => {
      await offlineCache.queueOfflineAction('visit', { poiId: 'poi-001' });

      const count = await offlineCache.getPendingActionCount();
      expect(count).toBe(1);
    });

    it('queues multiple actions and counts them', async () => {
      await offlineCache.queueOfflineAction('visit', { poiId: 'poi-001' });
      await offlineCache.queueOfflineAction('favorite', { itemId: 'poi-002' });
      await offlineCache.queueOfflineAction('visit', { poiId: 'poi-003' });

      const count = await offlineCache.getPendingActionCount();
      expect(count).toBe(3);
    });

    it('each queued action has required fields', async () => {
      await offlineCache.queueOfflineAction('visit', { poiId: 'poi-001' });

      const raw = mockStorage['cache_offline_queue'];
      expect(raw).toBeDefined();
      const entry = JSON.parse(raw);
      const queue = entry.data;
      expect(queue).toHaveLength(1);
      expect(queue[0]).toHaveProperty('id');
      expect(queue[0]).toHaveProperty('type', 'visit');
      expect(queue[0]).toHaveProperty('payload');
      expect(queue[0]).toHaveProperty('timestamp');
      expect(typeof queue[0].id).toBe('string');
      expect(typeof queue[0].timestamp).toBe('number');
    });
  });

  describe('POI visited tracking', () => {
    it('marks a POI as visited and retrieves it', async () => {
      await offlineCache.markPOIVisited('poi-abc');
      const visited = await offlineCache.isPOIVisited('poi-abc');
      expect(visited).toBe(true);
    });

    it('returns false for unvisited POIs', async () => {
      const visited = await offlineCache.isPOIVisited('poi-never-visited');
      expect(visited).toBe(false);
    });

    it('returns list of all visited POI IDs', async () => {
      await offlineCache.markPOIVisited('poi-1');
      await offlineCache.markPOIVisited('poi-2');
      const visited = await offlineCache.getVisitedPOIs();
      expect(visited).toContain('poi-1');
      expect(visited).toContain('poi-2');
    });
  });

  describe('clearCache', () => {
    it('removes all cache_ prefixed keys', async () => {
      mockStorage['cache_nearby_pois'] = '{}';
      mockStorage['cache_categories'] = '{}';
      mockStorage['other_key'] = 'keep';

      await offlineCache.clearCache();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(
        expect.arrayContaining(['cache_nearby_pois', 'cache_categories'])
      );
    });
  });
});
