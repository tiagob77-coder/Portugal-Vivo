import api from './client';

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
