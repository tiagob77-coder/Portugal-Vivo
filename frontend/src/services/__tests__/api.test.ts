import axios from 'axios';
import { getHeritageItems, getCategories, getRegions, getHeritageItem } from '../api';

// Mock axios
jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => mockInstance),
    __mockInstance: mockInstance,
  };
});

const mockAxios = (axios as any).__mockInstance;

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHeritageItems', () => {
    it('returns array of heritage items', async () => {
      const mockItems = [
        { id: '1', name: 'Termas do Gerês', category: 'termas', region: 'norte' },
        { id: '2', name: 'Castelo de Guimarães', category: 'arqueologia', region: 'norte' },
      ];
      mockAxios.get.mockResolvedValueOnce({ data: mockItems });

      const result = await getHeritageItems();
      expect(mockAxios.get).toHaveBeenCalledWith('/heritage', { params: undefined });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });

    it('passes filter params correctly', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [] });

      await getHeritageItems({ category: 'termas', region: 'centro', limit: 10 });
      expect(mockAxios.get).toHaveBeenCalledWith('/heritage', {
        params: { category: 'termas', region: 'centro', limit: 10 },
      });
    });

    it('propagates HTTP errors', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Network Error'));
      await expect(getHeritageItems()).rejects.toThrow('Network Error');
    });
  });

  describe('getCategories', () => {
    it('returns array of categories with required fields', async () => {
      const mockCategories = Array.from({ length: 26 }, (_, i) => ({
        id: `cat-${i}`, name: `Category ${i}`, icon: 'place', color: '#000',
      }));
      mockAxios.get.mockResolvedValueOnce({ data: mockCategories });

      const result = await getCategories();
      expect(mockAxios.get).toHaveBeenCalledWith('/categories');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(26);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('icon');
      expect(result[0]).toHaveProperty('color');
    });
  });

  describe('getRegions', () => {
    it('returns array of regions', async () => {
      const mockRegions = [
        { id: 'norte', name: 'Norte', color: '#8B4513' },
        { id: 'centro', name: 'Centro', color: '#D2691E' },
      ];
      mockAxios.get.mockResolvedValueOnce({ data: mockRegions });

      const result = await getRegions();
      expect(mockAxios.get).toHaveBeenCalledWith('/regions');
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });
  });

  describe('getHeritageItem', () => {
    it('returns single item by ID', async () => {
      const mockItem = { id: 'poi-123', name: 'Termas de Monchique', category: 'termas', region: 'algarve' };
      mockAxios.get.mockResolvedValueOnce({ data: mockItem });

      const result = await getHeritageItem('poi-123');
      expect(mockAxios.get).toHaveBeenCalledWith('/heritage/poi-123');
      expect(result).toHaveProperty('id', 'poi-123');
      expect(result).toHaveProperty('name');
    });

    it('propagates 404 errors for unknown items', async () => {
      const error = new Error('Request failed with status code 404');
      (error as any).response = { status: 404, data: { detail: 'Not found' } };
      mockAxios.get.mockRejectedValueOnce(error);
      await expect(getHeritageItem('nonexistent')).rejects.toThrow();
    });
  });
});
