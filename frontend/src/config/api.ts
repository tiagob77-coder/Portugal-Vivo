/**
 * Centralized API configuration.
 * All modules should import API_URL from here instead of declaring their own.
 */

// Get the backend URL from environment variable with fallback
const getBackendUrl = (): string => {
  // Try environment variable first
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl;
  }
  
  // Fallback to the preview URL for Portugal Vivo
  return 'https://portugal-vivo-3.preview.emergentagent.com';
};

export const API_URL = getBackendUrl();
export const API_BASE = `${API_URL}/api`;

// Debug logging in development
if (__DEV__) {
  console.log('[API Config] EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
  console.log('[API Config] API_URL:', API_URL);
  console.log('[API Config] API_BASE:', API_BASE);
}
