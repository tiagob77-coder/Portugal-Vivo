/**
 * Offline Storage Service
 * Manages downloading, storing, and retrieving complete region packages
 * for offline use in Portugal Vivo.
 *
 * Onde vivem os pacotes:
 *   • Nativo — um ficheiro JSON por região em `Paths.document/offline-packages/`.
 *     Não no AsyncStorage: no Android tem um teto de ~6 MB no total e não lê
 *     entradas acima de ~2 MB ("Row too big to fit into CursorWindow"), e um
 *     pacote de região passa isso com facilidade.
 *   • Web — AsyncStorage (localStorage), como antes.
 * Os metadados (nome, versão, contagens) continuam no AsyncStorage: são
 * pequenos e o ecrã de gestão lê-os sem abrir os pacotes.
 *
 * Depois da primeira leitura, os pacotes ficam em memória — as consultas
 * offline (offlinePackQueries) correm várias vezes por ecrã.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import axios from 'axios';
import { Category, HeritageItem, Route } from '../types';
import { API_BASE } from '../config/api';
import logger from '../utils/logger';
import type { QueryablePackage } from './offlinePackQueries';

// Storage key prefixes
const STORAGE_KEYS = {
  REGION_DATA: 'offline_region_',
  REGION_META: 'offline_meta_',
  REGION_LIST: 'offline_regions_list',
  MANIFEST_CACHE: 'offline_manifest_cache',
};

const PACKAGE_DIR = 'offline-packages';

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

export interface OfflineRegionPackage extends QueryablePackage {
  region: string;
  region_name: string;
  version_hash: string;
  downloaded_at: string;
  heritage_items: HeritageItem[];
  routes: Route[];
  events: Record<string, unknown>[];
  categories: Category[];
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

// ─── Onde ficam os bytes ─────────────────────────────────────────────────────

interface PackageStore {
  /** Grava e devolve o tamanho em bytes. */
  write(regionId: string, serialized: string): Promise<number>;
  read(regionId: string): Promise<string | null>;
  remove(regionId: string): Promise<void>;
}

type FileSystemModule = typeof import('expo-file-system');

/** Carregado só no nativo: no web os pacotes ficam no AsyncStorage. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadFileSystem = (): FileSystemModule => require('expo-file-system');

const fileStore: PackageStore = {
  async write(regionId, serialized) {
    const { Directory, File, Paths } = loadFileSystem();
    const dir = new Directory(Paths.document, PACKAGE_DIR);
    dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, `${regionId}.json`);
    file.create({ overwrite: true });
    file.write(serialized);
    return file.size;
  },
  async read(regionId) {
    const { File, Paths } = loadFileSystem();
    const file = new File(Paths.document, PACKAGE_DIR, `${regionId}.json`);
    if (file.exists) return file.text();
    // Pacotes descarregados antes desta versão ficaram no AsyncStorage
    return AsyncStorage.getItem(`${STORAGE_KEYS.REGION_DATA}${regionId}`);
  },
  async remove(regionId) {
    const { File, Paths } = loadFileSystem();
    const file = new File(Paths.document, PACKAGE_DIR, `${regionId}.json`);
    if (file.exists) file.delete();
    await AsyncStorage.removeItem(`${STORAGE_KEYS.REGION_DATA}${regionId}`);
  },
};

const asyncStorageStore: PackageStore = {
  async write(regionId, serialized) {
    await AsyncStorage.setItem(`${STORAGE_KEYS.REGION_DATA}${regionId}`, serialized);
    // UTF-16 em localStorage: o tamanho que conta para a quota
    return serialized.length * 2;
  },
  read: (regionId) => AsyncStorage.getItem(`${STORAGE_KEYS.REGION_DATA}${regionId}`),
  remove: (regionId) => AsyncStorage.removeItem(`${STORAGE_KEYS.REGION_DATA}${regionId}`),
};

class OfflineStorageService {
  private readonly store: PackageStore;
  /** Pacotes já lidos do disco. Limpa-se ao descarregar ou apagar. */
  private readonly memory = new Map<string, OfflineRegionPackage>();

  constructor(store: PackageStore = Platform.OS === 'web' ? asyncStorageStore : fileStore) {
    this.store = store;
  }

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

    const sizeBytes = await this.store.write(regionId, JSON.stringify(pkg));
    this.memory.set(regionId, pkg);

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
   * Todos os pacotes descarregados, prontos a consultar. Lista vazia quando
   * não há nenhum — os chamadores tratam isso como "sem dados offline".
   */
  async getPackages(): Promise<OfflineRegionPackage[]> {
    const ids = await this.getDownloadedRegionIds();
    const packages: OfflineRegionPackage[] = [];
    for (const id of ids) {
      const pkg = await this.getRegionPackage(id);
      if (pkg) packages.push(pkg);
    }
    return packages;
  }

  /**
   * Get POIs from offline storage.
   * If regionId is provided, returns POIs for that region only.
   * Otherwise returns POIs from all downloaded regions.
   */
  async getOfflinePOIs(regionId?: string): Promise<HeritageItem[]> {
    const packages = regionId
      ? [await this.getRegionPackage(regionId)].filter((p): p is OfflineRegionPackage => p !== null)
      : await this.getPackages();
    return packages.flatMap((pkg) => pkg.heritage_items);
  }

  /**
   * Get routes from offline storage.
   * If regionId is provided, returns routes for that region only.
   * Otherwise returns routes from all downloaded regions.
   */
  async getOfflineRoutes(regionId?: string): Promise<Route[]> {
    const packages = regionId
      ? [await this.getRegionPackage(regionId)].filter((p): p is OfflineRegionPackage => p !== null)
      : await this.getPackages();
    return packages.flatMap((pkg) => pkg.routes);
  }

  /**
   * Get the raw region package from storage.
   */
  private async getRegionPackage(
    regionId: string
  ): Promise<OfflineRegionPackage | null> {
    const inMemory = this.memory.get(regionId);
    if (inMemory) return inMemory;
    try {
      const raw = await this.store.read(regionId);
      if (!raw) return null;
      const pkg: OfflineRegionPackage = JSON.parse(raw);
      this.memory.set(regionId, pkg);
      return pkg;
    } catch (err) {
      logger.warn(`[offlineStorage] Pacote ${regionId} ilegível`, err);
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
    this.memory.delete(regionId);
    await this.store.remove(regionId);
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

export { OfflineStorageService };
export type { PackageStore };
export const offlineStorage = new OfflineStorageService();
export default offlineStorage;
