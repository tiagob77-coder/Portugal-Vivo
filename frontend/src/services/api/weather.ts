import api from './client';

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
