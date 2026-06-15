import api, { cachedGet } from './client';
import type { HeritageItem, Route, ApiParams } from '../../types';

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

// ─── Trails ───────────────────────────────────────────────────────────────────

export interface Trail {
  id: string;
  name: string;
  description?: string;
  region?: string;
  difficulty?: 'facil' | 'moderado' | 'dificil' | 'muito_dificil';
  distance_km?: number;
  elevation_gain?: number;
  elevation_loss?: number;
  min_elevation?: number;
  max_elevation?: number;
  estimated_hours?: number;
  trail_type?: 'linear' | 'circular' | 'ida_volta';
  terrain_type?: string;
  color?: string;
  tags?: string[];
  points?: { lat: number; lng: number; ele?: number }[];
}

export interface FeaturedTrail extends Trail {
  park?: string;
  trail_type?: 'linear' | 'circular' | 'ida_volta';
  activities?: string[];
  rating?: number;
  source?: string;
  external_url?: string;
  needs_geometry?: boolean;
  geometry_source?: string | null;
  review_summary?: string | null;
  avg_time?: string | null;
  max_elevation?: number;
}

export interface FeaturedTrailsResponse {
  trails: FeaturedTrail[];
  total: number;
  source: string;
  attribution: string;
}

export interface ElevationProfilePoint {
  distance_km: number;
  elevation: number;
  lat: number;
  lng: number;
}

export const getTrails = async (region?: string): Promise<Trail[]> => {
  const params: Record<string, string> = {};
  if (region) params.region = region;
  const response = await api.get('/trails', { params });
  return response.data;
};

export const getTrail = async (id: string): Promise<Trail> => {
  const response = await api.get(`/trails/${id}`);
  return response.data;
};

// Featured trails (curated, sourced from AllTrails)
export const getFeaturedTrails = async (params?: {
  region?: string;
  difficulty?: string;
}): Promise<FeaturedTrailsResponse> => {
  const key = `cache_featured_trails_${JSON.stringify(params || {})}`;
  return cachedGet(key, async () => {
    const response = await api.get('/trails/featured', { params });
    return response.data;
  });
};

export const getFeaturedTrail = async (id: string): Promise<FeaturedTrail> => {
  const key = `cache_featured_trail_${id}`;
  return cachedGet(key, async () => {
    const response = await api.get(`/trails/featured/${id}`);
    return response.data;
  });
};

export const getTrailElevation = async (id: string): Promise<{ trail_name: string; profile: ElevationProfilePoint[] }> => {
  const response = await api.get(`/trails/elevation/${id}`);
  return response.data;
};

export const getTrailPOIs = async (id: string): Promise<any[]> => {
  const response = await api.get(`/trails/${id}/pois`);
  return response.data?.pois || response.data || [];
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
  const response = await api.get('/proximity/nearby', {
    params: {
      lat: request.latitude,
      lng: request.longitude,
      radius_km: request.radius_km ?? 5,
      category: request.categories?.[0],
      limit: request.limit ?? 20,
    },
  });
  const data = response.data;
  return {
    user_location: data.center || { lat: request.latitude, lng: request.longitude },
    pois: data.pois || [],
    total_found: data.total || 0,
  };
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
  const response = await api.get('/proximity/heatzone', {
    params: { lat: latitude, lng: longitude, radius_km },
  });
  const data = response.data;
  return {
    location: data.center || { lat: latitude, lng: longitude },
    radius_km: data.radius_km || radius_km,
    total_pois: data.total_pois || 0,
    categories: data.categories?.map((c: any) => ({ category: c.category, count: c.count })) || [],
  };
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
  const params: ApiParams = { origin, destination };
  if (waypoints && waypoints.length > 0) {
    params.waypoints = waypoints;
  }
  const response = await api.post('/routes/directions', null, { params });
  return response.data;
};
