import api from './client';

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
