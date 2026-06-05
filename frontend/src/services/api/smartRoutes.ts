import api from './client';

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
