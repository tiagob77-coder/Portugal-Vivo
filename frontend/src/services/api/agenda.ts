import api from './client';

// Calendar
export interface CalendarEvent {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  category: string;
  region: string;
  description: string;
}

export const getCalendarEvents = async (month?: number): Promise<CalendarEvent[]> => {
  const response = await api.get('/agenda/events', { params: { month, limit: 200 } });
  return (response.data?.events || []).map((e: any) => ({
    id: e.id, name: e.name, date_start: e.month ? `${String(e.month).padStart(2,'0')}-${String(e.day_start||1).padStart(2,'0')}` : '',
    date_end: e.month ? `${String(e.month).padStart(2,'0')}-${String(e.day_end||e.day_start||1).padStart(2,'0')}` : '',
    category: e.type || 'festas', region: e.region || '', description: e.description || '',
    source: e.source || 'curated', has_tickets: e.has_tickets || false, ticket_url: e.ticket_url,
  }));
};

export const getUpcomingEvents = async (limit?: number): Promise<CalendarEvent[]> => {
  const response = await api.get('/agenda/upcoming', { params: { limit } });
  const events = Array.isArray(response.data) ? response.data : response.data?.events || [];
  return events.map((e: any) => ({
    id: e.id, name: e.name, date_start: e.month ? `${String(e.month).padStart(2,'0')}-${String(e.day_start||1).padStart(2,'0')}` : '',
    date_end: e.month ? `${String(e.month).padStart(2,'0')}-${String(e.day_end||e.day_start||1).padStart(2,'0')}` : '',
    category: e.type || 'festas', region: e.region || '', description: e.description || '',
    source: e.source || 'curated', has_tickets: e.has_tickets || false, ticket_url: e.ticket_url,
  }));
};

export const getEventsByMonth = async (month: number): Promise<CalendarEvent[]> => {
  return getCalendarEvents(month);
};

// Agenda Viral API
export interface AgendaEvent {
  id: string;
  name: string;
  type: string;
  date_text: string;
  month: number;
  day_start?: number;
  day_end?: number;
  region: string;
  concelho?: string;
  description: string;
  rarity?: string;
  source?: string;
  price?: string;
  capacity?: string;
  genres?: string;
  has_tickets?: boolean;
  ticket_url?: string;
}

export const getAgendaEvents = async (params?: {
  type?: string;
  region?: string;
  month?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: AgendaEvent[]; total: number }> => {
  const response = await api.get('/agenda/events', { params });
  return response.data;
};

export const getAgendaEventDetail = async (eventId: string): Promise<AgendaEvent> => {
  const response = await api.get(`/agenda/event/${eventId}`);
  return response.data;
};

// Nearby transport for an event ("Como chegar") — needs geocoded coordinates.
// Named EventTransportStop to avoid clashing with mobility.ts' TransportStop
// (both are re-exported via the api barrel's `export *`).
export interface EventTransportStop {
  id: string;
  name: string;
  line?: string;
  lines?: string[];
  operator: string;
  transport_type: string;
  distance_km: number;
  distance_m: number;
}

export interface EventNearby {
  event_id: string;
  available: boolean;
  reason?: string;
  coordinates?: { lat: number; lng: number };
  geo_precision?: string;
  radius_km?: number;
  transport_stops: EventTransportStop[];
  operators: { name: string; transport_type?: string; website?: string; tip?: string }[];
  region?: string;
}

export const getAgendaEventNearby = async (eventId: string, radiusKm = 12): Promise<EventNearby> => {
  const response = await api.get(`/agenda/event/${eventId}/nearby`, { params: { radius_km: radiusKm } });
  return response.data;
};

export const getAgendaCalendar = async (): Promise<any> => {
  const response = await api.get('/agenda/calendar');
  return response.data;
};

export const getAgendaStats = async (): Promise<any> => {
  const response = await api.get('/agenda/stats');
  return response.data;
};

// Agenda — Live (DB + Viral Agenda RSS merged)
export const getAgendaLive = async (params?: {
  region?: string;
  type?: string;
  month?: number;
  limit?: number;
}): Promise<{ events: AgendaEvent[]; total: number; sources: { database: number; viralagenda: number } }> => {
  const response = await api.get('/agenda/live', { params });
  return response.data;
};

// Viral Agenda RSS — direto
export const getViralAgendaEvents = async (params?: {
  region?: string;
  type?: string;
  limit?: number;
}): Promise<{ events: AgendaEvent[]; total: number; source: string }> => {
  const response = await api.get('/agenda/viralagenda', { params });
  return response.data;
};

// Beaches — qualidade da água APA + Bandeira Azul
export const getBeaches = async (params?: {
  region?: string;
  bandeira_azul?: boolean;
  quality?: string;
  limit?: number;
  offset?: number;
}): Promise<{ beaches: any[]; total: number }> => {
  const response = await api.get('/beaches/', { params });
  return response.data;
};

export const getBeachBandeiraAzul = async (): Promise<{
  total: number;
  year: number;
  by_region: Record<string, { id: string; name: string; concelho: string }[]>;
}> => {
  const response = await api.get('/beaches/bandeira-azul');
  return response.data;
};

export const getBeachDetail = async (beachId: string): Promise<any> => {
  const response = await api.get(`/beaches/${beachId}`);
  return response.data;
};

export const getBeachTides = async (beachId: string): Promise<any> => {
  const response = await api.get(`/beaches/${beachId}/tides`);
  return response.data;
};
