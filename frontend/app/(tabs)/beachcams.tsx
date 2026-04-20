/**
 * Beachcams - Live beach webcams from Portugal's coast
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import { colors, typography } from '../../src/theme';
import { useTheme } from '../../src/context/ThemeContext';
import api, { getBeaches, getBeachBandeiraAzul } from '../../src/services/api';

const { width: _screenWidth } = Dimensions.get('window');

const REGIONS = [
  { id: null, label: 'Todas', color: colors.terracotta[500] },
  { id: 'Norte', label: 'Norte', color: '#2563EB' },
  { id: 'Centro', label: 'Centro', color: '#059669' },
  { id: 'Lisboa', label: 'Lisboa', color: '#DC2626' },
  { id: 'Alentejo', label: 'Alentejo', color: '#854D0E' },
  { id: 'Algarve', label: 'Algarve', color: '#C49A6C' },
  { id: 'Açores', label: 'Açores', color: '#0E7490' },
  { id: 'Madeira', label: 'Madeira', color: '#7C3AED' },
];

const QUALITY_COLORS: Record<string, string> = {
  'Excelente': '#22C55E',
  'Boa': '#84CC16',
  'Suficiente': '#EAB308',
  'Insuficiente': '#F97316',
  'Proibida': '#DC2626',
};

const SURF_COLORS: Record<string, string> = {
  'Extremo': '#DC2626',
  'Avancado': '#F97316',
  'Intermedio-Avancado': '#C49A6C',
  'Intermedio': '#EAB308',
  'Iniciante-Intermedio': '#22C55E',
  'Iniciante': '#10B981',
  'Todos': '#3B82F6',
};

export default function BeachcamsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [expandedCam, setExpandedCam] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'webcams' | 'qualidade'>('webcams');

  const { data } = useQuery({
    queryKey: ['beachcams', activeRegion],
    queryFn: async () => {
      const params = activeRegion ? `?region=${activeRegion}` : '';
      const res = await api.get(`/beachcams/list${params}`);
      return res.data;
    },
  });

  const { data: beachesData } = useQuery({
    queryKey: ['beaches-quality', activeRegion],
    queryFn: () => getBeaches({ region: activeRegion || undefined, limit: 100 }),
  });

  const { data: baData } = useQuery({
    queryKey: ['bandeira-azul'],
    queryFn: () => getBeachBandeiraAzul(),
    staleTime: 1000 * 60 * 60 * 24, // 24h — atualizado anualmente
  });

  const beachcams = data?.beachcams || [];
  const beaches = beachesData?.beaches || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="beachcam-back-btn">
            <MaterialIcons name="arrow-back" size={22} color={colors.gray[700]} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Webcams de Praia</Text>
            <Text style={styles.headerSubtitle}>
              {beachcams.length} praias ao vivo na costa portuguesa
            </Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Tab Toggle */}
        <View style={styles.tabToggle}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'webcams' && styles.tabBtnActive]}
            onPress={() => setActiveTab('webcams')}
          >
            <MaterialIcons name="videocam" size={16} color={activeTab === 'webcams' ? '#FFF' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.tabBtnText, activeTab === 'webcams' && styles.tabBtnTextActive]}>Webcams</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'qualidade' && styles.tabBtnActive]}
            onPress={() => setActiveTab('qualidade')}
          >
            <MaterialIcons name="water" size={16} color={activeTab === 'qualidade' ? '#FFF' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.tabBtnText, activeTab === 'qualidade' && styles.tabBtnTextActive]}>
              Qualidade da Água
            </Text>
            {baData && (
              <View style={styles.baBadge}>
                <Text style={styles.baBadgeText}>{baData.total} 🔵</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Region Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
          {REGIONS.map((reg) => {
            const isActive = activeRegion === reg.id;
            return (
              <TouchableOpacity
                key={reg.id || 'all'}
                style={[styles.filterChip, isActive && { backgroundColor: reg.color }]}
                onPress={() => setActiveRegion(isActive ? null : reg.id)}
                data-testid={`beachcam-filter-${reg.id || 'all'}`}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {reg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* === WEBCAMS TAB === */}
        {activeTab === 'webcams' && <View style={styles.camGrid}>
          {beachcams.map((cam: any) => {
            const isExpanded = expandedCam === cam.id;
            const surfColor = SURF_COLORS[cam.surf_level] || '#666';
            return (
              <View key={cam.id} style={styles.camCard} data-testid={`beachcam-card-${cam.id}`}>
                {/* Webcam Embed */}
                <TouchableOpacity
                  style={styles.camPreview}
                  onPress={() => setExpandedCam(isExpanded ? null : cam.id)}
                  activeOpacity={0.9}
                >
                  <View style={styles.camPreviewOverlay}>
                    <View style={styles.camPlayBtn}>
                      <MaterialIcons name={isExpanded ? 'close' : 'videocam'} size={28} color="#FFF" />
                    </View>
                    <Text style={styles.camPreviewText}>
                      {isExpanded ? 'Fechar' : 'Ver Webcam ao Vivo'}
                    </Text>
                  </View>
                  <View style={styles.camRegionBadge}>
                    <Text style={styles.camRegionText}>{cam.region}</Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded Webcam View */}
                {isExpanded && (
                  <View style={styles.camIframeContainer}>
                    <View style={[styles.webviewContainer, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A2332' }]}>
                      <MaterialIcons name="videocam" size={48} color={colors.terracotta[500]} />
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                        {cam.name}
                      </Text>
                      <Text style={{ color: '#AAA', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                        Transmissão ao vivo via Beachcam
                      </Text>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', backgroundColor: colors.terracotta[500],
                          paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 20, gap: 8,
                        }}
                        onPress={() => Linking.openURL(cam.embed_url)}
                      >
                        <MaterialIcons name="open-in-new" size={18} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>
                          Abrir Webcam ao Vivo
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.camExternalBtn}
                      onPress={() => Linking.openURL(cam.embed_url)}
                    >
                      <MaterialIcons name="open-in-new" size={14} color={colors.terracotta[500]} />
                      <Text style={styles.camExternalText}>Abrir no Beachcam</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Info */}
                <View style={styles.camInfo}>
                  <Text style={styles.camName}>{cam.name}</Text>
                  <Text style={styles.camDesc} numberOfLines={2}>{cam.description}</Text>
                  
                  <View style={styles.camMeta}>
                    <View style={[styles.surfBadge, { backgroundColor: surfColor + '18' }]}>
                      <MaterialIcons name="waves" size={12} color={surfColor} />
                      <Text style={[styles.surfBadgeText, { color: surfColor }]}>{cam.surf_level}</Text>
                    </View>
                    <View style={styles.seasonBadge}>
                      <MaterialIcons name="wb-sunny" size={12} color="#C49A6C" />
                      <Text style={styles.seasonText}>{cam.best_season}</Text>
                    </View>
                  </View>

                  {/* Highlights */}
                  <View style={styles.highlights}>
                    {cam.highlights?.map((h: string, i: number) => (
                      <View key={i} style={styles.highlightTag}>
                        <Text style={styles.highlightText}>{h}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}
        </View>}

        {/* === QUALIDADE DA ÁGUA TAB === */}
        {activeTab === 'qualidade' && (
          <View style={styles.camGrid}>
            {beaches.length === 0 ? (
              <View style={styles.emptyQuality}>
                <MaterialIcons name="water" size={40} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyQualityText}>A carregar dados APA...</Text>
              </View>
            ) : (
              beaches.map((beach: any) => {
                const qColor = QUALITY_COLORS[beach.water_quality] || '#94A3B8';
                return (
                  <View key={beach.id} style={styles.beachQualityCard}>
                    <View style={styles.beachQualityHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.beachQualityName}>{beach.name}</Text>
                        <Text style={styles.beachQualityConc}>{beach.concelho} · {beach.region}</Text>
                      </View>
                      {beach.bandeira_azul && (
                        <View style={styles.baFlag}>
                          <Text style={styles.baFlagText}>🔵 Bandeira Azul {beach.bandeira_azul_year}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.beachQualityRow}>
                      <View style={[styles.qualityBadge, { backgroundColor: qColor + '22', borderColor: qColor + '55', borderWidth: 1 }]}>
                        <View style={[styles.qualityDot, { backgroundColor: qColor }]} />
                        <Text style={[styles.qualityBadgeText, { color: qColor }]}>
                          {beach.water_quality}
                        </Text>
                        {beach.water_quality_source === 'apa_live' && (
                          <Text style={[styles.qualitySource, { color: qColor }]}>· APA</Text>
                        )}
                      </View>
                      <Text style={styles.beachTypePill}>{beach.type}</Text>
                      {beach.length_m && (
                        <Text style={styles.beachLength}>{(beach.length_m / 1000).toFixed(1)} km</Text>
                      )}
                    </View>

                    {beach.facilities?.length > 0 && (
                      <View style={styles.facilitiesRow}>
                        {beach.facilities.slice(0, 3).map((f: string, i: number) => (
                          <View key={i} style={styles.facilityTag}>
                            <Text style={styles.facilityText}>{f}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1222' },
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: typography.fontSize['2xl'], fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(220,38,38,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#DC2626', letterSpacing: 1 },
  filtersScroll: { marginTop: 4 },
  filtersContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  filterChipText: { fontSize: typography.fontSize.sm, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  filterChipTextActive: { color: '#FFF' },
  camGrid: { paddingHorizontal: 20, marginTop: 20, gap: 16 },
  camCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  camPreview: { height: 120, backgroundColor: '#1A2332', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  camPreviewOverlay: { alignItems: 'center', gap: 8 },
  camPlayBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  camPreviewText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  camRegionBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  camRegionText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  camIframeContainer: { padding: 8, gap: 8 },
  camExternalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  camExternalText: { fontSize: 12, color: colors.terracotta[500], fontWeight: '600' },
  webviewContainer: { height: 280, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A2332' },
  webview: { flex: 1 },
  loadingContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A2332' },
  loadingText: { color: 'rgba(255,255,255,0.6)', marginTop: 10, fontSize: 12 },
  camInfo: { padding: 16 },
  camName: { fontSize: typography.fontSize.lg, fontWeight: '700', color: '#FFF' },
  camDesc: { fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 18 },
  camMeta: { flexDirection: 'row', gap: 8, marginTop: 12 },
  surfBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  surfBadgeText: { fontSize: 11, fontWeight: '700' },
  seasonBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  seasonText: { fontSize: 11, fontWeight: '600', color: '#C49A6C' },
  highlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  highlightTag: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  highlightText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  camDirectLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(198,93,59,0.9)', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginTop: 8 },
  camDirectLinkText: { color: '#FFF', fontSize: 12, fontWeight: '600', flex: 1 },
  // Tab toggle
  tabToggle: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabBtnActive: { backgroundColor: colors.terracotta[500] },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabBtnTextActive: { color: '#FFF' },
  baBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  baBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  // Beach quality cards
  beachQualityCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  beachQualityHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  beachQualityName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  beachQualityConc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  baFlag: { backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  baFlagText: { fontSize: 10, fontWeight: '700', color: '#93C5FD' },
  beachQualityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  qualityBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  qualityDot: { width: 7, height: 7, borderRadius: 3.5 },
  qualityBadgeText: { fontSize: 12, fontWeight: '700' },
  qualitySource: { fontSize: 10, fontWeight: '500', opacity: 0.7 },
  beachTypePill: { fontSize: 10, color: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, textTransform: 'capitalize' },
  beachLength: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  facilitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  facilityTag: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  facilityText: { fontSize: 10, color: 'rgba(255,255,255,0.45)' },
  emptyQuality: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyQualityText: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
});
