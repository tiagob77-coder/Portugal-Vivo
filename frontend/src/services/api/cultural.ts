import api, { cachedGet } from './client';
import type { CulturalRoute } from '../../components/CulturalRouteCard';

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
  description_long?: string;
  duration_days?: number;
  best_months?: number[];
  music_genres?: string[];
  instruments?: string[];
  dances?: string[];
  gastronomy?: string[];
  costumes?: string[];
  festivals?: string[];
  voices_orality?: string[];
  tags?: string[];
  premium?: boolean;
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

// All cultural-routes reads go through cachedGet: network-first, with an
// AsyncStorage fallback so the screens keep working offline (24h TTL).
export const getCulturalRoutesHub = async (): Promise<CulturalRoutesHubData> =>
  cachedGet('cache_cultural_hub', async () => {
    const response = await api.get('/cultural-routes/hub');
    return response.data;
  });

export const getCulturalRoute = async (
  routeId: string,
): Promise<CulturalRouteEnriched> =>
  cachedGet(`cache_cultural_route_${routeId}`, async () => {
    const response = await api.get(`/cultural-routes/routes/${routeId}`);
    return response.data;
  });

/** Full premium routes list from the API (all families), id-normalised. */
export const listCulturalRoutes = async (): Promise<CulturalRoute[]> =>
  cachedGet('cache_cultural_routes_list', async () => {
    const response = await api.get('/cultural-routes/routes', { params: { limit: 50 } });
    const results: CulturalRouteEnriched[] = response.data?.results ?? [];
    return results.map((r) => ({ ...r, id: r._id ?? r.id })) as CulturalRoute[];
  });

export const getCulturalRoutesSpotlight = async (): Promise<CulturalRouteEnriched> =>
  cachedGet('cache_cultural_spotlight', async () => {
    const response = await api.get('/cultural-routes/spotlight');
    return response.data;
  });

export const discoverCulturalRoutes = async (params?: {
  mood?: string;
  lat?: number;
  lng?: number;
  month?: number;
  limit?: number;
}): Promise<CulturalRoutesDiscover> =>
  cachedGet(`cache_cultural_discover_${JSON.stringify(params || {})}`, async () => {
    const response = await api.get('/cultural-routes/discover', { params });
    return response.data;
  });

export interface CulturalEvent {
  id?: string;
  name: string;
  date_start?: string;
  date_end?: string;
  category?: string;
  region?: string;
  description?: string;
  month?: number;
  score?: number;
}

export interface RouteLiveCalendar {
  route_id: string;
  route_name?: string;
  region?: string;
  events: CulturalEvent[];
  total: number;
}

export const getRouteLiveCalendar = async (
  routeId: string,
  limit = 12,
): Promise<RouteLiveCalendar> =>
  cachedGet(`cache_cultural_events_${routeId}`, async () => {
    const response = await api.get(`/cultural-routes/routes/${routeId}/live-calendar`, {
      params: { limit },
    });
    return response.data;
  }, 6 * 60 * 60 * 1000);
