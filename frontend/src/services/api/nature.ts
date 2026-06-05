import api, { cachedGet } from './client';

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

export const getTrailPOIsNearby = async (lat: number, lng: number, radius_m: number = 2000): Promise<{ pois: any[]; total: number }> => {
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
