import axios from 'axios';
import { HeritageItem, Route, Category, Region, User, Stats } from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Heritage Items
export const getHeritageItems = async (params?: {
  category?: string;
  region?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<HeritageItem[]> => {
  const response = await api.get('/heritage', { params });
  return response.data;
};

export const getHeritageItem = async (id: string): Promise<HeritageItem> => {
  const response = await api.get(`/heritage/${id}`);
  return response.data;
};

export const getHeritageByCategory = async (category: string): Promise<HeritageItem[]> => {
  const response = await api.get(`/heritage/category/${category}`);
  return response.data;
};

export const getHeritageByRegion = async (region: string): Promise<HeritageItem[]> => {
  const response = await api.get(`/heritage/region/${region}`);
  return response.data;
};

export const getMapItems = async (categories?: string[], region?: string): Promise<HeritageItem[]> => {
  const params: any = {};
  if (categories && categories.length > 0) {
    params.categories = categories.join(',');
  }
  if (region) {
    params.region = region;
  }
  const response = await api.get('/map/items', { params });
  return response.data;
};

// Categories and Regions
export const getCategories = async (): Promise<Category[]> => {
  const response = await api.get('/categories');
  return response.data;
};

export const getRegions = async (): Promise<Region[]> => {
  const response = await api.get('/regions');
  return response.data;
};

// Routes
export const getRoutes = async (params?: {
  category?: string;
  region?: string;
}): Promise<Route[]> => {
  const response = await api.get('/routes', { params });
  return response.data;
};

export const getRoute = async (id: string): Promise<Route> => {
  const response = await api.get(`/routes/${id}`);
  return response.data;
};

export const getRouteItems = async (id: string): Promise<HeritageItem[]> => {
  const response = await api.get(`/routes/${id}/items`);
  return response.data;
};

// User & Favorites
export const getFavorites = async (token: string): Promise<HeritageItem[]> => {
  const response = await api.get('/favorites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const addFavorite = async (itemId: string, token: string): Promise<void> => {
  await api.post(`/favorites/${itemId}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const removeFavorite = async (itemId: string, token: string): Promise<void> => {
  await api.delete(`/favorites/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// AI Narrative
export const generateNarrative = async (
  itemId: string,
  style: 'storytelling' | 'educational' | 'brief' = 'storytelling'
): Promise<{ narrative: string; item_name: string; generated_at: string }> => {
  const response = await api.post('/narrative', {
    item_id: itemId,
    style,
    language: 'pt',
  });
  return response.data;
};

// Stats
export const getStats = async (): Promise<Stats> => {
  const response = await api.get('/stats');
  return response.data;
};

// Auth
export const exchangeSession = async (sessionId: string): Promise<User> => {
  const response = await api.post('/auth/session', {}, {
    headers: { 'X-Session-ID': sessionId },
  });
  return response.data;
};

export const getCurrentUser = async (token: string): Promise<User> => {
  const response = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export default api;
