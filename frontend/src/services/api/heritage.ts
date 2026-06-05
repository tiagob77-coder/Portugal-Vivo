import api, { cachedGet } from './client';
import type { HeritageItem, Category, MainCategory, Subcategory, Region, ApiParams } from '../../types';

// Heritage Items
export const getHeritageItems = async (params?: {
  category?: string;
  region?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<HeritageItem[]> => {
  const key = `cache_heritage_${JSON.stringify(params || {})}`;
  return cachedGet(key, async () => {
    const response = await api.get('/heritage', { params });
    return response.data;
  });
};

export const getHeritageItem = async (id: string): Promise<HeritageItem> => {
  return cachedGet(`cache_heritage_item_${id}`, async () => {
    const response = await api.get(`/heritage/${id}`);
    return response.data;
  });
};

export const getHeritageByCategory = async (category: string): Promise<HeritageItem[]> => {
  return cachedGet(`cache_heritage_cat_${category}`, async () => {
    const response = await api.get(`/heritage/category/${category}`);
    return response.data;
  });
};

export const getHeritageByRegion = async (region: string): Promise<HeritageItem[]> => {
  return cachedGet(`cache_heritage_reg_${region}`, async () => {
    const response = await api.get(`/heritage/region/${region}`);
    return response.data;
  });
};

export const getMapItems = async (
  categories?: string[],
  region?: string,
  limit?: number,
): Promise<HeritageItem[]> => {
  const params: ApiParams = {};
  if (categories && categories.length > 0) {
    params.categories = categories.join(',');
  }
  if (region) {
    params.region = region;
  }
  if (limit) {
    params.limit = limit;
  }
  const response = await api.get('/map/items', { params });
  return response.data;
};

// Categories and Regions
export const getCategories = async (): Promise<Category[]> => {
  return cachedGet('cache_categories', async () => {
    const response = await api.get('/categories');
    return response.data;
  }, 7 * 24 * 60 * 60 * 1000); // 7 days
};

export const getMainCategories = async (): Promise<MainCategory[]> => {
  return cachedGet('cache_main_categories', async () => {
    const response = await api.get('/main-categories');
    return response.data;
  }, 7 * 24 * 60 * 60 * 1000);
};

export const getSubcategories = async (mainCategory?: string): Promise<Subcategory[]> => {
  const key = `cache_subcategories_${mainCategory || 'all'}`;
  return cachedGet(key, async () => {
    const params = mainCategory ? { main_category: mainCategory } : {};
    const response = await api.get('/subcategories', { params });
    return response.data;
  }, 7 * 24 * 60 * 60 * 1000);
};

export const getRegions = async (): Promise<Region[]> => {
  return cachedGet('cache_regions', async () => {
    const response = await api.get('/regions');
    return response.data;
  }, 7 * 24 * 60 * 60 * 1000);
};

// Landing Page - Descobertas Raras & Stories
export interface TopScoredItem {
  id: string;
  name: string;
  description: string;
  category: string;
  category_name: string;
  main_category_name: string;
  region: string;
  image_url: string;
  iq_score: number;
  location?: { lat: number; lng: number };
  tags?: string[];
}

export interface StoryItem {
  id: string;
  title: string;
  description: string;
  full_description: string;
  region: string;
  category: string;
  category_name: string;
  image_url: string;
  tags: string[];
  read_time: string;
  iq_score: number;
}

export const getTopScoredItems = async (): Promise<TopScoredItem[]> => {
  return cachedGet('cache_top_scored', async () => {
    try {
      const response = await api.get('/heritage/top-scored');
      return response.data;
    } catch { return []; }
  }, 60 * 60 * 1000); // 1h cache
};

export const getStories = async (): Promise<StoryItem[]> => {
  return cachedGet('cache_stories', async () => {
    try {
      const response = await api.get('/heritage/stories');
      return response.data;
    } catch { return []; }
  }, 60 * 60 * 1000);
};
