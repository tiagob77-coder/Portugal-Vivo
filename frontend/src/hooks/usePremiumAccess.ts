/**
 * usePremiumAccess — single round-trip premium-feature capability map.
 *
 * Backed by GET /api/premium/my-features which returns
 * `{ features: { ai_itinerary: true, audio_guides: false, ... } }`.
 *
 * Why a hook?
 *   - Drop-in replacement for boolean `isPremium` checks at premium
 *     touchpoints, but with per-feature granularity (so e.g. an "annual"
 *     tier can unlock features the "monthly" tier doesn't).
 *   - Single network call cached for the whole app session via TanStack
 *     Query (no per-feature requests).
 *   - Falls back to the existing AuthContext `isPremium` boolean while
 *     loading or when unauthenticated, so call sites never block.
 *
 * Usage:
 *   const { hasAccess, loading } = usePremiumAccess('ai_itinerary');
 *   if (!hasAccess) { router.push('/premium'); return; }
 */
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export type FeatureId =
  | 'ai_itinerary'
  | 'audio_guides'
  | 'offline'
  | 'epochs'
  | 'collections'
  | 'custom_routes'
  | 'export'
  | 'early_access';

interface MyFeaturesResponse {
  user_id: string;
  tier: string;
  tier_name?: string;
  features: Record<string, boolean>;
}

export function usePremiumAccess(featureId: FeatureId): {
  hasAccess: boolean;
  loading: boolean;
  tier: string;
  /** True when the user is authenticated but lacks this feature. */
  upgradeNeeded: boolean;
} {
  const { isAuthenticated, isPremium } = useAuth();

  const { data, isLoading } = useQuery<MyFeaturesResponse>({
    queryKey: ['premium-my-features'],
    queryFn: async () => {
      const res = await api.get('/premium/my-features');
      return res.data;
    },
    // Anonymous calls would 401 — only ask when logged in.
    enabled: isAuthenticated,
    // The capability map is stable for the duration of a subscription;
    // 5 min staleTime is plenty to avoid refetch storms after every
    // navigation.
    staleTime: 5 * 60_000,
  });

  if (!isAuthenticated) {
    return { hasAccess: false, loading: false, tier: 'free', upgradeNeeded: true };
  }

  if (isLoading || !data) {
    // Optimistic fallback: trust the AuthContext boolean while the bulk
    // call is in flight so paywalls don't flash.
    return {
      hasAccess: isPremium,
      loading: true,
      tier: isPremium ? 'premium' : 'free',
      upgradeNeeded: !isPremium,
    };
  }

  const granted = !!data.features[featureId];
  return {
    hasAccess: granted,
    loading: false,
    tier: data.tier,
    upgradeNeeded: !granted,
  };
}

/** Variant that returns the entire capability map in one go. */
export function usePremiumFeatures(): {
  features: Record<string, boolean>;
  loading: boolean;
  tier: string;
} {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useQuery<MyFeaturesResponse>({
    queryKey: ['premium-my-features'],
    queryFn: async () => {
      const res = await api.get('/premium/my-features');
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  return {
    features: data?.features ?? {},
    loading: isLoading,
    tier: data?.tier ?? 'free',
  };
}
