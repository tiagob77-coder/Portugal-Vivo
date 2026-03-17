import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { palette } from '../theme';
import PressableScale from './PressableScale';
import offlineStorage, {
  OfflineRegionMeta,
  RegionInfo,
} from '../services/offlineStorage';
import axios from 'axios';
import { API_BASE } from '../config/api';

// Theme colors
const COLORS = {
  background: '#0F172A',
  card: '#1E293B',
  accent: palette.terracotta[500],
  text: palette.gray[50],
  textSecondary: '#94A3B8',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  border: '#334155',
};

interface DownloadState {
  regionId: string;
  progress: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OfflineManager() {
  const [availableRegions, setAvailableRegions] = useState<RegionInfo[]>([]);
  const [downloadedRegions, setDownloadedRegions] = useState<OfflineRegionMeta[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<DownloadState | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updatesAvailable, setUpdatesAvailable] = useState<Set<string>>(new Set());
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const offline = await offlineStorage.isOffline();
      setIsDeviceOffline(offline);

      // Load downloaded regions from local storage
      const downloaded = await offlineStorage.getOfflineRegions();
      setDownloadedRegions(downloaded);

      const usage = await offlineStorage.getStorageUsage();
      setStorageUsed(usage);

      // Fetch available regions from server if online
      if (!offline) {
        try {
          const res = await axios.get(`${API_BASE}/offline/regions`);
          setAvailableRegions(res.data.regions || []);
        } catch {
          // Silently fail — we still show downloaded regions
        }
      }
    } catch (error) {
      console.error('OfflineManager loadData error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDownload = useCallback(
    async (regionId: string) => {
      if (downloading) return;

      setDownloading({ regionId, progress: 0 });
      try {
        await offlineStorage.downloadRegion(regionId, (progress) => {
          setDownloading({ regionId, progress });
        });

        // Refresh state
        const downloaded = await offlineStorage.getOfflineRegions();
        setDownloadedRegions(downloaded);
        const usage = await offlineStorage.getStorageUsage();
        setStorageUsed(usage);

        // Remove from updates if it was pending
        setUpdatesAvailable((prev) => {
          const next = new Set(prev);
          next.delete(regionId);
          return next;
        });
      } catch (error) {
        Alert.alert(
          'Download Failed',
          'Could not download region data. Please check your connection and try again.'
        );
        console.error('Download error:', error);
      } finally {
        setDownloading(null);
      }
    },
    [downloading]
  );

  const handleDelete = useCallback((regionId: string, regionName: string) => {
    Alert.alert(
      'Delete Offline Data',
      `Remove "${regionName}" offline data? You can re-download it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await offlineStorage.deleteRegion(regionId);
            const downloaded = await offlineStorage.getOfflineRegions();
            setDownloadedRegions(downloaded);
            const usage = await offlineStorage.getStorageUsage();
            setStorageUsed(usage);
          },
        },
      ]
    );
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    setCheckingUpdates(true);
    try {
      const results = await offlineStorage.checkForUpdates();
      const withUpdates = results
        .filter((r) => r.hasUpdate)
        .map((r) => r.regionId);
      setUpdatesAvailable(new Set(withUpdates));

      if (withUpdates.length === 0) {
        Alert.alert('Up to Date', 'All downloaded regions are up to date.');
      } else {
        Alert.alert(
          'Updates Available',
          `${withUpdates.length} region(s) have updates available.`
        );
      }
    } catch {
      Alert.alert('Error', 'Could not check for updates. Please try again.');
    } finally {
      setCheckingUpdates(false);
    }
  }, []);

  const downloadedIds = new Set(downloadedRegions.map((r) => r.regionId));
  const STORAGE_LIMIT = 100 * 1024 * 1024; // 100 MB visual cap

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading offline data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <MaterialIcons name="offline-pin" size={28} color={COLORS.accent} />
        <Text style={styles.title}>Offline Regions</Text>
      </View>

      {/* Network Status */}
      {isDeviceOffline && (
        <View style={styles.offlineNotice}>
          <MaterialIcons name="cloud-off" size={16} color={COLORS.warning} />
          <Text style={styles.offlineNoticeText}>
            You are offline. Showing downloaded data only.
          </Text>
        </View>
      )}

      {/* Storage Usage Bar */}
      <View style={styles.card}>
        <View style={styles.storageHeader}>
          <MaterialIcons name="storage" size={20} color={COLORS.textSecondary} />
          <Text style={styles.storageLabel}>Storage Used</Text>
          <Text style={styles.storageValue}>
            {formatBytes(storageUsed)} / {formatBytes(STORAGE_LIMIT)}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min((storageUsed / STORAGE_LIMIT) * 100, 100)}%`,
                backgroundColor:
                  storageUsed / STORAGE_LIMIT > 0.8
                    ? COLORS.danger
                    : COLORS.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.regionCountText}>
          {downloadedRegions.length} region(s) downloaded
        </Text>
      </View>

      {/* Check for Updates */}
      {downloadedRegions.length > 0 && !isDeviceOffline && (
        <PressableScale
          onPress={handleCheckUpdates}
          style={styles.updateButton}
          disabled={checkingUpdates}
        >
          {checkingUpdates ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <MaterialIcons name="sync" size={20} color={COLORS.text} />
          )}
          <Text style={styles.updateButtonText}>
            {checkingUpdates ? 'Checking...' : 'Check for Updates'}
          </Text>
        </PressableScale>
      )}

      {/* Downloaded Regions */}
      {downloadedRegions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Downloaded</Text>
          {downloadedRegions.map((region) => {
            const hasUpdate = updatesAvailable.has(region.regionId);
            const isDownloading = downloading?.regionId === region.regionId;

            return (
              <View key={region.regionId} style={styles.card}>
                <View style={styles.regionRow}>
                  <View style={styles.regionIcon}>
                    <MaterialIcons
                      name="check-circle"
                      size={24}
                      color={COLORS.success}
                    />
                  </View>
                  <View style={styles.regionInfo}>
                    <Text style={styles.regionName}>{region.regionName}</Text>
                    <Text style={styles.regionStats}>
                      {region.poiCount} POIs, {region.routesCount} routes,{' '}
                      {region.eventsCount} events
                    </Text>
                    <Text style={styles.regionSize}>
                      {formatBytes(region.sizeBytes)}
                    </Text>
                  </View>
                  <View style={styles.regionActions}>
                    {hasUpdate && (
                      <PressableScale
                        onPress={() => handleDownload(region.regionId)}
                        style={styles.actionBtnUpdate}
                        disabled={!!downloading}
                      >
                        {isDownloading ? (
                          <ActivityIndicator size="small" color={COLORS.text} />
                        ) : (
                          <MaterialIcons
                            name="update"
                            size={20}
                            color={COLORS.text}
                          />
                        )}
                      </PressableScale>
                    )}
                    <PressableScale
                      onPress={() =>
                        handleDelete(region.regionId, region.regionName)
                      }
                      style={styles.actionBtnDelete}
                      disabled={!!downloading}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={20}
                        color={COLORS.danger}
                      />
                    </PressableScale>
                  </View>
                </View>
                {hasUpdate && !isDownloading && (
                  <View style={styles.updateBadge}>
                    <MaterialIcons
                      name="info-outline"
                      size={14}
                      color={COLORS.warning}
                    />
                    <Text style={styles.updateBadgeText}>Update available</Text>
                  </View>
                )}
                {isDownloading && (
                  <View style={styles.downloadProgress}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${(downloading?.progress ?? 0) * 100}%`,
                            backgroundColor: COLORS.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round((downloading?.progress ?? 0) * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

      {/* Available Regions */}
      {availableRegions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Available Regions</Text>
          {availableRegions
            .filter((r) => !downloadedIds.has(r.id))
            .map((region) => {
              const isDownloading = downloading?.regionId === region.id;

              return (
                <View key={region.id} style={styles.card}>
                  <View style={styles.regionRow}>
                    <View style={styles.regionIcon}>
                      <MaterialIcons
                        name="cloud-download"
                        size={24}
                        color={COLORS.textSecondary}
                      />
                    </View>
                    <View style={styles.regionInfo}>
                      <Text style={styles.regionName}>{region.name}</Text>
                      <Text style={styles.regionStats}>
                        {region.poi_count} POIs, {region.routes_count} routes,{' '}
                        {region.events_count} events
                      </Text>
                      <Text style={styles.regionSize}>
                        ~{region.estimated_size_mb} MB
                      </Text>
                    </View>
                    <PressableScale
                      onPress={() => handleDownload(region.id)}
                      style={styles.downloadBtn}
                      disabled={!!downloading || isDeviceOffline}
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={COLORS.text} />
                      ) : (
                        <MaterialIcons
                          name="file-download"
                          size={22}
                          color={COLORS.text}
                        />
                      )}
                    </PressableScale>
                  </View>
                  {isDownloading && (
                    <View style={styles.downloadProgress}>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${(downloading?.progress ?? 0) * 100}%`,
                              backgroundColor: COLORS.accent,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {Math.round((downloading?.progress ?? 0) * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
        </>
      )}

      {/* Empty State */}
      {downloadedRegions.length === 0 &&
        availableRegions.filter((r) => !downloadedIds.has(r.id)).length === 0 &&
        !isDeviceOffline && (
          <View style={styles.emptyState}>
            <MaterialIcons
              name="cloud-off"
              size={48}
              color={COLORS.textSecondary}
            />
            <Text style={styles.emptyTitle}>No regions available</Text>
            <Text style={styles.emptySubtitle}>
              Pull down to refresh and check for available regions.
            </Text>
          </View>
        )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Offline notice
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  offlineNoticeText: {
    color: COLORS.warning,
    fontSize: 13,
    flex: 1,
  },

  // Cards
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  // Storage
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  storageLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  storageValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  regionCountText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },

  // Update button
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  updateButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },

  // Section
  sectionTitle: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Region row
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  regionIcon: {
    marginRight: 12,
  },
  regionInfo: {
    flex: 1,
  },
  regionName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  regionStats: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  regionSize: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  regionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnUpdate: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    padding: 8,
  },
  actionBtnDelete: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Download button
  downloadBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    padding: 10,
  },

  // Download progress
  downloadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  progressText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },

  // Update badge
  updateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  updateBadgeText: {
    color: COLORS.warning,
    fontSize: 12,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
  },
});
