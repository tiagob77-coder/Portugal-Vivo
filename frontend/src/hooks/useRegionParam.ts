/**
 * Reads the optional `?region=` deep-link param (used when navigating from an
 * event to a thematic module) and exposes a clear() to remove it.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';

export function useRegionParam(): { regionId: string | null; clear: () => void } {
  const params = useLocalSearchParams<{ region?: string }>();
  const router = useRouter();
  const raw = params.region ? String(params.region) : '';
  const regionId = raw && raw !== 'all' ? raw : null;
  return {
    regionId,
    clear: () => router.setParams({ region: '' }),
  };
}
