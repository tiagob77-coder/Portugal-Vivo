/**
 * Offline Cache Service
 * Manages local storage of POIs, routes, and user data for offline access
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { HeritageItem } from '../types';

// Lazy import to avoid circular dependency (api.ts imports offlineCache)
const getApiFunctions = () => require('./api'); // eslint-disable-line @typescript-eslint/no-require-imports

// Cache keys
const CACHE_KEYS = {
  NEARBY_POIS: 'cache_nearby_pois',
  FAVORITE_POIS: 'cache_favorite_pois',
  RECENT_ROUTES: 'cache_recent_routes',
  CATEGORIES: 'cache_categories',
  USER_LOCATION: 'cache_user_location',
  OFFLINE_QUEUE: 'cache_offline_queue',
  LAST_SYNC: 'cache_last_sync',
  VISITED_POIS: 'cache_visited_pois',
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRY = {
  NEARBY_POIS: 24 * 60 * 60 * 1000, // 24 hours
  CATEGORIES: 7 * 24 * 60 * 60 * 1000, // 7 days
  ROUTES: 24 * 60 * 60 * 1000, // 24 hours
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface OfflineAction {
  id: string;
  type: 'visit' | 'favorite' | 'unfavorite' | 'contribution' | 'review';
  payload: any;
  timestamp: number;
  retryCount?: number;
}

const MAX_RETRIES = 5;

class OfflineCacheService {
  private isOnline: boolean = true;
  private unsubscribeNetInfo: (() => void) | null = null;

  constructor() {
    this.initNetworkListener();
  }

  /**
   * Initialize network state listener
   */
  private initNetworkListener() {
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      // Auto-sync when coming back online
      if (wasOffline && this.isOnline) {
        this.syncOfflineActions().catch((err) =>
          console.warn('[OfflineCache] Auto-sync failed:', err)
        );
      }
    });
  }

  /**
   * Check if device is online
   */
  async checkOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
    return this.isOnline;
  }

  /**
   * Save data to cache with expiry
   */
  async setCache<T>(key: string, data: T, expiryMs: number = CACHE_EXPIRY.NEARBY_POIS): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiry: expiryMs,
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Get data from cache (returns null if expired)
   */
  async getCache<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      const now = Date.now();
      
      // Check if expired
      if (now - entry.timestamp > entry.expiry) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Cache nearby POIs for offline access
   */
  async cacheNearbyPOIs(latitude: number, longitude: number, pois: HeritageItem[]): Promise<void> {
    const key = `${CACHE_KEYS.NEARBY_POIS}_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
    await this.setCache(key, {
      location: { latitude, longitude },
      pois,
      count: pois.length,
    }, CACHE_EXPIRY.NEARBY_POIS);
    
    // Also save user location
    await this.setCache(CACHE_KEYS.USER_LOCATION, { latitude, longitude }, CACHE_EXPIRY.NEARBY_POIS);
  }

  /**
   * Get cached nearby POIs
   */
  async getCachedNearbyPOIs(latitude: number, longitude: number, radiusKm: number = 5): Promise<HeritageItem[] | null> {
    // Try exact location first
    const exactKey = `${CACHE_KEYS.NEARBY_POIS}_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
    const exact = await this.getCache<{ pois: HeritageItem[] }>(exactKey);
    if (exact) return exact.pois;

    // Try to find nearby cached data
    const allKeys = await AsyncStorage.getAllKeys();
    const nearbyKeys = allKeys.filter(k => k.startsWith(CACHE_KEYS.NEARBY_POIS));
    
    for (const key of nearbyKeys) {
      const cached = await this.getCache<{ location: { latitude: number; longitude: number }; pois: HeritageItem[] }>(key);
      if (cached) {
        // Check if cached location is within radius
        const distance = this.calculateDistance(
          latitude, longitude,
          cached.location.latitude, cached.location.longitude
        );
        if (distance <= radiusKm) {
          return cached.pois;
        }
      }
    }

    return null;
  }

  /**
   * Cache categories
   */
  async cacheCategories(categories: any[]): Promise<void> {
    await this.setCache(CACHE_KEYS.CATEGORIES, categories, CACHE_EXPIRY.CATEGORIES);
  }

  /**
   * Get cached categories
   */
  async getCachedCategories(): Promise<any[] | null> {
    return this.getCache(CACHE_KEYS.CATEGORIES);
  }

  /**
   * Cache a planned route
   */
  async cacheRoute(routeId: string, routeData: any): Promise<void> {
    const existingRoutes = await this.getCache<any[]>(CACHE_KEYS.RECENT_ROUTES) || [];
    
    // Keep only last 10 routes
    const updatedRoutes = [
      { id: routeId, data: routeData, timestamp: Date.now() },
      ...existingRoutes.filter(r => r.id !== routeId)
    ].slice(0, 10);
    
    await this.setCache(CACHE_KEYS.RECENT_ROUTES, updatedRoutes, CACHE_EXPIRY.ROUTES);
  }

  /**
   * Get cached routes
   */
  async getCachedRoutes(): Promise<any[]> {
    return await this.getCache(CACHE_KEYS.RECENT_ROUTES) || [];
  }

  /**
   * Add favorite POI for offline access
   */
  async addFavoritePOI(poi: HeritageItem): Promise<void> {
    const favorites = await this.getCache<HeritageItem[]>(CACHE_KEYS.FAVORITE_POIS) || [];
    
    if (!favorites.find(f => f.id === poi.id)) {
      favorites.push(poi);
      await this.setCache(CACHE_KEYS.FAVORITE_POIS, favorites, CACHE_EXPIRY.NEARBY_POIS * 30); // 30 days
    }
  }

  /**
   * Remove favorite POI
   */
  async removeFavoritePOI(poiId: string): Promise<void> {
    const favorites = await this.getCache<HeritageItem[]>(CACHE_KEYS.FAVORITE_POIS) || [];
    const updated = favorites.filter(f => f.id !== poiId);
    await this.setCache(CACHE_KEYS.FAVORITE_POIS, updated, CACHE_EXPIRY.NEARBY_POIS * 30);
  }

  /**
   * Get cached favorite POIs
   */
  async getCachedFavorites(): Promise<HeritageItem[]> {
    return await this.getCache(CACHE_KEYS.FAVORITE_POIS) || [];
  }

  /**
   * Mark POI as visited
   */
  async markPOIVisited(poiId: string): Promise<void> {
    const visited = await this.getCache<{ [key: string]: number }>(CACHE_KEYS.VISITED_POIS) || {};
    visited[poiId] = Date.now();
    await this.setCache(CACHE_KEYS.VISITED_POIS, visited, CACHE_EXPIRY.NEARBY_POIS * 365); // 1 year
  }

  /**
   * Check if POI was visited
   */
  async isPOIVisited(poiId: string): Promise<boolean> {
    const visited = await this.getCache<{ [key: string]: number }>(CACHE_KEYS.VISITED_POIS) || {};
    return !!visited[poiId];
  }

  /**
   * Get all visited POIs
   */
  async getVisitedPOIs(): Promise<string[]> {
    const visited = await this.getCache<{ [key: string]: number }>(CACHE_KEYS.VISITED_POIS) || {};
    return Object.keys(visited);
  }

  /**
   * Queue an action for when device comes back online
   */
  async queueOfflineAction(type: OfflineAction['type'], payload: any): Promise<void> {
    const queue = await this.getCache<OfflineAction[]>(CACHE_KEYS.OFFLINE_QUEUE) || [];
    
    queue.push({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
    });
    
    await this.setCache(CACHE_KEYS.OFFLINE_QUEUE, queue, CACHE_EXPIRY.NEARBY_POIS * 7); // 7 days
  }

  /**
   * Sync offline actions when back online
   */
  async syncOfflineActions(): Promise<{ success: number; failed: number }> {
    const queue = await this.getCache<OfflineAction[]>(CACHE_KEYS.OFFLINE_QUEUE) || [];
    
    if (queue.length === 0) {
      return { success: 0, failed: 0 };
    }

    const token = await AsyncStorage.getItem('session_token');
    if (!token) {
      console.warn('Offline sync skipped: no session token');
      return { success: 0, failed: queue.length };
    }

    let success = 0;
    let failed = 0;
    const remainingActions: OfflineAction[] = [];

    for (const action of queue) {
      try {
        switch (action.type) {
          case 'visit': {
            const { recordDashboardVisit } = getApiFunctions();
            await recordDashboardVisit(action.payload.poiId, token);
            break;
          }
          case 'favorite': {
            const { addFavorite } = getApiFunctions();
            await addFavorite(action.payload.itemId, token);
            break;
          }
          case 'unfavorite': {
            const { removeFavorite } = getApiFunctions();
            await removeFavorite(action.payload.itemId, token);
            break;
          }
          case 'contribution': {
            const { createContribution } = getApiFunctions();
            await createContribution(action.payload.contribution, token);
            break;
          }
          case 'review': {
            const { submitReview } = getApiFunctions();
            await submitReview(action.payload.itemId, action.payload.review, token);
            break;
          }
        }
        success++;
      } catch (_error) {
        const retryCount = (action.retryCount || 0) + 1;
        if (retryCount < MAX_RETRIES) {
          remainingActions.push({ ...action, retryCount });
        }
        failed++;
      }
    }

    // Save remaining failed actions for next retry
    await this.setCache(CACHE_KEYS.OFFLINE_QUEUE, remainingActions, CACHE_EXPIRY.NEARBY_POIS * 7);
    
    // Update last sync time
    await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());

    return { success, failed };
  }

  /**
   * Get count of pending offline actions
   */
  async getPendingActionCount(): Promise<number> {
    const queue = await this.getCache<OfflineAction[]>(CACHE_KEYS.OFFLINE_QUEUE) || [];
    return queue.length;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    nearbyPOIs: number;
    favorites: number;
    routes: number;
    offlineQueue: number;
    lastSync: Date | null;
  }> {
    const allKeys = await AsyncStorage.getAllKeys();
    const nearbyKeys = allKeys.filter(k => k.startsWith(CACHE_KEYS.NEARBY_POIS));
    const favorites = await this.getCachedFavorites();
    const routes = await this.getCachedRoutes();
    const queue = await this.getCache<OfflineAction[]>(CACHE_KEYS.OFFLINE_QUEUE) || [];
    const lastSyncRaw = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);

    // Calculate approximate size
    let totalSize = 0;
    for (const key of allKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }

    return {
      totalSize,
      nearbyPOIs: nearbyKeys.length,
      favorites: favorites.length,
      routes: routes.length,
      offlineQueue: queue.length,
      lastSync: lastSyncRaw ? new Date(parseInt(lastSyncRaw)) : null,
    };
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith('cache_'));
    await AsyncStorage.multiRemove(cacheKeys);
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }
}

// Export singleton instance
export const offlineCache = new OfflineCacheService();
export default offlineCache;
