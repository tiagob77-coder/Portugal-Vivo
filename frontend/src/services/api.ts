import axios from 'axios';
import {
  HeritageItem,
  Route,
  Category,
  Region,
  User,
  Stats,
  Contribution,
  ContributionCreate,
  Badge,
  UserProgress,
  LeaderboardEntry,
  CalendarEvent,
} from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

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

export const getMapItems = async (
  categories?: string[],
  region?: string,
  limit?: number
): Promise<HeritageItem[]> => {
  const params: Record<string, string | number> = {};
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

// User & Favorites (token injected automatically via setAuthToken / interceptor)
export const getFavorites = async (): Promise<HeritageItem[]> => {
  const response = await api.get('/favorites');
  return response.data;
};

export const addFavorite = async (itemId: string): Promise<void> => {
  await api.post(`/favorites/${itemId}`);
};

export const removeFavorite = async (itemId: string): Promise<void> => {
  await api.delete(`/favorites/${itemId}`);
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

// Contributions
export const getContributions = async (params?: {
  status?: string;
  type?: string;
  region?: string;
}): Promise<Contribution[]> => {
  const response = await api.get('/contributions', { params });
  return response.data;
};

export const getApprovedContributions = async (): Promise<Contribution[]> => {
  const response = await api.get('/contributions/approved');
  return response.data;
};

export const getMyContributions = async (): Promise<Contribution[]> => {
  const response = await api.get('/contributions/my');
  return response.data;
};

export const createContribution = async (
  contribution: ContributionCreate
): Promise<Contribution> => {
  const response = await api.post('/contributions', contribution);
  return response.data;
};

export const voteContribution = async (contributionId: string): Promise<void> => {
  await api.post(`/contributions/${contributionId}/vote`);
};

// Gallery
export const getGallery = async (category: string): Promise<Array<{
  id: string;
  name: string;
  image_url: string;
  region: string;
}>> => {
  const response = await api.get(`/gallery/${category}`);
  return response.data;
};

// Gamification
export const getBadges = async (): Promise<Badge[]> => {
  const response = await api.get('/badges');
  return response.data;
};

export const getUserProgress = async (): Promise<UserProgress> => {
  const response = await api.get('/gamification/progress');
  return response.data;
};

export const recordVisit = async (itemId: string): Promise<void> => {
  await api.post(`/gamification/visit/${itemId}`);
};

export const completeRoute = async (routeId: string): Promise<void> => {
  await api.post(`/gamification/complete-route/${routeId}`);
};

export const getLeaderboard = async (limit?: number): Promise<LeaderboardEntry[]> => {
  const response = await api.get('/leaderboard', { params: { limit } });
  return response.data;
};

// Calendar
export const getCalendarEvents = async (month?: number): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar', { params: { month } });
  return response.data;
};

export const getUpcomingEvents = async (limit?: number): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/upcoming', { params: { limit } });
  return response.data;
};

export const getEventsByMonth = async (month: number): Promise<CalendarEvent[]> => {
  const response = await api.get(`/calendar/month/${month}`);
  return response.data;
};

// Auth
export const exchangeSession = async (sessionId: string): Promise<User> => {
  const response = await api.post('/auth/session', {}, {
    headers: { 'X-Session-ID': sessionId },
  });
  return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export default api;
