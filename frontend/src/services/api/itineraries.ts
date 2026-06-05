import api from './client';

// ========================
// SAVED ITINERARIES
// ========================

export interface SavedItinerary {
  id: string;
  title: string;
  description?: string;
  locality?: string;
  region?: string;
  days: number;
  profile?: string;
  pace?: string;
  interests?: string[];
  is_public: boolean;
  share_token?: string;
  collaborators_count: number;
  total_pois: number;
  total_visit_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface SavedItineraryDetail extends SavedItinerary {
  itinerary_data: any; // SmartItineraryResponse
  collaborators: { user_id: string; user_name: string; role: string; joined_at: string }[];
  votes: { poi_id: string; vote: 'up' | 'down'; user_id: string }[];
  budget_summary?: { total_eur: number; by_day: { day: number; eur: number }[] };
}

export interface ItineraryComment {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  day?: number;
  poi_id?: string;
  created_at: string;
}

export interface ItineraryAttachment {
  id: string;
  type: 'booking' | 'ticket' | 'note' | 'link';
  label: string;
  url?: string;
  notes?: string;
  amount_eur?: number;
  day?: number;
  poi_id?: string;
  created_at: string;
}

export const saveItinerary = async (data: {
  title: string;
  description?: string;
  itinerary_data: any;
  locality?: string;
  region?: string;
  days: number;
  profile?: string;
  pace?: string;
  interests?: string[];
  is_public?: boolean;
}): Promise<{ id: string; message: string }> => {
  const response = await api.post('/itineraries', data);
  return response.data;
};

export const listItineraries = async (): Promise<{ items: SavedItinerary[]; total: number }> => {
  const response = await api.get('/itineraries');
  return response.data;
};

export const getItinerary = async (id: string): Promise<SavedItineraryDetail> => {
  const response = await api.get(`/itineraries/${id}`);
  return response.data;
};

export const getSharedItinerary = async (token: string): Promise<SavedItineraryDetail> => {
  const response = await api.get(`/itineraries/shared/${token}`);
  return response.data;
};

export const updateItinerary = async (id: string, data: { title?: string; description?: string; is_public?: boolean }): Promise<void> => {
  await api.patch(`/itineraries/${id}`, data);
};

export const deleteItinerary = async (id: string): Promise<void> => {
  await api.delete(`/itineraries/${id}`);
};

export const shareItinerary = async (id: string, role: 'viewer' | 'editor' | 'voter' = 'viewer'): Promise<{ token: string; share_url: string }> => {
  const response = await api.post(`/itineraries/${id}/share`, { role });
  return response.data;
};

export const getItineraryComments = async (id: string, day?: number): Promise<{ comments: ItineraryComment[] }> => {
  const response = await api.get(`/itineraries/${id}/comments`, { params: day !== undefined ? { day } : {} });
  return response.data;
};

export const addItineraryComment = async (id: string, text: string, day?: number, poi_id?: string): Promise<ItineraryComment> => {
  const response = await api.post(`/itineraries/${id}/comment`, { text, day, poi_id });
  return response.data;
};

export const getItineraryBudget = async (id: string): Promise<{ total_eur: number; by_day: { day: number; eur: number }[]; attachments_total: number }> => {
  const response = await api.get(`/itineraries/${id}/budget`);
  return response.data;
};

export const addItineraryAttachment = async (id: string, data: {
  type: 'booking' | 'ticket' | 'note' | 'link';
  label: string;
  url?: string;
  notes?: string;
  amount_eur?: number;
  day?: number;
  poi_id?: string;
}): Promise<ItineraryAttachment> => {
  const response = await api.post(`/itineraries/${id}/attachment`, data);
  return response.data;
};

export const voteItineraryPoi = async (id: string, poi_id: string, vote: 'up' | 'down'): Promise<void> => {
  await api.post(`/itineraries/${id}/vote/${poi_id}`, { vote });
};
