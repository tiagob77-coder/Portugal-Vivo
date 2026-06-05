import api from './client';
import type { HeritageItem, User } from '../../types';

// User & Favorites
export const getFavorites = async (token: string): Promise<HeritageItem[]> => {
  const response = await api.get('/favorites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const addFavorite = async (itemId: string, token: string): Promise<void> => {
  await api.post(`/favorites/${itemId}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const removeFavorite = async (itemId: string, token: string): Promise<void> => {
  await api.delete(`/favorites/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Auth
export const exchangeSession = async (sessionId: string): Promise<User> => {
  const response = await api.post('/auth/session', {}, {
    headers: { 'X-Session-ID': sessionId },
  });
  return response.data;
};

export const getCurrentUser = async (token: string): Promise<User> => {
  const response = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

// User Preferences
export interface UserPreferences {
  user_id: string;
  traveler_profiles: Record<string, number>;
  favorite_themes: string[];
  favorite_regions: string[];
  preferred_pace: string;
  budget_level: string;
  has_car: boolean;
  preferred_transport: string[];
  typical_group_size: number;
  traveling_with_children: boolean;
  interests: string[];
  notifications_enabled: boolean;
  geofence_alerts: boolean;
  onboarding_completed: boolean;
}

export const getUserPreferences = async (token: string): Promise<UserPreferences> => {
  const response = await api.get('/preferences', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateUserPreferences = async (
  token: string,
  updates: Partial<UserPreferences>
): Promise<{ message: string; updated_fields: string[] }> => {
  const response = await api.put('/preferences', updates, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const completeOnboarding = async (
  token: string,
  travelerProfiles: Record<string, number>,
  favoriteRegions: string[],
  interests: string[]
): Promise<{ message: string; personalization_enabled: boolean }> => {
  const response = await api.post('/preferences/onboarding', 
    { traveler_profiles: travelerProfiles, favorite_regions: favoriteRegions, interests },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};
