import api from './client';

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
