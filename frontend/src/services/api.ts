import axios from 'axios';
import { HeritageItem, Route, Category, MainCategory, Subcategory, Region, User, Stats } from '../types';
import offlineCache from './offlineCache';

import { API_BASE } from '../config/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cache-first fallback: try API, if fails try local cache
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
async function cachedGet<T>(cacheKey: string, fetcher: () => Promise<T>, ttl = CACHE_TTL): Promise<T> {
  try {
    const data = await fetcher();
    // Save to cache on success
    offlineCache.setCache(cacheKey, data, ttl).catch(() => {});
    return data;
  } catch (err) {
    // Try cache fallback
    const cached = await offlineCache.getCache<T>(cacheKey);
    if (cached !== null) return cached;
    throw err;
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
    const response = await api.get('/heritage/top-scored');
    return response.data;
  }, 60 * 60 * 1000); // 1h cache
};

export const getStories = async (): Promise<StoryItem[]> => {
  return cachedGet('cache_stories', async () => {
    const response = await api.get('/heritage/stories');
    return response.data;
  }, 60 * 60 * 1000);
};

// Routes
export const getRoutes = async (params?: {
  category?: string;
  region?: string;
}): Promise<Route[]> => {
  const key = `cache_routes_${JSON.stringify(params || {})}`;
  return cachedGet(key, async () => {
    const response = await api.get('/routes', { params });
    return response.data || [];
  });
};

export const getRoute = async (id: string): Promise<Route> => {
  const response = await api.get(`/routes/${id}`);
  return response.data;
};

export const getRouteItems = async (id: string): Promise<HeritageItem[]> => {
  const response = await api.get(`/routes/${id}/items`);
  return response.data;
};

// Route Planning
export interface RoutePlanRequest {
  origin: string;
  destination: string;
  origin_coords?: { lat: number; lng: number };
  destination_coords?: { lat: number; lng: number };
  categories?: string[];
  max_detour_km?: number;
  max_stops?: number;
}

export interface RoutePlanResponse {
  origin: string;
  destination: string;
  total_distance_km: number;
  estimated_duration_hours: number;
  suggested_stops: HeritageItem[];
  highlights: {
    name: string;
    category: string;
    description: string;
    tags: string[];
  }[];
  route_description: string;
  polyline?: string;
  route_steps?: {
    instruction: string;
    distance_km: number;
    duration_minutes: number;
  }[];
  real_route?: boolean;
  via_roads?: string[];
}

export const planRoute = async (request: RoutePlanRequest): Promise<RoutePlanResponse> => {
  const response = await api.post('/routes/plan', request);
  return response.data;
};

// Nearby POIs
export interface NearbyPOIRequest {
  latitude: number;
  longitude: number;
  radius_km?: number;
  categories?: string[];
  limit?: number;
}

export interface NearbyPOI extends HeritageItem {
  distance_km: number;
  direction: string;
}

export interface NearbyPOIResponse {
  user_location: { lat: number; lng: number };
  pois: NearbyPOI[];
  total_found: number;
}

export const getNearbyPOIs = async (request: NearbyPOIRequest): Promise<NearbyPOIResponse> => {
  const response = await api.post('/nearby', request);
  return response.data;
};

export const getNearbyCategoryCounts = async (
  latitude: number,
  longitude: number,
  radius_km: number = 50
): Promise<{
  location: { lat: number; lng: number };
  radius_km: number;
  total_pois: number;
  categories: { category: string; count: number }[];
}> => {
  const response = await api.get('/nearby/categories', {
    params: { latitude, longitude, radius_km },
  });
  return response.data;
};

