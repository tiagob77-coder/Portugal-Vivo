/**
 * SmartContext — Orchestrator client for intelligent module activation.
 *
 * Sends user context (location, time, profile, tab) to the backend orchestrator
 * and provides smart actions, active modules, and preloaded data to the entire app.
 *
 * Usage:
 *   const { actions, activeModules, smartDiscover } = useSmartContext();
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '../config/api';
import { useAuth } from './AuthContext';
import { getUserPreferences } from '../services/api';
import { eventBus } from '../services/eventBus';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmartAction {
  type: 'navigate' | 'notify' | 'preload' | 'highlight' | 'suggest';
  priority: number;
  title: string;
  subtitle?: string;
  icon?: string;
  route?: string;
  data?: Record<string, any>;
  module: string;
}

interface OrchestratorResponse {
  active_modules: string[];
  actions: SmartAction[];
  preloaded: Record<string, any>;
  context_label: string;
}

interface SmartDiscoverItem {
  id: string;
  name: string;
  module: string;
  icon: string;
  route: string;
  category: string;
  distance_km: number;
  iq_score: number;
  relevance: number;
  image_url: string;
  description: string;
  region: string;
  lat: number;
  lng: number;
}

interface SmartDiscoverResponse {
  results: SmartDiscoverItem[];
  total: number;
  radius_km: number;
  modules_found: Record<string, number>;
  context_label: string;
}

interface SmartContextValue {
  actions: SmartAction[];
  activeModules: string[];
  preloaded: Record<string, any>;
  contextLabel: string;
  isLoading: boolean;
  refreshContext: () => void;
  smartDiscover: (lat: number, lng: number, radiusKm?: number, limit?: number) => Promise<SmartDiscoverResponse>;
  updateLocation: (lat: number, lng: number) => void;
  updateTab: (tab: string) => void;
}

const SmartContextCtx = createContext<SmartContextValue>({
  actions: [],
  activeModules: [],
  preloaded: {},
  contextLabel: '',
  isLoading: false,
  refreshContext: () => {},
  smartDiscover: async () => ({ results: [], total: 0, radius_km: 5, modules_found: {}, context_label: '' }),
  updateLocation: () => {},
  updateTab: () => {},
});

export const useSmartContext = () => useContext(SmartContextCtx);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SmartContextProvider({ children }: { children: React.ReactNode }) {
  const { user, sessionToken, isPremium } = useAuth();
  const queryClient = useQueryClient();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('descobrir');
  const locationRef = useRef(location);
  locationRef.current = location;

  // Load user preferences (only when authenticated). Cached 10min.
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences', sessionToken],
    queryFn: () => (sessionToken ? getUserPreferences(sessionToken) : Promise.resolve(null)),
    enabled: !!sessionToken,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  // Pick the highest-weighted traveler profile from preferences.
  // traveler_profiles is Record<string, number> — e.g. { aventureiro: 0.8, gastronomo: 0.4 }
  const travelerProfile: string | null = (() => {
    const profiles = preferences?.traveler_profiles;
    if (!profiles || Object.keys(profiles).length === 0) return null;
    const entries = Object.entries(profiles) as Array<[string, number]>;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  })();

  // Build context payload
  const buildContext = useCallback(() => {
    const now = new Date();
    return {
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      user_id: user?.user_id ?? null,
      hour: now.getHours(),
      day_of_week: (now.getDay() + 6) % 7, // JS Sunday=0 → Python Monday=0
      month: now.getMonth() + 1,
      is_premium: isPremium ?? false,
      traveler_profile: travelerProfile, // From user preferences (highest-weighted)
      active_tab: activeTab,
      last_categories_viewed: preferences?.interests?.slice(0, 5) ?? [],
      connectivity: 'online',
    };
  }, [location, user, isPremium, activeTab, travelerProfile, preferences]);

  // Query orchestrator
  const { data, isLoading, refetch } = useQuery<OrchestratorResponse>({
    queryKey: ['smart-context', location?.lat, location?.lng, activeTab, user?.user_id],
    queryFn: async () => {
      const ctx = buildContext();
      const resp = await fetch(`${API_BASE}/orchestrator/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(ctx),
      });
      if (!resp.ok) throw new Error('Orchestrator failed');
      return resp.json();
    },
    staleTime: 60_000, // Refresh every 60s
    refetchInterval: 120_000, // Auto-refresh every 2min
    retry: 1,
    enabled: !!API_BASE, // Only if backend URL configured
  });

  // Smart discover function
  const smartDiscover = useCallback(
    async (lat: number, lng: number, radiusKm = 5, limit = 20): Promise<SmartDiscoverResponse> => {
      const ctx = buildContext();
      ctx.lat = lat;
      ctx.lng = lng;
      const resp = await fetch(
        `${API_BASE}/orchestrator/smart-discover?radius_km=${radiusKm}&limit=${limit}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify(ctx),
        },
      );
      if (!resp.ok) throw new Error('Smart discover failed');
      return resp.json();
    },
    [buildContext, sessionToken],
  );

  const updateLocation = useCallback((lat: number, lng: number) => {
    setLocation({ lat, lng });
    eventBus.emit('location.changed', { lat, lng });
  }, []);

  const updateTab = useCallback((tab: string) => {
    setActiveTab(tab);
    eventBus.emit('tab.changed', { tab });
  }, []);

  // Event-driven invalidation — replaces blind 2min polling.
  // The orchestrator refetches immediately when meaningful events occur.
  useEffect(() => {
    const offs = [
      eventBus.on('context.invalidate', () => refetch()),
      eventBus.on('preferences.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
        refetch();
      }),
      eventBus.on('user.login', () => {
        queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
        refetch();
      }),
      eventBus.on('user.logout', () => {
        queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
        refetch();
      }),
      eventBus.on('visit.recorded', () => refetch()),
      eventBus.on('favorite.toggled', () => refetch()),
      eventBus.on('route.completed', () => refetch()),
    ];
    return () => offs.forEach((off) => off());
  }, [refetch, queryClient]);

  return (
    <SmartContextCtx.Provider
      value={{
        actions: data?.actions ?? [],
        activeModules: data?.active_modules ?? [],
        preloaded: data?.preloaded ?? {},
        contextLabel: data?.context_label ?? '',
        isLoading,
        refreshContext: refetch,
        smartDiscover,
        updateLocation,
        updateTab,
      }}
    >
      {children}
    </SmartContextCtx.Provider>
  );
}
