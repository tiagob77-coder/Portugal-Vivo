import api from './client';

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
