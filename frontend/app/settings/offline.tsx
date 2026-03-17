import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import offlineCache from '../../src/services/offlineCache'; // eslint-disable-line import/no-named-as-default

import { API_URL } from '../../src/config/api';

interface RegionInfo {
  id: string;
  name: string;
  poi_count: number;
  version: string;
}

interface DownloadState {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  lastSync: string | null;
  sizeMb: number;
}

const REGION_ICONS: Record<string, string> = {
  norte: 'landscape', centro: 'castle', lisboa: 'location-city',
  alentejo: 'wb-sunny', algarve: 'beach-access', acores: 'waves', madeira: 'terrain',
};
const REGION_COLORS: Record<string, string> = {
  norte: '#3B82F6', centro: '#22C55E', lisboa: '#F59E0B',
  alentejo: '#EF4444', algarve: '#06B6D4', acores: '#8B5CF6', madeira: '#EC4899',
};

export default function OfflineSettingsPage() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isPremium } = useAuth();
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [totalUsedMb, setTotalUsedMb] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const r = await fetch(`${API_URL}/api/offline/package/version`);
      const data = await r.json();
      const regionList = Object.entries(data.regions).map(([id, v]: [string, any]) => ({
        id, name: v.name, poi_count: v.poi_count, version: v.version,
      }));
      setRegions(regionList);

      const states: Record<string, DownloadState> = {};
      let usedTotal = 0;
      for (const reg of regionList) {
        const cached = await AsyncStorage.getItem(`offline_pkg_${reg.id}`);
        const syncTime = await AsyncStorage.getItem(`offline_sync_${reg.id}`);
        const sizeCached = cached ? JSON.parse(cached).package_size_mb || 0 : 0;
        if (cached) usedTotal += sizeCached;
        states[reg.id] = {
          downloaded: !!cached,
          downloading: false,
          progress: cached ? 100 : 0,
          lastSync: syncTime,
          sizeMb: sizeCached,
        };
      }
      setDownloads(states);
      setTotalUsedMb(usedTotal);
    } catch {
      // Offline - show cached state only
    }
    setLoading(false);
  };

  const downloadRegion = useCallback(async (regionId: string) => {
    if (!isPremium) {
      router.push('/premium');
      return;
    }
    setDownloads(prev => ({ ...prev, [regionId]: { ...prev[regionId], downloading: true, progress: 10 } }));
    try {
      setDownloads(prev => ({ ...prev, [regionId]: { ...prev[regionId], progress: 30 } }));
      const r = await fetch(`${API_URL}/api/offline/package/${regionId}`);
      setDownloads(prev => ({ ...prev, [regionId]: { ...prev[regionId], progress: 60 } }));
      const data = await r.json();
      setDownloads(prev => ({ ...prev, [regionId]: { ...prev[regionId], progress: 80 } }));
      await AsyncStorage.setItem(`offline_pkg_${regionId}`, JSON.stringify(data));
      await AsyncStorage.setItem(`offline_sync_${regionId}`, new Date().toISOString());
      // Also cache individual POIs for search
      await offlineCache.setCache(`cache_region_${regionId}_pois`, data.pois, 30 * 24 * 60 * 60 * 1000);

      setDownloads(prev => ({
        ...prev,
        [regionId]: { downloaded: true, downloading: false, progress: 100, lastSync: new Date().toISOString(), sizeMb: data.package_size_mb || 0 },
      }));
      setTotalUsedMb(prev => prev + (data.package_size_mb || 0));
    } catch {
      const msg = 'Não foi possível descarregar. Verifique a ligação.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Erro', msg); // eslint-disable-line no-unused-expressions
      setDownloads(prev => ({ ...prev, [regionId]: { ...prev[regionId], downloading: false, progress: 0 } }));
    }
  }, []);

  const [downloadingAll, setDownloadingAll] = useState(false);

  const removeRegion = useCallback(async (regionId: string) => {
    await AsyncStorage.removeItem(`offline_pkg_${regionId}`);
    await AsyncStorage.removeItem(`offline_sync_${regionId}`);
    await AsyncStorage.removeItem(`cache_region_${regionId}_pois`);
    setDownloads(prev => ({
      ...prev,
      [regionId]: { downloaded: false, downloading: false, progress: 0, lastSync: null, sizeMb: 0 },
    }));
    setTotalUsedMb(prev => Math.max(0, prev - (downloads[regionId]?.sizeMb || 0)));
  }, [downloads]);

  const downloadAll = useCallback(async () => {
    if (!isPremium) {
      router.push('/premium');
      return;
    }
    setDownloadingAll(true);
    for (const region of regions) {
      const state = downloads[region.id];
      if (state?.downloaded) continue;
      await downloadRegion(region.id);
    }
    setDownloadingAll(false);
    const msg = 'Todas as regioes foram descarregadas!';
    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sucesso', msg); // eslint-disable-line no-unused-expressions
  }, [regions, downloads, downloadRegion, isPremium]);

  const removeAll = useCallback(async () => {
    for (const region of regions) {
      await removeRegion(region.id);
    }
    const msg = 'Todos os dados offline foram removidos.';
    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Removido', msg); // eslint-disable-line no-unused-expressions
  }, [regions, removeRegion]);

  const downloadedCount = Object.values(downloads).filter(d => d.downloaded).length;

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Nunca';
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} data-testid="offline-back-btn">
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Dados Offline</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Premium gate banner */}
        {!isPremium && (
          <TouchableOpacity
            style={[styles.premiumBanner, { backgroundColor: '#C49A6C' }]}
            onPress={() => router.push('/premium')}
          >
            <MaterialIcons name="lock" size={20} color="#FFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumBannerTitle}>Funcionalidade Premium</Text>
              <Text style={styles.premiumBannerDesc}>Faça upgrade para guardar regiões offline</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* Storage Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]} data-testid="storage-summary">
          <MaterialIcons name="storage" size={28} color={colors.accent} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Armazenamento</Text>
            <Text style={[styles.summaryValue, { color: colors.textMuted }]}>
              {totalUsedMb.toFixed(1)} MB utilizados
            </Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: colors.accent + '20' }]}>
            <Text style={[styles.countText, { color: colors.accent }]}>
              {Object.values(downloads).filter(d => d.downloaded).length}/{regions.length}
            </Text>
          </View>
        </View>

        {/* Bulk Actions */}
        <View style={styles.bulkActions} data-testid="bulk-actions">
          <TouchableOpacity
            style={[styles.bulkBtn, styles.bulkBtnDownload]}
            onPress={downloadAll}
            disabled={downloadingAll || downloadedCount === regions.length}
            data-testid="download-all-btn"
          >
            {downloadingAll ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <MaterialIcons name="cloud-download" size={18} color="#FFF" />
            )}
            <Text style={styles.bulkBtnText}>
              {downloadingAll ? 'A descarregar...' : 'Descarregar Tudo'}
            </Text>
          </TouchableOpacity>
          {downloadedCount > 0 && (
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnRemove]}
              onPress={removeAll}
              disabled={downloadingAll}
              data-testid="remove-all-btn"
            >
              <MaterialIcons name="delete-sweep" size={18} color="#EF4444" />
              <Text style={[styles.bulkBtnText, { color: '#EF4444' }]}>Remover Tudo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Regions */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Regiões</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          regions.map(region => {
            const state = downloads[region.id] || { downloaded: false, downloading: false, progress: 0, lastSync: null, sizeMb: 0 };
            const regionColor = REGION_COLORS[region.id] || colors.accent;
            const icon = REGION_ICONS[region.id] || 'place';

            return (
              <View key={region.id} style={[styles.regionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} data-testid={`region-${region.id}`}>
                <View style={[styles.regionIcon, { backgroundColor: regionColor + '15' }]}>
                  <MaterialIcons name={icon as any} size={22} color={regionColor} />
                </View>
                <View style={styles.regionInfo}>
                  <Text style={[styles.regionName, { color: colors.textPrimary }]}>{region.name}</Text>
                  <Text style={[styles.regionMeta, { color: colors.textMuted }]}>
                    {region.poi_count} POIs{state.downloaded ? ` · ${state.sizeMb.toFixed(1)} MB` : ''}
                  </Text>
                  {state.lastSync && (
                    <Text style={[styles.syncDate, { color: colors.textMuted }]}>
                      Atualizado: {formatDate(state.lastSync)}
                    </Text>
                  )}
                  {/* Progress bar */}
                  {state.downloading && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${state.progress}%`, backgroundColor: regionColor }]} />
                      </View>
                      <Text style={[styles.progressText, { color: colors.textMuted }]}>{state.progress}%</Text>
                    </View>
                  )}
                </View>
                {/* Action button */}
                {state.downloading ? (
                  <ActivityIndicator size="small" color={regionColor} />
                ) : state.downloaded ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => downloadRegion(region.id)}
                      style={[styles.actionBtn, { backgroundColor: regionColor + '15' }]}
                      data-testid={`update-${region.id}`}
                    >
                      <MaterialIcons name="refresh" size={18} color={regionColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeRegion(region.id)}
                      style={[styles.actionBtn, { backgroundColor: '#EF444415' }]}
                      data-testid={`remove-${region.id}`}
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => downloadRegion(region.id)}
                    style={[styles.downloadBtn, { backgroundColor: regionColor }]}
                    data-testid={`download-${region.id}`}
                  >
                    <MaterialIcons name="cloud-download" size={16} color="#FFF" />
                    <Text style={styles.downloadText}>Guardar</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {/* Info footer */}
        <View style={styles.infoBox} data-testid="offline-info">
          <MaterialIcons name="info-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            Os dados offline incluem POIs, rotas e eventos de cada região. Recomendamos atualizar a cada 7 dias.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16 },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 12, borderWidth: 1, marginBottom: 20,
  },
  summaryTitle: { fontSize: 15, fontWeight: '600' },
  summaryValue: { fontSize: 13, marginTop: 2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  regionCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 10, borderWidth: 1, marginBottom: 10,
  },
  regionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  regionInfo: { flex: 1, marginLeft: 12 },
  regionName: { fontSize: 15, fontWeight: '600' },
  regionMeta: { fontSize: 12, marginTop: 2 },
  syncDate: { fontSize: 11, marginTop: 2 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 11, fontWeight: '600', width: 30 },
  actionBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, gap: 4,
  },
  downloadText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 12, marginBottom: 16,
  },
  premiumBannerTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  premiumBannerDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  infoBox: { flexDirection: 'row', gap: 8, marginTop: 16, padding: 12 },
  infoText: { fontSize: 12, flex: 1, lineHeight: 18 },
  bulkActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  bulkBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, gap: 6,
  },
  bulkBtnDownload: { backgroundColor: '#22C55E' },
  bulkBtnRemove: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  bulkBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
