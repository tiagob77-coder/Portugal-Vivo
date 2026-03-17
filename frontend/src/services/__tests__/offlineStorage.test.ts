// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// In-memory mock storage
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

// Import after mocks
import { offlineStorage } from '../offlineStorage'; // eslint-disable-line import/first
import axios from 'axios'; // eslint-disable-line import/first

const mockRegionPackage = {
  region: 'alentejo',
  region_name: 'Alentejo',
  version_hash: 'abc123',
  downloaded_at: '2025-01-01T00:00:00Z',
  heritage_items: [{ id: 'poi-1', name: 'Test POI' }],
  routes: [{ id: 'route-1', name: 'Test Route' }],
  events: [],
  categories: [],
  counts: {
    heritage_items: 1,
    routes: 1,
    events: 0,
    categories: 0,
  },
};

describe('OfflineStorageService', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.clearAllMocks();
  });

  describe('downloadRegion', () => {
    it('stores region data and metadata in AsyncStorage', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: mockRegionPackage });

      const meta = await offlineStorage.downloadRegion('alentejo');

      expect(meta.regionId).toBe('alentejo');
      expect(meta.regionName).toBe('Alentejo');
      expect(meta.versionHash).toBe('abc123');
      expect(meta.poiCount).toBe(1);
      expect(meta.routesCount).toBe(1);

      // Verify data was stored
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'offline_region_alentejo',
        expect.any(String)
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'offline_meta_alentejo',
        expect.any(String)
      );
    });

    it('calls onProgress callback during download', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: mockRegionPackage });
      const onProgress = jest.fn();

      await offlineStorage.downloadRegion('alentejo', onProgress);

      expect(onProgress).toHaveBeenCalledWith(0.05);
      expect(onProgress).toHaveBeenCalledWith(0.5);
      expect(onProgress).toHaveBeenCalledWith(0.8);
      expect(onProgress).toHaveBeenCalledWith(1.0);
    });

    it('adds region to the regions list', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: mockRegionPackage });

      await offlineStorage.downloadRegion('alentejo');

      const listRaw = mockStorage['offline_regions_list'];
      expect(listRaw).toBeDefined();
      const list = JSON.parse(listRaw);
      expect(list).toContain('alentejo');
    });
  });

  describe('getOfflineRegions', () => {
    it('returns stored regions with their metadata', async () => {
      // Pre-populate storage
      mockStorage['offline_regions_list'] = JSON.stringify(['alentejo']);
      mockStorage['offline_meta_alentejo'] = JSON.stringify({
        regionId: 'alentejo',
        regionName: 'Alentejo',
        versionHash: 'abc123',
        downloadedAt: '2025-01-01T00:00:00Z',
        poiCount: 5,
        routesCount: 2,
        eventsCount: 0,
        sizeBytes: 1024,
      });

      const regions = await offlineStorage.getOfflineRegions();

      expect(regions).toHaveLength(1);
      expect(regions[0].regionId).toBe('alentejo');
      expect(regions[0].regionName).toBe('Alentejo');
      expect(regions[0].poiCount).toBe(5);
    });

    it('returns empty array when no regions are downloaded', async () => {
      const regions = await offlineStorage.getOfflineRegions();
      expect(regions).toEqual([]);
    });
  });

  describe('deleteRegion', () => {
    it('removes region data, metadata, and updates the list', async () => {
      // Pre-populate storage
      mockStorage['offline_regions_list'] = JSON.stringify(['alentejo', 'norte']);
      mockStorage['offline_region_alentejo'] = '{}';
      mockStorage['offline_meta_alentejo'] = '{}';

      await offlineStorage.deleteRegion('alentejo');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offline_region_alentejo');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offline_meta_alentejo');

      const listRaw = mockStorage['offline_regions_list'];
      const list = JSON.parse(listRaw);
      expect(list).not.toContain('alentejo');
      expect(list).toContain('norte');
    });
  });

  describe('isOffline', () => {
    it('returns false when connected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: true });

      const result = await offlineStorage.isOffline();
      expect(result).toBe(false);
    });

    it('returns true when disconnected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: false });

      const result = await offlineStorage.isOffline();
      expect(result).toBe(true);
    });

    it('returns false when isConnected is null (defaults to connected)', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: null });

      const result = await offlineStorage.isOffline();
      expect(result).toBe(false);
    });
  });
});
