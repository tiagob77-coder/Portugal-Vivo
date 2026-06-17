/**
 * Beachcams - Live beach webcams from Portugal's coast
 * Design System Applied + Functional Links
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { typography, shadows, scrimPine } from '../../src/theme';
import { palette } from '../../src/theme/colors';
import { useTheme } from '../../src/context/ThemeContext';
import api, { getBeaches, getBeachBandeiraAzul } from '../../src/services/api';
import logger from '../../src/utils/logger';

const REGIONS = [
  { id: null, label: 'Todas' },
  { id: 'Norte', label: 'Norte' },
  { id: 'Centro', label: 'Centro' },
  { id: 'Lisboa', label: 'Lisboa' },
  { id: 'Alentejo', label: 'Alentejo' },
  { id: 'Algarve', label: 'Algarve' },
  { id: 'Açores', label: 'Açores' },
  { id: 'Madeira', label: 'Madeira' },
];

const SURF_COLORS: Record<string, string> = {
  'Extremo': '#DC2626',
  'Avancado': '#F97316',
  'Intermedio-Avancado': '#D97706',
  'Intermedio': '#EAB308',
  'Iniciante-Intermedio': '#22C55E',
  'Iniciante': '#10B981',
  'Todos': '#3B82F6',
};

const QUALITY_COLORS: Record<string, string> = {
  'Excelente': '#22C55E',
  'Boa': '#84CC16',
  'Suficiente': '#EAB308',
  'Insuficiente': '#F97316',
  'Proibida': '#DC2626',
};

export default function BeachcamsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc, isDark } = useTheme();
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'webcams' | 'qualidade'>('webcams');
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch } = useQuery({
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
    staleTime: 1000 * 60 * 60 * 24,
  });

  const beachcams = data?.beachcams || [];
  const beaches = beachesData?.beaches || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openWebcam = (url: string) => {
    Linking.openURL(url).catch(() => {
      logger.warn('Failed to open URL:', url);
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: tc.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={22} color={tc.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: tc.textPrimary }]}>
              Webcams de Praia
            </Text>
            <Text style={[styles.headerSubtitle, { color: tc.textMuted }]}>
              {beachcams.length} praias ao vivo
            </Text>
          </View>
          <View style={[styles.liveIndicator, { backgroundColor: 'rgba(220,38,38,0.15)' }]}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Tab Toggle */}
        <View style={[styles.tabToggle, { backgroundColor: tc.surface, borderColor: tc.border }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'webcams' && { backgroundColor: tc.accent }
            ]}
            onPress={() => setActiveTab('webcams')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'webcams' }}
            accessibilityLabel="Separador Webcams"
          >
            <MaterialIcons 
              name="videocam" 
              size={16} 
              color={activeTab === 'webcams' ? '#FFF' : tc.textMuted} 
            />
            <Text style={[
              styles.tabBtnText, 
              { color: activeTab === 'webcams' ? '#FFF' : tc.textMuted }
            ]}>
              Webcams
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'qualidade' && { backgroundColor: tc.accent }
            ]}
            onPress={() => setActiveTab('qualidade')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'qualidade' }}
            accessibilityLabel="Separador Qualidade da água"
          >
            <MaterialIcons 
              name="water" 
              size={16} 
              color={activeTab === 'qualidade' ? '#FFF' : tc.textMuted} 
            />
            <Text style={[
              styles.tabBtnText, 
              { color: activeTab === 'qualidade' ? '#FFF' : tc.textMuted }
            ]}>
              Qualidade
            </Text>
            {baData && (
              <View style={[styles.baBadge, { backgroundColor: tc.surfaceAlt }]}>
                <Text style={[styles.baBadgeText, { color: tc.textSecondary }]}>
                  {baData.total} 🔵
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Region Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filtersScroll} 
          contentContainerStyle={styles.filtersContent}
        >
          {REGIONS.map((reg) => {
            const isActive = activeRegion === reg.id;
            return (
              <TouchableOpacity
                key={reg.id || 'all'}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? tc.accent : tc.surface,
                    borderColor: isActive ? tc.accent : tc.border,
                  }
                ]}
                onPress={() => setActiveRegion(isActive ? null : reg.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Filtrar por região: ${reg.label}`}
              >
                <Text style={[
                  styles.filterChipText, 
                  { color: isActive ? '#FFF' : tc.textSecondary }
                ]}>
                  {reg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* === WEBCAMS TAB === */}
        {activeTab === 'webcams' && (
          <View style={styles.camGrid}>
            {beachcams.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: tc.surface }]}>
                <MaterialIcons name="videocam-off" size={48} color={tc.textMuted} />
                <Text style={[styles.emptyText, { color: tc.textMuted }]}>
                  Nenhuma webcam disponível
                </Text>
              </View>
            ) : (
              beachcams.map((cam: any) => {
                const surfColor = SURF_COLORS[cam.surf_level] || tc.textMuted;
                return (
                  <TouchableOpacity
                    key={cam.id}
                    style={[styles.camCard, { backgroundColor: tc.surface }]}
                    onPress={() => openWebcam(cam.embed_url)}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver webcam ao vivo da praia ${cam.name}`}
                  >
                    {/* Image with gradient overlay */}
                    <View style={styles.camImageContainer}>
                      <Image
                        source={{ uri: cam.image_url }}
                        style={styles.camImage}
                        contentFit="cover"
                        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                        transition={300}
                      />
                      <LinearGradient
                        colors={['transparent', scrimPine(0.8)]}
                        style={styles.camGradient}
                      />
                      
                      {/* Play button overlay */}
                      <View style={styles.playOverlay}>
                        <View style={styles.playButton}>
                          <MaterialIcons name="play-arrow" size={32} color="#FFF" />
                        </View>
                      </View>
                      
                      {/* Region badge */}
                      <View style={styles.regionBadge}>
                        <Text style={styles.regionText}>{cam.region}</Text>
                      </View>
                      
                      {/* Live indicator */}
                      <View style={styles.camLiveIndicator}>
                        <View style={styles.camLiveDot} />
                        <Text style={styles.camLiveText}>AO VIVO</Text>
                      </View>
                    </View>

                    {/* Card content */}
                    <View style={styles.camContent}>
                      <Text style={[styles.camName, { color: tc.textPrimary }]} numberOfLines={1}>
                        {cam.name}
                      </Text>
                      <Text style={[styles.camDesc, { color: tc.textMuted }]} numberOfLines={2}>
                        {cam.description}
                      </Text>
                      
                      {/* Tags row */}
                      <View style={styles.tagsRow}>
                        <View style={[styles.surfBadge, { backgroundColor: surfColor + '20' }]}>
                          <MaterialIcons name="waves" size={12} color={surfColor} />
                          <Text style={[styles.surfText, { color: surfColor }]}>
                            {cam.surf_level}
                          </Text>
                        </View>
                        <View style={[styles.seasonBadge, { backgroundColor: tc.surfaceAlt }]}>
                          <MaterialIcons name="wb-sunny" size={12} color={palette.terracotta[500]} />
                          <Text style={[styles.seasonText, { color: tc.textSecondary }]}>
                            {cam.best_season}
                          </Text>
                        </View>
                      </View>

                      {/* CTA */}
                      <TouchableOpacity
                        style={[styles.ctaButton, { backgroundColor: tc.accent }]}
                        onPress={() => openWebcam(cam.embed_url)}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir webcam ao vivo da praia ${cam.name}`}
                      >
                        <MaterialIcons name="open-in-new" size={16} color="#FFF" />
                        <Text style={styles.ctaText}>Ver Webcam ao Vivo</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* === QUALIDADE DA ÁGUA TAB === */}
        {activeTab === 'qualidade' && (
          <View style={styles.camGrid}>
            {beaches.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: tc.surface }]}>
                <MaterialIcons name="water" size={48} color={tc.textMuted} />
                <Text style={[styles.emptyText, { color: tc.textMuted }]}>
                  A carregar dados APA...
                </Text>
              </View>
            ) : (
              beaches.map((beach: any) => {
                const qColor = QUALITY_COLORS[beach.water_quality] || tc.textMuted;
                return (
                  <View 
                    key={beach.id} 
                    style={[styles.qualityCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
                  >
                    <View style={styles.qualityHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.qualityName, { color: tc.textPrimary }]}>
                          {beach.name}
                        </Text>
                        <Text style={[styles.qualityLocation, { color: tc.textMuted }]}>
                          {beach.concelho} · {beach.region}
                        </Text>
                      </View>
                      {beach.bandeira_azul && (
                        <View style={styles.baFlag}>
                          <Text style={styles.baFlagText}>🔵 {beach.bandeira_azul_year}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.qualityRow}>
                      <View style={[styles.qualityBadge, { backgroundColor: qColor + '20', borderColor: qColor }]}>
                        <View style={[styles.qualityDot, { backgroundColor: qColor }]} />
                        <Text style={[styles.qualityText, { color: qColor }]}>
                          {beach.water_quality}
                        </Text>
                      </View>
                      <Text style={[styles.beachType, { color: tc.textMuted, backgroundColor: tc.surfaceAlt }]}>
                        {beach.type}
                      </Text>
                    </View>
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
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    gap: 12 
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  headerContent: { flex: 1 },
  headerTitle: { 
    fontSize: typography.fontSize['xl'], 
    fontWeight: '700' 
  },
  headerSubtitle: { 
    fontSize: typography.fontSize.sm, 
    marginTop: 2 
  },
  liveIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  liveDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#DC2626' 
  },
  liveText: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#DC2626', 
    letterSpacing: 1 
  },

  // Tab Toggle
  tabToggle: { 
    flexDirection: 'row', 
    marginHorizontal: 20, 
    marginTop: 8, 
    borderRadius: 12, 
    padding: 4, 
    gap: 4,
    borderWidth: 1,
  },
  tabBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    borderRadius: 10, 
    gap: 6 
  },
  tabBtnText: { 
    fontSize: 13, 
    fontWeight: '600' 
  },
  baBadge: { 
    paddingHorizontal: 7, 
    paddingVertical: 2, 
    borderRadius: 8 
  },
  baBadgeText: { 
    fontSize: 10, 
    fontWeight: '700' 
  },

  // Filters
  filtersScroll: { marginTop: 16 },
  filtersContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { 
    fontSize: typography.fontSize.sm, 
    fontWeight: '600' 
  },

  // Webcam Cards
  camGrid: { 
    paddingHorizontal: 20, 
    marginTop: 20, 
    gap: 16 
  },
  camCard: { 
    borderRadius: 16, 
    overflow: 'hidden',
    ...shadows.md,
  },
  camImageContainer: {
    height: 180,
    position: 'relative',
  },
  camImage: {
    ...StyleSheet.absoluteFillObject,
  },
  camGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  regionBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  regionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  camLiveIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220,38,38,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  camLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  camLiveText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  camContent: {
    padding: 16,
  },
  camName: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  camDesc: {
    fontSize: typography.fontSize.sm,
    marginTop: 6,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  surfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  surfText: {
    fontSize: 11,
    fontWeight: '700',
  },
  seasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  seasonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    borderRadius: 16,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },

  // Quality Cards
  qualityCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  qualityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  qualityName: {
    fontSize: 15,
    fontWeight: '700',
  },
  qualityLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  baFlag: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  baFlagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  qualityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  qualityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  beachType: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    textTransform: 'capitalize',
  },
});
