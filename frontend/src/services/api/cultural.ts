import api from './client';

// ─── Cultural Routes Hub ──────────────────────────────────────────────────────

export interface CulturalRouteEnriched {
  _id?: string;
  id?: string;
  name: string;
  family: string;
  sub_family?: string;
  region: string;
  municipalities?: string[];
  unesco?: boolean;
  unesco_label?: string;
  description_short?: string;
  duration_days?: number;
  best_months?: number[];
  instruments?: string[];
  dances?: string[];
  gastronomy?: string[];
  costumes?: string[];
  festivals?: string[];
  iq_score?: number;
  dynamic_iq_score?: number;
  connections_count?: number;
  pois_nearby?: { name: string; category: string; distance_km: number }[];
  events_upcoming?: { name: string; date: string; region: string; score: number }[];
  trails_nearby?: { name: string; distance_km: number; difficulty: string }[];
  lat?: number;
  lng?: number;
  stops?: { name: string; lat: number; lng: number; municipality: string; type: string }[];
}

export interface CulturalRoutesHubData {
  season_label: string;
  season_picks: CulturalRouteEnriched[];
  family_stats: Record<string, number>;
  nearby_routes?: CulturalRouteEnriched[];
  unesco_routes?: CulturalRouteEnriched[];
  total_routes: number;
  enriched_count: number;
}

export interface CulturalRoutesDiscover {
  mood: string;
  month: number;
  total: number;
  results: CulturalRouteEnriched[];
}

export const getCulturalRoutesHub = async (): Promise<CulturalRoutesHubData> => {
  const response = await api.get('/cultural-routes/hub');
  return response.data;
};

export const getCulturalRoutesSpotlight = async (): Promise<CulturalRouteEnriched> => {
  const response = await api.get('/cultural-routes/spotlight');
  return response.data;
};

export const discoverCulturalRoutes = async (params?: {
  mood?: string;
  lat?: number;
  lng?: number;
  month?: number;
  limit?: number;
}): Promise<CulturalRoutesDiscover> => {
  const response = await api.get('/cultural-routes/discover', { params });
  return response.data;
};

export const getRouteLiveCalendar = async (
  routeId: string,
  limit = 12,
): Promise<{ route_id: string; events: any[]; total: number }> => {
  const response = await api.get(`/cultural-routes/routes/${routeId}/live-calendar`, {
    params: { limit },
  });
  return response.data;
};
