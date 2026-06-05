/**
 * Centralized API configuration.
 * All modules should import API_URL / PUBLIC_URL / AUTH_URL from here
 * instead of declaring their own.
 */
import logger from '../utils/logger';

const DEFAULT_PUBLIC_URL = 'https://portugal-vivo.app';

const getBackendUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('EXPO_PUBLIC_BACKEND_URL must be set in production builds');
  }
  return 'http://localhost:8001';
};

export const API_URL = getBackendUrl();
export const API_BASE = `${API_URL}/api`;

/**
 * Canonical public URL used for share links (OG, WhatsApp, social).
 * Always read from this constant — never hardcode preview / staging hosts
 * into share strings.
 */
export const PUBLIC_URL = (() => {
  const envUrl = process.env.EXPO_PUBLIC_PUBLIC_URL;
  if (envUrl && envUrl.trim() !== '') return envUrl.trim().replace(/\/+$/, '');
  return DEFAULT_PUBLIC_URL;
})();

/**
 * OAuth entry point. Defaults to `${API_URL}/auth/login` (the backend
 * FastAPI handler). Override with EXPO_PUBLIC_AUTH_URL only when pointing
 * at a third-party identity provider.
 */
export const AUTH_URL = (() => {
  const envUrl = process.env.EXPO_PUBLIC_AUTH_URL;
  if (envUrl && envUrl.trim() !== '') return envUrl.trim().replace(/\/+$/, '');
  return `${API_URL}/auth/login`;
})();

if (__DEV__) {
  logger.debug('[API Config] EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
  logger.debug('[API Config] API_URL:', API_URL);
  logger.debug('[API Config] API_BASE:', API_BASE);
  logger.debug('[API Config] PUBLIC_URL:', PUBLIC_URL);
  logger.debug('[API Config] AUTH_URL:', AUTH_URL);
}
