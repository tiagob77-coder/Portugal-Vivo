/**
 * Centralized API configuration.
 * All modules should import API_URL from here instead of declaring their own.
 */
import logger from '../utils/logger';

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

if (__DEV__) {
  logger.debug('[API Config] EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
  logger.debug('[API Config] API_URL:', API_URL);
  logger.debug('[API Config] API_BASE:', API_BASE);
}
