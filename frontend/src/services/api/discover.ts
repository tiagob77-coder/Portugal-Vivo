import api from './client';
import type { HeritageItem, Region, ApiParams } from '../../types';
import type { CalendarEvent } from './agenda';

// ========================
// PHASE 1: NEW API ENDPOINTS
// ========================

// Discovery Feed (Tab Descobrir)
export interface DiscoveryFeedItem {
  id: string;
  section: string;
  content_type: string;
  content_id: string;
  content_data: {
    name: string;
    description: string;
    image_url?: string;
    source: string;
    reason: string;
  };
  position: number;
  relevance_score: number;
  reason: string;
}

export interface DiscoveryFeedResponse {
  items: DiscoveryFeedItem[];
  generated_at: string;
  personalized: boolean;
}

export const getDiscoveryFeed = async (
  lat?: number,
  lng?: number,
  limit?: number,
  token?: string,
  traveler_profile?: string,
  category?: string
): Promise<DiscoveryFeedResponse> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await api.post('/discover/feed',
    { lat, lng, limit: limit || 30, traveler_profile, category: category || null },
    { headers }
  );
  return response.data;
};

export const getHojeFeed = async (lat?: number, lng?: number, date?: string) => {
  const params: Record<string, any> = {};
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  if (date) params.date = date;
  const response = await api.get('/discover/hoje', { params });
  return response.data;
};

export const getSurprisePOI = async (traveler_profile?: string, region?: string) => {
  const params: ApiParams = {};
  if (traveler_profile) params.traveler_profile = traveler_profile;
  if (region) params.region = region;
  const response = await api.get('/discover/surprise', { params });
  return response.data;
};

export interface TrendingItem extends HeritageItem {
  trending_score: number;
  reason: string;
}

export const getTrendingItems = async (limit?: number): Promise<{ items: TrendingItem[]; period: string }> => {
  const response = await api.get('/discover/trending', { params: { limit } });
  return response.data;
};

export interface SeasonalContent {
  season: string;
  events: CalendarEvent[];
  recommended_items: HeritageItem[];
  categories_in_focus: string[];
}

export const getSeasonalContent = async (): Promise<SeasonalContent> => {
  const response = await api.get('/discover/seasonal');
  return response.data;
};

// Thematic Matrix (Tab Explorar)
export interface ThematicAxis {
  id: string;
  name: string;
  icon: string;
  categories: string[];
}

export interface MatrixRegion {
  region: Region;
  count: number;
  top_items: { id: string; name: string; image_url?: string }[];
}

export interface MatrixTheme {
  theme: ThematicAxis;
  regions: MatrixRegion[];
}

export interface ThematicMatrixResponse {
  matrix: MatrixTheme[];
  themes: ThematicAxis[];
  regions: Region[];
}

export const getThematicMatrix = async (): Promise<ThematicMatrixResponse> => {
  const response = await api.get('/explore/matrix');
  return response.data;
};

export const exploreByTheme = async (
  themeId: string,
  region?: string,
  limit?: number
): Promise<{ theme: ThematicAxis; total_items: number; items: HeritageItem[]; by_region: Record<string, HeritageItem[]> }> => {
  const response = await api.get(`/explore/theme/${themeId}`, { params: { region, limit } });
  return response.data;
};

export const exploreByRegion = async (
  regionId: string,
  theme?: string,
  limit?: number
): Promise<{ region: Region; total_items: number; items: HeritageItem[]; by_theme: Record<string, HeritageItem[]> }> => {
  const response = await api.get(`/explore/region/${regionId}`, { params: { theme, limit } });
  return response.data;
};
