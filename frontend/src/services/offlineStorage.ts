/**
 * Offline Storage Service
 * Manages downloading, storing, and retrieving complete region packages
 * for offline use in Portugal Vivo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { HeritageItem, Route } from '../types';
import { API_BASE } from '../config/api';

// Storage key prefixes
const STORAGE_KEYS = {
  REGION_DATA: 'offline_region_',
  REGION_META: 'offline_meta_',
  REGION_LIST: 'offline_regions_list',
  MANIFEST_CACHE: 'offline_manifest_cache',
};

export interface OfflineRegionMeta {
  regionId: string;
  regionName: string;
  versionHash: string;
  downloadedAt: string;
  poiCount: number;
  routesCount: number;
  eventsCount: number;
  sizeBytes: number;
}

export interface OfflineRegionPackage {
  region: string;
  region_name: string;
  version_hash: string;
  downloaded_at: string;
  heritage_items: HeritageItem[];
  routes: Route[];
  events: any[];
  categories: any[];
  counts: {
    heritage_items: number;
    routes: number;
    events: number;
    categories: number;
  };
}

export interface RegionInfo {
  id: string;
  name: string;
  poi_count: number;
  routes_count: number;
  events_count: number;
  estimated_size_mb: number;
  last_updated: string | null;
}

export interface UpdateCheckResult {
  regionId: string;
  regionName: string;
  hasUpdate: boolean;
  localVersion: string | null;
  remoteVersion: string;
}

class OfflineStorageService {
  /**
   * Download a region package from the server and store locally.
   */
  async downloadRegion(
    regionId: string,
    onProgress?: (progress: number) => void
  ): Promise<OfflineRegionMeta> {
    onProgress?.(0.05);

    // Fetch the region package
    const response = await axios.get<OfflineRegionPackage>(
      `${API_BASE}/offline/package/${regionId}`
    );
    const pkg = response.data;

    onProgress?.(0.5);

    // Serialize and store the package data
    const serialized = JSON.stringify(pkg);
    const sizeBytes = new Blob([serialized]).size;

    await AsyncStorage.setItem(
      `${STORAGE_KEYS.REGION_DATA}${regionId}`,
      serialized
    );

    onProgress?.(0.8);

    // Store metadata separately for quick access
    const meta: OfflineRegionMeta = {
      regionId,
      regionName: pkg.region_name,
      versionHash: pkg.version_hash,
      downloadedAt: pkg.downloaded_at,
      poiCount: pkg.counts.heritage_items,
      routesCount: pkg.counts.routes,
      eventsCount: pkg.counts.events,
      sizeBytes,
    };

    await AsyncStorage.setItem(
      `${STORAGE_KEYS.REGION_META}${regionId}`,
      JSON.stringify(meta)
    );

    // Update the list of downloaded regions
    const regionList = await this.getDownloadedRegionIds();
    if (!regionList.includes(regionId)) {
      regionList.push(regionId);
      await AsyncStorage.setItem(
        STORAGE_KEYS.REGION_LIST,
        JSON.stringify(regionList)
      );
    }

    onProgress?.(1.0);
    return meta;
  }

  /**
   * Get the list of downloaded region IDs.
   */
  private async getDownloadedRegionIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.REGION_LIST);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * List all downloaded regions with their metadata.
   */
  async getOfflineRegions(): Promise<OfflineRegionMeta[]> {
    const regionIds = await this.getDownloadedRegionIds();
    const regions: OfflineRegionMeta[] = [];

    for (const id of regionIds) {
      try {
        const raw = await AsyncStorage.getItem(
          `${STORAGE_KEYS.REGION_META}${id}`
        );
        if (raw) {
          regions.push(JSON.parse(raw));
        }
      } catch {
        // Skip corrupted entries
      }
    }

    return regions;
  }

  /**
   * Get POIs from offline storage.
   * If regionId is provided, returns POIs for that region only.
   * Otherwise returns POIs from all downloaded regions.
   */
  async getOfflinePOIs(regionId?: string): Promise<HeritageItem[]> {
    const regionIds = regionId
      ? [regionId]
      : await this.getDownloadedRegionIds();

    const allPois: HeritageItem[] = [];

    for (const id of regionIds) {
      const pkg = await this.getRegionPackage(id);
      if (pkg) {
        allPois.push(...pkg.heritage_items);
      }
    }

    return allPois;
  }

  /**
   * Get routes from offline storage.
   * If regionId is provided, returns routes for that region only.
   * Otherwise returns routes from all downloaded regions.
   */
  async getOfflineRoutes(regionId?: string): Promise<Route[]> {
    const regionIds = regionId
      ? [regionId]
      : await this.getDownloadedRegionIds();

    const allRoutes: Route[] = [];

    for (const id of regionIds) {
      const pkg = await this.getRegionPackage(id);
      if (pkg) {
        allRoutes.push(...pkg.routes);
      }
    }

    return allRoutes;
  }

  /**
   * Get the raw region package from storage.
   */
  private async getRegionPackage(
    regionId: string
  ): Promise<OfflineRegionPackage | null> {
    try {
      const raw = await AsyncStorage.getItem(
        `${STORAGE_KEYS.REGION_DATA}${regionId}`
      );
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check for updates by comparing local version hashes with the server manifest.
   * Returns a list of regions with update status.
   */
  async checkForUpdates(): Promise<UpdateCheckResult[]> {
    const response = await axios.get(
      `${API_BASE}/offline/package/all/manifest`
    );
    const manifest = response.data.manifest as {
      region: string;
      region_name: string;
      version_hash: string;
    }[];

    // Cache manifest for reference
    await AsyncStorage.setItem(
      STORAGE_KEYS.MANIFEST_CACHE,
      JSON.stringify(manifest)
    );

    const downloadedRegions = await this.getOfflineRegions();
    const localVersionMap = new Map<string, string>();
    for (const r of downloadedRegions) {
      localVersionMap.set(r.regionId, r.versionHash);
    }

    const results: UpdateCheckResult[] = [];
    for (const entry of manifest) {
      const localVersion = localVersionMap.get(entry.region) ?? null;
      // Only report regions that are downloaded locally
      if (localVersion !== null) {
        results.push({
          regionId: entry.region,
          regionName: entry.region_name,
          hasUpdate: localVersion !== entry.version_hash,
          localVersion,
          remoteVersion: entry.version_hash,
        });
      }
    }

    return results;
  }

  /**
   * Delete a downloaded region and free storage.
   */
  async deleteRegion(regionId: string): Promise<void> {
    await AsyncStorage.removeItem(`${STORAGE_KEYS.REGION_DATA}${regionId}`);
    await AsyncStorage.removeItem(`${STORAGE_KEYS.REGION_META}${regionId}`);

    const regionList = await this.getDownloadedRegionIds();
    const updated = regionList.filter((id) => id !== regionId);
    await AsyncStorage.setItem(
      STORAGE_KEYS.REGION_LIST,
      JSON.stringify(updated)
    );
  }

  /**
   * Calculate total storage used by offline data.
   * Returns size in bytes.
   */
  async getStorageUsage(): Promise<number> {
    const regions = await this.getOfflineRegions();
    return regions.reduce((total, r) => total + r.sizeBytes, 0);
  }

  /**
   * Check if the device is currently offline.
   */
  async isOffline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !(state.isConnected ?? true);
  }
}

export const offlineStorage = new OfflineStorageService();
export default offlineStorage;
