/**
 * Centralized API configuration.
 * All modules should import API_URL from here instead of declaring their own.
 */
export const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export const API_BASE = `${API_URL}/api`;