// Google Directions API
export interface DirectionsResponse {
  status: string;
  origin_address: string;
  destination_address: string;
  distance_km: number;
  duration_hours: number;
  duration_text: string;
  polyline: string;
  via_roads: string[];
  steps: {
    instruction: string;
    distance_km: number;
    duration_minutes: number;
  }[];
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

export const getRouteDirections = async (
  origin: string,
  destination: string,
  waypoints?: string[]
): Promise<DirectionsResponse> => {
  const params: any = { origin, destination };
  if (waypoints && waypoints.length > 0) {
    params.waypoints = waypoints;
  }
  const response = await api.post('/routes/directions', null, { params });
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

// Contributions
export interface Contribution {
  id: string;
  user_id: string;
  user_name: string;
  heritage_item_id?: string;
  type: string;
  title: string;
  content: string;
  location?: { lat: number; lng: number };
  category?: string;
  region?: string;
  image_urls?: string[];
  status: string;
  votes: number;
  created_at: string;
}

export interface ContributionCreate {
  heritage_item_id?: string;
  type: string;
  title: string;
  content: string;
  location?: { lat: number; lng: number };
  category?: string;
  region?: string;
  image_urls?: string[];
}

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

export const getMyContributions = async (token: string): Promise<Contribution[]> => {
  const response = await api.get('/contributions/my', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const createContribution = async (
  contribution: ContributionCreate,
  token: string
): Promise<Contribution> => {
  const response = await api.post('/contributions', contribution, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const voteContribution = async (contributionId: string, token: string): Promise<void> => {
  await api.post(`/contributions/${contributionId}/vote`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Gallery
export const getGallery = async (category: string): Promise<{
  id: string;
  name: string;
  image_url: string;
  region: string;
}[]> => {
  const response = await api.get(`/gallery/${category}`);
  return response.data;
};

// Gamification
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  requirement?: number;
  threshold?: number;
  type: string;
  points?: number;
  earned?: boolean;
  progress?: number;
  progress_pct?: number;
  current?: number;
}

export interface UserProgress {
  user_id: string;
  visits_count: number;
  favorites_count: number;
  routes_completed: number;
  contributions_approved: number;
  total_points: number;
  level: number;
  badges: Badge[];
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  picture?: string;
  total_points: number;
  score: number;
  rank: number;
  level: number;
  badges_count: number;
  total_checkins?: number;
  streak_days?: number;
  top_region?: string;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  period: string;
  region: string;
}

export interface LeaderboardStats {
  total_explorers: number;
  total_checkins: number;
  total_xp: number;
  top3: LeaderboardEntry[];
  top_regions: { region: string; count: number }[];
}

export interface ExplorerProfile {
  user_id: string;
  name: string;
  picture?: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  next_level_xp: number;
  total_checkins: number;
  badges: string[];
  badges_count: number;
  region_stats: { region: string; count: number; color: string }[];
  category_stats: { category: string; count: number }[];
  recent_checkins: any[];
  streak_days: number;
  member_since: string;
  rank: number;
}

export interface RegionInfo {
  region: string;
  players: number;
}

export const getBadges = async (): Promise<Badge[]> => {
  const response = await api.get('/badges');
  return response.data;
};

export const getUserProgress = async (token: string): Promise<UserProgress> => {
  const response = await api.get('/gamification/progress', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const recordVisit = async (itemId: string, token: string): Promise<void> => {
  await api.post(`/gamification/visit/${itemId}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const completeRoute = async (routeId: string, token: string): Promise<void> => {
  await api.post(`/gamification/complete-route/${routeId}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getLeaderboard = async (limit?: number, period: string = 'all', region: string = ''): Promise<LeaderboardResponse> => {
  const response = await api.get('/leaderboard/top', { params: { limit, period, region: region || undefined } });
  return response.data;
};

export const getLeaderboardStats = async (): Promise<LeaderboardStats> => {
  const response = await api.get('/leaderboard/stats');
  return response.data;
};

export const getExplorerProfile = async (userId: string): Promise<ExplorerProfile> => {
  const response = await api.get(`/leaderboard/explorer/${userId}`);
  return response.data;
};

export const getLeaderboardRegions = async (): Promise<RegionInfo[]> => {
  const response = await api.get('/leaderboard/regions');
  return response.data;
};

// Calendar
export interface CalendarEvent {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  category: string;
  region: string;
  description: string;
}

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

// Agenda Viral API
export interface AgendaEvent {
  id: string;
  name: string;
  type: string;
  date_text: string;
  month: number;
  day_start?: number;
  day_end?: number;
  region: string;
  concelho?: string;
  description: string;
  rarity?: string;
  source?: string;
  price?: string;
  capacity?: string;
  genres?: string;
  has_tickets?: boolean;
  ticket_url?: string;
}

export const getAgendaEvents = async (params?: {
  type?: string;
  region?: string;
  month?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: AgendaEvent[]; total: number }> => {
  const response = await api.get('/agenda/events', { params });
  return response.data;
};

export const getAgendaEventDetail = async (eventId: string): Promise<AgendaEvent> => {
  const response = await api.get(`/agenda/event/${eventId}`);
  return response.data;
};

export const getAgendaCalendar = async (): Promise<any> => {
  const response = await api.get('/agenda/calendar');
  return response.data;
};

export const getAgendaStats = async (): Promise<any> => {
  const response = await api.get('/agenda/stats');
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

// Dashboard / Gamification
export interface DashboardProgress {
  user_id: string;
  total_points: number;
  total_visits: number;
  unique_pois: number;
  visits_by_category: Record<string, number>;
  visits_by_region: Record<string, number>;
  current_streak: number;
  longest_streak: number;
  last_visit_date: string | null;
  badges_earned: string[];
  level: number;
  level_name: string;
  level_icon: string;
  level_progress: number;
  points_to_next_level: number;
}

export interface DashboardStatistics {
  total_visits: number;
  unique_pois: number;
  current_streak: number;
  longest_streak: number;
  badges_unlocked: number;
  total_badges: number;
  top_categories: { category: string; count: number }[];
  top_regions: { region: string; count: number }[];
}

export interface VisitRecord {
  id: string;
  user_id: string;
  poi_id: string;
  poi_name: string;
  category: string;
  region: string;
  timestamp: string;
  points_earned: number;
}

export interface VisitResponse {
  visit_id: string;
  points_earned: number;
  total_points: number;
  new_badges: Badge[];
  current_streak: number;
}

export const recordDashboardVisit = async (poiId: string, token: string): Promise<VisitResponse> => {
  const response = await api.post(`/dashboard/visit?poi_id=${poiId}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getDashboardProgress = async (token: string): Promise<DashboardProgress> => {
  const response = await api.get('/dashboard/progress', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getDashboardBadges = async (token: string): Promise<Badge[]> => {
  const response = await api.get('/dashboard/badges', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getDashboardStatistics = async (token: string): Promise<DashboardStatistics> => {
  const response = await api.get('/dashboard/statistics', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getVisitHistory = async (token: string, limit?: number): Promise<VisitRecord[]> => {
  const response = await api.get('/dashboard/history', {
    params: { limit },
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getDashboardLeaderboard = async (limit?: number): Promise<LeaderboardEntry[]> => {
  const response = await api.get('/dashboard/leaderboard', { params: { limit } });
  return response.data;
};

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
  traveler_profile?: string
): Promise<DiscoveryFeedResponse> => {
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const response = await api.post('/discover/feed', 
    { lat, lng, limit: limit || 30, traveler_profile },
    { headers }
  );
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

// Mobility Data
export interface TransportStop {
  external_id: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[];
}

export interface StopDeparture {
  stop_id: string;
  line_id: string;
  line_name: string;
  destination: string;
  scheduled_time: string;
  estimated_time?: string;
  is_realtime: boolean;
  delay_minutes: number;
}

export interface TideConditions {
  available: boolean;
  station?: string;
  current_height_m?: number;
  current_state?: string;
  next_high_tide?: { datetime: string; height_meters: number };
  next_low_tide?: { datetime: string; height_meters: number };
  message?: string;
}

export interface WaveConditions {
  available: boolean;
  station?: string;
  wave_height_m?: number;
  wave_period_s?: number;
  wave_direction?: string;
  surf_quality?: string;
  water_temp_c?: number;
  message?: string;
}

export interface OccupancyEstimate {
  available: boolean;
  location_name?: string;
  current_level?: string;
  current_percentage?: number;
  trend?: string;
  predicted_best_time?: string;
  message?: string;
}

export const getTransportInfo = async (
  lat: number,
  lng: number,
  radiusM?: number
): Promise<{ stops: TransportStop[]; next_departures: StopDeparture[] }> => {
  const response = await api.get('/mobility/transport', { params: { lat, lng, radius_m: radiusM || 1000 } });
  return response.data;
};

export const getTideInfo = async (lat: number, lng: number): Promise<TideConditions> => {
  const response = await api.get('/mobility/tides', { params: { lat, lng } });
  return response.data;
};

export const getWaveInfo = async (lat: number, lng: number): Promise<WaveConditions> => {
  const response = await api.get('/mobility/waves', { params: { lat, lng } });
  return response.data;
};

export const getOccupancyEstimate = async (itemId: string): Promise<OccupancyEstimate> => {
  const response = await api.get(`/mobility/occupancy/${itemId}`);
  return response.data;
};

// User Preferences
export interface UserPreferences {
  user_id: string;
  traveler_profiles: Record<string, number>;
  favorite_themes: string[];
  favorite_regions: string[];
  preferred_pace: string;
  budget_level: string;
  has_car: boolean;
  preferred_transport: string[];
  typical_group_size: number;
  traveling_with_children: boolean;
  interests: string[];
  notifications_enabled: boolean;
  geofence_alerts: boolean;
  onboarding_completed: boolean;
}

export const getUserPreferences = async (token: string): Promise<UserPreferences> => {
  const response = await api.get('/preferences', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateUserPreferences = async (
  token: string,
  updates: Partial<UserPreferences>
): Promise<{ message: string; updated_fields: string[] }> => {
  const response = await api.put('/preferences', updates, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const completeOnboarding = async (
  token: string,
  travelerProfiles: Record<string, number>,
  favoriteRegions: string[],
  interests: string[]
): Promise<{ message: string; personalization_enabled: boolean }> => {
  const response = await api.post('/preferences/onboarding', 
    { traveler_profiles: travelerProfiles, favorite_regions: favoriteRegions, interests },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

// ========================
// AUDIO GUIDES (TTS)
// ========================

export interface AudioGuideResult {
  success: boolean;
  audio_base64?: string;
  audio_format?: string;
  voice?: string;
  speed?: number;
  model?: string;
  cached?: boolean;
  duration_estimate_seconds?: number;
  poi_id?: string;
  poi_name?: string;
  language?: string;
  error?: string;
  audio_available?: boolean;
}

export interface AudioVoice {
  id: string;
  name: string;
  description: string;
  best_for: string[];
}

export interface AudioVoicesResponse {
  voices: AudioVoice[];
  models: { id: string; name: string; description: string }[];
  speeds: { id: string; value: number; description: string }[];
  supported_languages: string[];
}

export const generateAudioGuide = async (
  text: string,
  poiName: string,
  poiId: string,
  category?: string,
  language?: string,
  useHd?: boolean,
  speed?: string
): Promise<AudioGuideResult> => {
  const response = await api.post('/audio/generate', {
    text,
    poi_name: poiName,
    poi_id: poiId,
    category,
    language: language || 'pt',
    use_hd: useHd || false,
    speed: speed || 'normal',
  });
  return response.data;
};

export const getAudioGuideForItem = async (
  itemId: string,
  useHd?: boolean,
  speed?: string
): Promise<AudioGuideResult> => {
  const response = await api.get(`/audio/guide/${itemId}`, {
    params: { use_hd: useHd, speed },
  });
  return response.data;
};

export const getAvailableVoices = async (): Promise<AudioVoicesResponse> => {
  const response = await api.get('/audio/voices');
  return response.data;
};

// ========================
// MARINE DATA (Real Open-Meteo API)
// ========================

export interface MarineWaveConditions {
  source: string;
  api_type: string;
  latitude: number;
  longitude: number;
  nearest_spot?: {
    id: string;
    name: string;
    distance_km: number;
  };
  current: {
    wave_height_m: number;
    wave_direction_degrees: number;
    wave_direction_cardinal: string;
    wave_period_s: number;
    surf_quality: string;
  };
  swell?: {
    height_m?: number;
    direction_degrees?: number;
    period_s?: number;
  };
  forecast_3h?: {
    time: string;
    wave_height_m?: number;
    wave_direction?: string;
    wave_period_s?: number;
  }[];
  timestamp: string;
}

export interface SurfSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  best_swell: string;
  best_wind: string;
}

export interface SurfSpotConditions extends MarineWaveConditions {
  spot: SurfSpot;
  spot_id: string;
}

export interface AllSpotsConditions {
  spots: {
    spot_id: string;
    spot: SurfSpot;
    wave_height_m: number;
    wave_period_s: number;
    wave_direction: string;
    surf_quality: string;
  }[];
  timestamp: string;
  source: string;
}

export const getRealWaveConditions = async (lat: number, lng: number): Promise<MarineWaveConditions> => {
  const response = await api.get('/marine/waves', { params: { lat, lng } });
  return response.data;
};

export const listSurfSpots = async (): Promise<{ spots: SurfSpot[]; total: number }> => {
  const response = await api.get('/marine/spots');
  return response.data;
};

export const getSurfSpotConditions = async (spotId: string): Promise<SurfSpotConditions> => {
  const response = await api.get(`/marine/spot/${spotId}`);
  return response.data;
};

export const getAllSpotsConditions = async (): Promise<AllSpotsConditions> => {
  const response = await api.get('/marine/spots/all');
  return response.data;
};

// ========================
// ENCYCLOPEDIA VIVA
// ========================

export interface EncyclopediaUniverse {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  categories: string[];
  article_count: number;
  item_count: number;
}

export interface EncyclopediaArticle {
  id: string;
  title: string;
  slug: string;
  universe: string;
  summary: string;
  content?: string;
  region?: string;
  location?: { lat: number; lng: number };
  image_url?: string;
  gallery?: string[];
  related_articles?: string[];
  related_items?: string[];
  tags: string[];
  sources?: string[];
  views: number;
  created_at: string;
  updated_at: string;
}

export interface EncyclopediaUniverseDetail extends EncyclopediaUniverse {
  articles: EncyclopediaArticle[];
  featured_items: HeritageItem[];
  total_articles: number;
  total_items: number;
}

export interface EncyclopediaArticleDetail extends EncyclopediaArticle {
  related_articles_data: EncyclopediaArticle[];
  related_items_data: HeritageItem[];
  universe_info: EncyclopediaUniverse;
}

export interface EncyclopediaFeatured {
  top_articles: EncyclopediaArticle[];
  recent_articles: EncyclopediaArticle[];
  universe_highlights: {
    universe: EncyclopediaUniverse;
    featured_article: EncyclopediaArticle;
  }[];
}

export const getEncyclopediaUniverses = async (): Promise<EncyclopediaUniverse[]> => {
  const response = await api.get('/encyclopedia/universes');
  return response.data;
};

export const getEncyclopediaUniverse = async (universeId: string): Promise<EncyclopediaUniverseDetail> => {
  const response = await api.get(`/encyclopedia/universe/${universeId}`);
  return response.data;
};

export const getEncyclopediaArticles = async (params?: {
  universe?: string;
  region?: string;
  tag?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<{ articles: EncyclopediaArticle[]; total: number }> => {
  const response = await api.get('/encyclopedia/articles', { params });
  return response.data;
};

export const getEncyclopediaArticle = async (articleId: string): Promise<EncyclopediaArticleDetail> => {
  const response = await api.get(`/encyclopedia/article/${articleId}`);
  return response.data;
};

export const getEncyclopediaFeatured = async (): Promise<EncyclopediaFeatured> => {
  const response = await api.get('/encyclopedia/featured');
  return response.data;
};

export const searchEncyclopedia = async (query: string, limit: number = 20): Promise<{
  query: string;
  articles: EncyclopediaArticle[];
  items: HeritageItem[];
  total: number;
}> => {
  const response = await api.get('/encyclopedia/search', { params: { q: query, limit } });
  return response.data;
};

// ========================
// WEATHER & SAFETY (IPMA + Fogos.pt)
// ========================

export interface WeatherAlert {
  id: string;
  type: string;
  level: 'green' | 'yellow' | 'orange' | 'red';
  region: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
}

export interface WeatherForecast {
  date: string;
  location: string;
  temp_min: number;
  temp_max: number;
  precipitation_prob: number;
  wind_direction: string;
  weather_type: number;
  weather_description: string;
}

export interface ActiveFire {
  id: string;
  lat: number;
  lng: number;
  district: string;
  municipality: string;
  parish: string;
  status: string;
  importance: string;
  firefighters: number;
  nature: string;
}

export interface SafetyCheck {
  location: { lat: number; lng: number };
  safety_level: 'safe' | 'warning' | 'danger';
  message: string;
  weather_alerts: WeatherAlert[];
  nearby_fires: ActiveFire[];
  checked_at: string;
}

export const getWeatherAlerts = async (): Promise<{ alerts: WeatherAlert[]; total: number }> => {
  const response = await api.get('/weather/alerts');
  return response.data;
};

export const getWeatherForecast = async (location: string): Promise<{ 
  location: string; 
  forecasts: WeatherForecast[] 
}> => {
  const response = await api.get(`/weather/forecast/${location}`);
  return response.data;
};

export const getFireRisk = async (district?: string): Promise<{
  fire_risks: { region: string; risk_level: number; risk_name: string }[];
  total: number;
}> => {
  const response = await api.get('/weather/fire-risk', { params: { district } });
  return response.data;
};

export const getActiveFires = async (district?: string): Promise<{
  fires: ActiveFire[];
  total: number;
  active_count: number;
}> => {
  const response = await api.get('/fires/active', { params: { district } });
  return response.data;
};

export const getFiresNearby = async (lat: number, lng: number, radius_km: number = 50): Promise<{
  fires: ActiveFire[];
  total: number;
}> => {
  const response = await api.get('/fires/nearby', { params: { lat, lng, radius_km } });
  return response.data;
};

export const getSafetyCheck = async (lat: number, lng: number): Promise<SafetyCheck> => {
  const response = await api.get('/safety/check', { params: { lat, lng } });
  return response.data;
};

// ========================
// ACCESSIBILITY FILTERS
// ========================

export interface AccessibilityFilter {
  id: string;
  name: string;
  icon: string;
}

export const getAccessibilityFilters = async (): Promise<{ filters: AccessibilityFilter[] }> => {
  const response = await api.get('/accessibility/filters');
  return response.data;
};

export const getAccessibleHeritage = async (
  filters?: string[],
  region?: string,
  category?: string,
  limit?: number
): Promise<{ items: HeritageItem[]; total: number; filters_applied: string[] }> => {
  const response = await api.get('/heritage/accessible', {
    params: {
      filters: filters?.join(','),
      region,
      category,
      limit,
    },
  });
  return response.data;
};

// ============================================
// IQ ENGINE API
// ============================================

export interface IQModuleResult {
  module: string;
  score: number;
  status: string;
  processing_time_ms: number;
  data: any;
  suggestions: string[];
}

export interface IQProcessResult {
  poi_id: string;
  poi_name: string;
  overall_score: number;
  processing_time_ms: number;
  modules_run: string[];
  results: IQModuleResult[];
  recommendations: string[];
}

export interface IQEngineHealth {
  status: string;
  modules_registered: string[];
  total_modules: number;
}

export const getIQHealth = async (): Promise<IQEngineHealth> => {
  const response = await api.get('/iq/health');
  return response.data;
};

export const processPoiIQ = async (
  poiId: string,
  tenantId: string,
  modules?: string[]
): Promise<IQProcessResult> => {
  const config: any = {
    headers: { 'X-Tenant-ID': tenantId },
  };
  const response = await api.post(
    `/iq/process-poi/${poiId}`,
    modules && modules.length > 0 ? modules : null,
    config
  );
  return response.data;
};

export const batchProcessIQ = async (
  tenantId: string,
  limit?: number
): Promise<any> => {
  const response = await api.post(
    '/iq/batch-process',
    { limit: limit || 10 },
    { headers: { 'X-Tenant-ID': tenantId } }
  );
  return response.data;
};

export const getIQStats = async (tenantId: string): Promise<any> => {
  const response = await api.get('/iq/stats', {
    headers: { 'X-Tenant-ID': tenantId },
  });
  return response.data;
};

// Get tenant heritage items for IQ processing
export const getTenantPOIs = async (tenantId: string): Promise<any[]> => {
  const response = await api.get('/heritage', {
    headers: { 'X-Tenant-ID': tenantId },
  });
  return response.data;
};

// ========================
// SMART ROUTES (IQ Engine)
// ========================

export interface SmartRouteTheme {
  id: string;
  name: string;
  poi_count: number;
}

export interface SmartRouteProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  default_difficulty: string;
  default_max_duration: number;
}

export interface SmartRouteRegion {
  id: string;
  name: string;
  poi_count: number;
  avg_iq_score: number;
}

export interface SmartRoutePOI {
  order: number;
  id: string;
  name: string;
  description: string;
  category: string;
  region: string;
  location: { lat: number; lng: number } | null;
  address: string;
  iq_score: number;
  visit_minutes: number;
  difficulty: string;
  best_time: string;
  weather_type: string;
  primary_themes: string[];
  image_url: string | null;
}

export interface SmartRouteResponse {
  route_name: string;
  generated_at: string;
  filters: {
    theme: string | null;
    region: string | null;
    difficulty: string | null;
    profile: string | null;
    max_duration: number | null;
    rain_friendly: boolean | null;
  };
  metrics: {
    total_distance_km: number;
    total_visit_minutes: number;
    total_travel_minutes: number;
    total_duration_minutes: number;
    total_duration_label: string;
    poi_count: number;
  };
  avg_iq_score: number;
  candidates_evaluated: number;
  pois: SmartRoutePOI[];
}

export const getSmartRouteThemes = async (): Promise<{ themes: SmartRouteTheme[] }> => {
  const response = await api.get('/routes-smart/themes');
  return response.data;
};

export const getSmartRouteProfiles = async (): Promise<{ profiles: SmartRouteProfile[] }> => {
  const response = await api.get('/routes-smart/profiles');
  return response.data;
};

export const getSmartRouteRegions = async (): Promise<{ regions: SmartRouteRegion[] }> => {
  const response = await api.get('/routes-smart/regions');
  return response.data;
};

export interface SmartRouteRequest {
  theme?: string;
  region?: string;
  difficulty?: string;
  profile?: string;
  max_duration?: number;
  max_pois?: number;
  rain_friendly?: boolean;
  origin_lat?: number;
  origin_lng?: number;
  dest_lat?: number;
  dest_lng?: number;
  corridor_km?: number;
}

export const generateSmartRoute = async (params: SmartRouteRequest): Promise<SmartRouteResponse> => {
  const response = await api.get('/routes-smart/generate', { params });
  return response.data;
};

// ========================
// SMART ITINERARY ENGINE
// ========================

export interface SmartItineraryLocality {
  name: string;
  region: string;
  poi_count: number;
  center: { lat: number; lng: number };
  category_count: number;
}

export interface SmartItineraryPOI {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  region: string;
  location?: { lat: number; lng: number };
  image_url?: string;
  description?: string;
  iq_score?: number;
  visit_minutes: number;
  travel_from_previous_min: number;
  distance_from_previous_km: number;
}

export interface SmartItineraryPeriod {
  period: string;
  label: string;
  icon: string;
  start_time: string;
  pois: SmartItineraryPOI[];
}

export interface SmartItineraryDay {
  day: number;
  periods: SmartItineraryPeriod[];
  total_visit_minutes: number;
  total_travel_minutes: number;
  total_minutes: number;
  poi_count: number;
}

export interface SmartItineraryResponse {
  locality: string | null;
  region: string;
  days: number;
  interests: string[];
  profile: string;
  pace: string;
  max_radius_km: number;
  center: { lat: number; lng: number };
  itinerary: SmartItineraryDay[];
  summary: {
    total_pois: number;
    total_visit_minutes: number;
    total_travel_minutes: number;
    total_minutes: number;
    categories_covered: string[];
    category_count: number;
  };
  transport: { recommended: string[] };
  events_nearby: { id: string; name: string; type?: string; description?: string; date_text?: string }[];
  generated_at: string;
}

export interface SmartItineraryRequest {
  locality?: string;
  region?: string;
  days?: number;
  interests?: string;
  categories?: string;
  profile?: string;
  pace?: string;
  max_radius_km?: number;
}

export const getLocalities = async (region?: string, search?: string): Promise<{ localities: SmartItineraryLocality[] }> => {
  const params: Record<string, string> = {};
  if (region) params.region = region;
  if (search) params.search = search;
  const response = await api.get('/planner/localities', { params });
  return response.data;
};

export const generateSmartItinerary = async (params: SmartItineraryRequest): Promise<SmartItineraryResponse> => {
  const response = await api.get('/planner/smart-itinerary', { params });
  return response.data;
};

// AI-powered itinerary with GPT-4o narrative descriptions
export interface AiItineraryResponse extends SmartItineraryResponse {
  ai_powered: boolean;
  narrative?: {
    title: string;
    introduction: string;
    daily_narratives: {
      day: number;
      theme: string;
      morning_narrative: string;
      afternoon_narrative: string;
      evening_tip: string;
    }[];
    closing: string;
  };
}

export const generateAiItinerary = async (params: SmartItineraryRequest): Promise<AiItineraryResponse> => {
  const response = await api.get('/planner/ai-itinerary', { params });
  return response.data;
};

// ========================
// IQ MONITOR
// ========================

export interface IQOverview {
  total_pois: number;
  iq_processed: number;
  iq_pending: number;
  iq_progress_pct: number;
  with_coordinates: number;
  avg_iq_score: number;
  max_iq_score: number;
  min_iq_score: number;
  score_distribution: { label: string; min: number; max: number; count: number; color: string }[];
  categories: { name: string; count: number; avg_score: number; max_score: number }[];
  regions: { name: string; count: number; avg_score: number }[];
}

export interface IQAdminData extends IQOverview {
  modules: { name: string; processed: number; avg_score: number; avg_confidence: number; pass: number; warn: number; fail: number }[];
  sources: { name: string; count: number }[];
  recent_processed: { id: string; name: string; category: string; region: string; iq_score: number; iq_processed_at: string; iq_module_count: number }[];
  top_pois: { id: string; name: string; category: string; region: string; iq_score: number }[];
  bottom_pois: { id: string; name: string; category: string; region: string; iq_score: number }[];
  import_batches: { batch_id: string; total: number; iq_done: number }[];
}

export const getIQOverview = async (): Promise<IQOverview> => {
  const response = await api.get('/iq-monitor/overview');
  return response.data;
};

export const getIQAdmin = async (): Promise<IQAdminData> => {
  const response = await api.get('/iq-monitor/admin');
  return response.data;
};

// ========================
// POI DO DIA
// ========================

export interface POIDoDia {
  has_poi: boolean;
  date: string;
  category: string;
  category_label: string;
  category_icon: string;
  tomorrow_category: string;
  poi: {
    id: string;
    name: string;
    description: string;
    category: string;
    subcategory: string;
    region: string;
    address: string;
    location: { lat: number; lng: number };
    image_url: string | null;
    iq_score: number;
    rarity: string;
    website: string;
  };
}

export const getPOIDoDia = async (): Promise<POIDoDia> => {
  const response = await api.get('/poi-do-dia');
  return response.data;
};

// ========================
// GAMIFICAÇÃO
// ========================

export interface GamificationProfile {
  user_id: string;
  total_checkins: number;
  level: number;
  xp: number;
  xp_to_next_level: number;
  earned_badges_count: number;
  total_badges: number;
  badges: Badge[];
  recent_checkins: { poi_id: string; poi_name: string; poi_category: string; poi_region: string; checked_in_at: string; xp_earned: number }[];
  region_counts: Record<string, number>;
  category_counts: Record<string, number>;
}

export interface NearbyCheckinPOI {
  id: string;
  name: string;
  category: string;
  region: string;
  distance_m: number;
  iq_score: number;
  location: { lat: number; lng: number };
  can_checkin: boolean;
}

export interface CheckInResult {
  success: boolean;
  message: string;
  distance_m: number;
  xp_earned?: number;
  new_badges?: { id: string; name: string; icon: string; color: string }[];
  total_checkins?: number;
}

export const getGamificationProfile = async (userId: string = 'default_user'): Promise<GamificationProfile> => {
  const response = await api.get(`/gamification/profile/${userId}`);
  return response.data;
};

export const getNearbyCheckins = async (lat: number, lng: number, radiusKm: number = 5): Promise<{ pois: NearbyCheckinPOI[]; total_nearby: number }> => {
  const response = await api.get('/gamification/nearby-checkins', { params: { lat, lng, radius_km: radiusKm, limit: 20 } });
  return response.data;
};

export const doCheckin = async (userLat: number, userLng: number, poiId: string): Promise<CheckInResult> => {
  const response = await api.post('/gamification/checkin', { user_lat: userLat, user_lng: userLng, poi_id: poiId });
  return response.data;
};

export const getGamificationLeaderboard = async (): Promise<{ leaderboard: any[] }> => {
  const response = await api.get('/gamification/leaderboard');
  return response.data;
};

// ========================
// NATURE & BIODIVERSITY
// ========================

export const getProtectedAreas = async (params?: {
  lat?: number; lng?: number; radius_km?: number; network?: string;
}): Promise<{ areas: any[]; total: number }> => {
  const key = `cache_protected_areas_${JSON.stringify(params || {})}`;
  return cachedGet(key, async () => {
    const response = await api.get('/nature/protected-areas', { params });
    return response.data;
  });
};

export const getNearestProtectedArea = async (lat: number, lng: number): Promise<any> => {
  const response = await api.get('/nature/protected-areas/nearest', { params: { lat, lng } });
  return response.data;
};

export const getNatura2000Sites = async (params?: {
  lat?: number; lng?: number; radius_km?: number; site_type?: string;
}): Promise<{ sites: any[]; total: number }> => {
  const key = `cache_natura2000_${JSON.stringify(params || {})}`;
  return cachedGet(key, async () => {
    const response = await api.get('/nature/natura2000', { params });
    return response.data;
  });
};

export const getBiodiversityStations = async (params?: {
  lat?: number; lng?: number; radius_km?: number;
}): Promise<{ stations: any[]; total: number }> => {
  const key = `cache_biodiversity_${JSON.stringify(params || {})}`;
  return cachedGet(key, async () => {
    const response = await api.get('/nature/biodiversity-stations', { params });
    return response.data;
  });
};

export const getNearestBiodiversityStation = async (lat: number, lng: number): Promise<any> => {
  const response = await api.get('/nature/biodiversity-stations/nearest', { params: { lat, lng } });
  return response.data;
};

export const getSpeciesNearby = async (lat: number, lng: number, radius_km: number = 10, limit: number = 20): Promise<{ species: any[]; total: number }> => {
  const response = await api.get('/nature/species/nearby', { params: { lat, lng, radius_km, limit } });
  return response.data;
};

export const getSpeciesCount = async (lat: number, lng: number, radius_km: number = 10): Promise<any> => {
  const response = await api.get('/nature/species/count', { params: { lat, lng, radius_km } });
  return response.data;
};

export const getNotableSpecies = async (region?: string): Promise<{ species: any[]; total: number }> => {
  const key = `cache_notable_species_${region || 'all'}`;
  return cachedGet(key, async () => {
    const response = await api.get('/nature/species/notable', { params: region ? { region } : {} });
    return response.data;
  });
};

export const getSpeciesDetails = async (taxonKey: number): Promise<any> => {
  const key = `cache_species_${taxonKey}`;
  return cachedGet(key, async () => {
    const response = await api.get(`/nature/species/${taxonKey}`);
    return response.data;
  });
};

export const getNatureMapLayers = async (): Promise<{ layers: any[] }> => {
  const key = 'cache_nature_map_layers';
  return cachedGet(key, async () => {
    const response = await api.get('/nature/map-layers');
    return response.data;
  });
};

export const reverseGeocode = async (lat: number, lng: number): Promise<any> => {
  const response = await api.get('/nature/geo/reverse', { params: { lat, lng } });
  return response.data;
};

export const getMunicipality = async (concelho: string): Promise<any> => {
  const key = `cache_municipality_${concelho}`;
  return cachedGet(key, async () => {
    const response = await api.get(`/nature/geo/municipality/${concelho}`);
    return response.data;
  });
};

// ========================
// DISCOVERY - SUSTAINABLE TOURISM
// ========================

export const enrichEvent = async (lat: number, lng: number, name: string = ''): Promise<any> => {
  const response = await api.get('/discovery/enrich-event', { params: { lat, lng, name } });
  return response.data;
};

export const getEventToNatureItinerary = async (lat: number, lng: number, name: string = ''): Promise<any> => {
  const response = await api.get('/discovery/event-to-nature', { params: { lat, lng, name } });
  return response.data;
};

export const getTrailSafety = async (lat: number, lng: number): Promise<any> => {
  const response = await api.get('/discovery/trail-safety', { params: { lat, lng } });
  return response.data;
};

export const findHikingTrails = async (lat: number, lng: number, radius_m: number = 10000): Promise<{ trails: any[]; total: number }> => {
  const response = await api.get('/discovery/trails/hiking', { params: { lat, lng, radius_m } });
  return response.data;
};

export const findCyclingRoutes = async (lat: number, lng: number, radius_m: number = 15000): Promise<{ routes: any[]; total: number }> => {
  const response = await api.get('/discovery/trails/cycling', { params: { lat, lng, radius_m } });
  return response.data;
};

export const getEuroVeloRoutes = async (): Promise<{ routes: any[]; total: number }> => {
  const key = 'cache_eurovelo';
  return cachedGet(key, async () => {
    const response = await api.get('/discovery/trails/eurovelo');
    return response.data;
  });
};

export const getLongDistanceTrails = async (region?: string): Promise<{ trails: any[]; total: number }> => {
  const key = `cache_long_trails_${region || 'all'}`;
  return cachedGet(key, async () => {
    const response = await api.get('/discovery/trails/long-distance', { params: region ? { region } : {} });
    return response.data;
  });
};

export const getTrailPOIs = async (lat: number, lng: number, radius_m: number = 2000): Promise<{ pois: any[]; total: number }> => {
  const response = await api.get('/discovery/trails/pois-nearby', { params: { lat, lng, radius_m } });
  return response.data;
};

export const findNearbyTransport = async (lat: number, lng: number, radius_km: number = 2, transport_type?: string): Promise<{ stops: any[]; total: number }> => {
  const response = await api.get('/discovery/transport/nearby', { params: { lat, lng, radius_km, transport_type } });
  return response.data;
};

export const planTransportRoute = async (origin_lat: number, origin_lng: number, dest_lat: number, dest_lng: number): Promise<any> => {
  const response = await api.get('/discovery/transport/route', { params: { origin_lat, origin_lng, dest_lat, dest_lng } });
  return response.data;
};

export const exploreProtectedArea = async (areaId: string): Promise<any> => {
  const key = `cache_explore_pa_${areaId}`;
  return cachedGet(key, async () => {
    const response = await api.get(`/discovery/explore/protected-area/${areaId}`);
    return response.data;
  });
};

// =============================================================================
// PREMIUM / SUBSCRIPTION
// =============================================================================

export interface PremiumTierFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

export interface PremiumTier {
  id: string;
  name: string;
  price: number;
  price_label: string;
  features: PremiumTierFeature[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  recurring: boolean;
}

export interface PremiumTiersResponse {
  tiers: PremiumTier[];
  currency: string;
  trial_days: number;
  stripe_enabled: boolean;
  payment_methods: PaymentMethod[];
}

export interface SubscriptionStatus {
  user_id: string;
  tier: string;
  tier_name: string;
  status: string;
  features: PremiumTierFeature[];
  started_at?: string;
  expires_at?: string;
  stripe_subscription_id?: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
  payment_method?: string;
}

export const getPremiumTiers = async (): Promise<PremiumTiersResponse> => {
  const response = await api.get('/premium/tiers');
  return response.data;
};

export const getSubscriptionStatus = async (userId: string): Promise<SubscriptionStatus> => {
  const response = await api.get(`/premium/status/${userId}`);
  return response.data;
};

export const createCheckoutSession = async (
  userId: string, userEmail: string, tier: string
): Promise<CheckoutResponse> => {
  const response = await api.post('/premium/create-checkout', {
    user_id: userId, user_email: userEmail, tier,
  });
  return response.data;
};

export const createCheckoutMBWay = async (
  userId: string, userEmail: string, tier: string
): Promise<CheckoutResponse> => {
  const response = await api.post('/premium/create-checkout-mbway', {
    user_id: userId, user_email: userEmail, tier,
  });
  return response.data;
};

export const createCheckoutMultibanco = async (
  userId: string, userEmail: string, tier: string
): Promise<CheckoutResponse> => {
  const response = await api.post('/premium/create-checkout-multibanco', {
    user_id: userId, user_email: userEmail, tier,
  });
  return response.data;
};

export const createCustomerPortal = async (userId: string): Promise<{ portal_url: string }> => {
  const response = await api.post('/premium/create-portal', { user_id: userId });
  return response.data;
};

export const checkFeatureAccess = async (
  _userId: string, featureId: string
): Promise<{ has_access: boolean; user_tier: string; upgrade_needed: boolean }> => {
  const response = await api.get(`/premium/check-feature/${featureId}`);
  return response.data;
};

// Image Uploads
export const uploadImage = async (
  file: { uri: string; type: string; name: string },
  context: 'poi' | 'review' | 'contribution' | 'general',
  token: string,
  itemId?: string,
): Promise<{ url: string; id: string; size: number }> => {
  const formData = new FormData();
  formData.append('file', file as any);
  formData.append('context', context);
  if (itemId) formData.append('item_id', itemId);

  const response = await api.post('/uploads', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Community Photo Gallery — fetch user-uploaded images for a POI
export const getPoiImages = async (poiId: string): Promise<{
  images: { public_id: string; url: string; thumbnail_url: string; user_id: string; created_at: string }[];
  total: number;
}> => {
  const response = await api.get(`/cloudinary/poi-images/${poiId}`);
  return response.data;
};

// Admin: get all pending/recent user uploads for moderation
export const getAdminUploads = async (
  token: string,
  params?: { status?: string; limit?: number; skip?: number },
): Promise<{ uploads: any[]; total: number }> => {
  const response = await api.get('/admin/uploads', {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Admin: moderate an image (approve/reject/delete)
export const moderateImage = async (
  token: string,
  imageId: string,
  action: 'approve' | 'reject' | 'delete',
): Promise<{ success: boolean }> => {
  const response = await api.post(`/admin/uploads/${imageId}/moderate`, { action }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// ── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsDashboard {
  period_days: number;
  generated_at: string;
  overview: { total_users: number; total_pois: number; total_routes: number };
  visits: { total: number; unique_visitors: number; avg_visits_per_user: number };
  retention: { returning_visitors: number; retention_rate_pct: number };
  user_growth: {
    new_users_period: number;
    by_week: { week: string; count: number }[];
  };
  top_pois_favorited: {
    poi_id: string; name: string; category?: string; region?: string;
    image_url?: string; favorites_count: number;
  }[];
  top_routes_shared: {
    route_id?: string; name?: string; category?: string;
    share_count: number; view_count: number;
  }[];
  category_engagement: { category: string; visits: number }[];
  region_engagement: { region: string; visits: number }[];
}

export interface AnalyticsTrend {
  metric: string;
  period_days: number;
  data: { date: string; value: number }[];
}

export const getAnalyticsDashboard = async (
  periodDays: number = 30
): Promise<AnalyticsDashboard> => {
  const response = await api.get('/analytics/dashboard', {
    params: { period_days: periodDays },
  });
  return response.data;
};

export const getAnalyticsTrends = async (
  metric: 'visits' | 'new_users' = 'visits',
  days: number = 30
): Promise<AnalyticsTrend> => {
  const response = await api.get('/analytics/trends', {
    params: { metric, days },
  });
  return response.data;
};

// ========================
// SAVED ITINERARIES
// ========================

export interface SavedItinerary {
  id: string;
  title: string;
  description?: string;
  locality?: string;
  region?: string;
  days: number;
  profile?: string;
  pace?: string;
  interests?: string[];
  is_public: boolean;
  share_token?: string;
  collaborators_count: number;
  total_pois: number;
  total_visit_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface SavedItineraryDetail extends SavedItinerary {
  itinerary_data: any; // SmartItineraryResponse
  collaborators: { user_id: string; user_name: string; role: string; joined_at: string }[];
  votes: { poi_id: string; vote: 'up' | 'down'; user_id: string }[];
  budget_summary?: { total_eur: number; by_day: { day: number; eur: number }[] };
}

export interface ItineraryComment {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  day?: number;
  poi_id?: string;
  created_at: string;
}

export interface ItineraryAttachment {
  id: string;
  type: 'booking' | 'ticket' | 'note' | 'link';
  label: string;
  url?: string;
  notes?: string;
  amount_eur?: number;
  day?: number;
  poi_id?: string;
  created_at: string;
}

export const saveItinerary = async (data: {
  title: string;
  description?: string;
  itinerary_data: any;
  locality?: string;
  region?: string;
  days: number;
  profile?: string;
  pace?: string;
  interests?: string[];
  is_public?: boolean;
}): Promise<{ id: string; message: string }> => {
  const response = await api.post('/itineraries', data);
  return response.data;
};

export const listItineraries = async (): Promise<{ items: SavedItinerary[]; total: number }> => {
  const response = await api.get('/itineraries');
  return response.data;
};

export const getItinerary = async (id: string): Promise<SavedItineraryDetail> => {
  const response = await api.get(`/itineraries/${id}`);
  return response.data;
};

export const getSharedItinerary = async (token: string): Promise<SavedItineraryDetail> => {
  const response = await api.get(`/itineraries/shared/${token}`);
  return response.data;
};

export const updateItinerary = async (id: string, data: { title?: string; description?: string; is_public?: boolean }): Promise<void> => {
  await api.patch(`/itineraries/${id}`, data);
};

export const deleteItinerary = async (id: string): Promise<void> => {
  await api.delete(`/itineraries/${id}`);
};

export const shareItinerary = async (id: string, role: 'viewer' | 'editor' | 'voter' = 'viewer'): Promise<{ token: string; share_url: string }> => {
  const response = await api.post(`/itineraries/${id}/share`, { role });
  return response.data;
};

export const getItineraryComments = async (id: string, day?: number): Promise<{ comments: ItineraryComment[] }> => {
  const response = await api.get(`/itineraries/${id}/comments`, { params: day !== undefined ? { day } : {} });
  return response.data;
};

export const addItineraryComment = async (id: string, text: string, day?: number, poi_id?: string): Promise<ItineraryComment> => {
  const response = await api.post(`/itineraries/${id}/comment`, { text, day, poi_id });
  return response.data;
};

export const getItineraryBudget = async (id: string): Promise<{ total_eur: number; by_day: { day: number; eur: number }[]; attachments_total: number }> => {
  const response = await api.get(`/itineraries/${id}/budget`);
  return response.data;
};

export const addItineraryAttachment = async (id: string, data: {
  type: 'booking' | 'ticket' | 'note' | 'link';
  label: string;
  url?: string;
  notes?: string;
  amount_eur?: number;
  day?: number;
  poi_id?: string;
}): Promise<ItineraryAttachment> => {
  const response = await api.post(`/itineraries/${id}/attachment`, data);
  return response.data;
};

export const voteItineraryPoi = async (id: string, poi_id: string, vote: 'up' | 'down'): Promise<void> => {
  await api.post(`/itineraries/${id}/vote/${poi_id}`, { vote });
};

export default api;
