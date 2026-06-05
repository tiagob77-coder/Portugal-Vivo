/**
 * Shared axios client + cache helper for all API domain modules.
 *
 * Domain modules (heritage.ts, routes.ts, …) import the default `api`
 * instance and the `cachedGet` helper from here. The barrel (index.ts)
 * re-exports `api` as the default so existing
 * `import api from '../services/api'` callsites keep working.
 */
import axios from 'axios';
import offlineCache from '../offlineCache';
import { API_BASE } from '../../config/api';
import { secureStorage } from '../../utils/secureStorage';
import logger from '../../utils/logger';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // 10s timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach Authorization header on every request (unless one is already set).
// Without this, authenticated endpoints would 401 unless each callsite passed
// the Bearer token manually — easy to forget (e.g. the GPX upload in mapa.tsx).
//
// SEC-005: reads from `secureStorage` (expo-secure-store on native, falls
// back to AsyncStorage on web where SecureStore isn't available). The
// previous version went straight to AsyncStorage which (a) didn't honour
// the encrypted-keychain promise of secureStorage.ts, and (b) was *broken*
// on native — AuthContext writes via secureStorage, so the interceptor was
// reading an empty AsyncStorage key and shipping every request without
// the Bearer header.
api.interceptors.request.use(async (config) => {
  const headers = config.headers as any;
  if (!headers?.Authorization && !headers?.authorization) {
    try {
      const token = await secureStorage.getItem('session_token');
      if (token && headers) headers.Authorization = `Bearer ${token}`;
    } catch {
      // Storage read failure — send the request unauthenticated and let
      // the server decide. Public endpoints will still work.
    }
  }
  return config;
});

// Debug interceptor for mobile testing
if (__DEV__) {
  api.interceptors.request.use(
    (config) => {
      logger.debug(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      return config;
    },
    (error) => {
      logger.error('[API Request Error]', error);
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => {
      logger.debug(`[API Response] ${response.status} ${response.config.url} - ${JSON.stringify(response.data).slice(0, 100)}...`);
      return response;
    },
    (error) => {
      logger.error(`[API Response Error] ${error.config?.url}:`, error.message);
      return Promise.reject(error);
    }
  );
}

// Cache-first fallback: try API, if fails try local cache
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
export async function cachedGet<T>(cacheKey: string, fetcher: () => Promise<T>, ttl = CACHE_TTL): Promise<T> {
  try {
    const data = await fetcher();
    // Save to cache on success
    offlineCache.setCache(cacheKey, data, ttl).catch(() => {});
    return data;
  } catch (err) {
    // Try cache fallback
    const cached = await offlineCache.getCache<T>(cacheKey);
    if (cached !== null) return cached;
    throw err;
  }
}

export default api;
