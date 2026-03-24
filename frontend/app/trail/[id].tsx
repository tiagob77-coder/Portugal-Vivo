import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { getTrail, getTrailElevation, getTrailPOIs, getTrailSafety } from '../../src/services/api';
import ElevationProfile from '../../src/components/ElevationProfile';
import TrailTechnicalCard from '../../src/components/TrailTechnicalCard';
import { colors } from '../../src/theme';

type TabKey = 'info' | 'perfil' | 'pois';

const FIRE_RISK_COLORS: Record<string, string> = {
  low: '#22C55E',
  medium: '#EAB308',
  high: '#F97316',
  very_high: '#EF4444',
};

const FIRE_RISK_LABELS: Record<string, string> = {
  low: 'Risco Baixo',
  medium: 'Risco Médio',
  high: 'Risco Elevado',
  very_high: 'Risco Muito Elevado',
};

const REGION_LABELS: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location on web via navigator.geolocation
  useEffect(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // silently ignore errors
        }
      );
    }
  }, []);

  const { data: trail, isLoading: trailLoading } = useQuery({
    queryKey: ['trail', id],
    queryFn: () => getTrail(id!),
    enabled: !!id,
  });

  const { data: elevationData } = useQuery({
    queryKey: ['trailElevation', id],
    queryFn: () => getTrailElevation(id!),
    enabled: !!id && !!trail,
  });

  const { data: safetyData } = useQuery({
    queryKey: ['trailSafety', userLocation?.lat, userLocation?.lng],
    queryFn: () => getTrailSafety(userLocation!.lat, userLocation!.lng),
    enabled: !!userLocation,
  });

  const { data: pois = [] } = useQuery({
    queryKey: ['trailPOIs', id],
    queryFn: () => getTrailPOIs(id!),
    enabled: !!id,
  });

  const openGoogleMaps = () => {
    const firstPoint = trail?.points?.[0];
    if (!firstPoint) return;
    const dest = `${firstPoint.lat},${firstPoint.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
    if (Platform.OS === 'web') {
      // eslint-disable-line
      (window as any).open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  if (trailLoading) {
    return (
      <View style={[s.container, s.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#2E5E4E" />
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={[s.container, s.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={s.errorText}>Trilho não encontrado</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnTxt}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const regionLabel = REGION_LABELS[trail.region || ''] || trail.region || '';
  const elevProfile = elevationData?.profile || [];
  const trailColor = trail.color || '#22C55E';

  // ─── Safety alerts ──────────────────────────────────────────────────────────
  const fireRisk = safetyData?.fire_risk as string | undefined;
  const windSpeed = safetyData?.wind_speed_kmh as number | undefined;
  const weather = safetyData?.weather as Record<string, any> | undefined;

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Fixed gradient header ── */}
      <LinearGradient
        colors={['#1B3D39', '#2E5E4E']}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity style={s.backButton} onPress={() => router.back()} accessibilityLabel="Voltar">
          <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{trail.name}</Text>
          {regionLabel ? (
            <View style={s.regionBadge}>
              <MaterialIcons name="place" size={11} color="#A7F3D0" />
              <Text style={s.regionBadgeTxt}>{regionLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.headerRight} />
      </LinearGradient>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero stats card */}
        <View style={s.section}>
          <TrailTechnicalCard data={{
            distance_km: trail.distance_km,
            elevation_gain: trail.elevation_gain,
            elevation_loss: trail.elevation_loss,
            min_elevation: trail.min_elevation,
            max_elevation: trail.max_elevation,
            estimated_hours: trail.estimated_hours,
            difficulty: trail.difficulty,
            trail_type: trail.trail_type,
            terrain_type: trail.terrain_type,
          }} />
        </View>

        {/* ── Tabs ── */}
        <View style={s.tabBar}>
          {(['info', 'perfil', 'pois'] as TabKey[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tabItem, activeTab === tab && s.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabLabel, activeTab === tab && s.tabLabelActive]}>
                {tab === 'info' ? 'Informação' : tab === 'perfil' ? 'Perfil' : 'POIs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── INFO TAB ── */}
        {activeTab === 'info' && (
          <View style={s.tabContent}>
            {trail.description ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>Descrição</Text>
                <Text style={s.bodyText}>{trail.description}</Text>
              </View>
            ) : null}

            {/* Tags */}
            {trail.tags && trail.tags.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Etiquetas</Text>
                <View style={s.tagsRow}>
                  {trail.tags.map((tag) => (
                    <View key={tag} style={s.tag}>
                      <Text style={s.tagTxt}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Terrain */}
            {trail.terrain_type ? (
              <View style={s.card}>
                <Text style={s.cardTitle}>Terreno</Text>
                <View style={s.terrainRow}>
                  <MaterialIcons name="nature" size={18} color="#22C55E" />
                  <Text style={s.bodyText}>{trail.terrain_type}</Text>
                </View>
              </View>
            ) : null}

            {/* Safety alerts */}
            {safetyData && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Alertas e Condições</Text>

                {fireRisk && (
                  <View style={[s.alertCard, { borderLeftColor: FIRE_RISK_COLORS[fireRisk] || '#9CA3AF' }]}>
                    <MaterialIcons name="local-fire-department" size={18} color={FIRE_RISK_COLORS[fireRisk] || '#9CA3AF'} />
                    <View style={s.alertTextWrap}>
                      <Text style={[s.alertTitle, { color: FIRE_RISK_COLORS[fireRisk] || '#9CA3AF' }]}>
                        {FIRE_RISK_LABELS[fireRisk] || 'Risco Desconhecido'}
                      </Text>
                      <Text style={s.alertBody}>Incêndio florestal — verifique as autoridades locais.</Text>
                    </View>
                  </View>
                )}

                {weather?.description && (
                  <View style={[s.alertCard, { borderLeftColor: '#3B82F6' }]}>
                    <MaterialIcons name="wb-cloudy" size={18} color="#3B82F6" />
                    <View style={s.alertTextWrap}>
                      <Text style={[s.alertTitle, { color: '#3B82F6' }]}>Meteorologia</Text>
                      <Text style={s.alertBody}>{weather.description}</Text>
                    </View>
                  </View>
                )}

                {windSpeed !== undefined && windSpeed > 30 && (
                  <View style={[s.alertCard, { borderLeftColor: '#6366F1' }]}>
                    <MaterialIcons name="air" size={18} color="#6366F1" />
                    <View style={s.alertTextWrap}>
                      <Text style={[s.alertTitle, { color: '#6366F1' }]}>Vento Forte</Text>
                      <Text style={s.alertBody}>{windSpeed} km/h — tome precauções.</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── PERFIL TAB ── */}
        {activeTab === 'perfil' && (
          <View style={s.tabContent}>
            <View style={s.card}>
              <Text style={s.cardTitle}>Perfil de Elevação</Text>
              {elevProfile.length > 0 ? (
                <ElevationProfile
                  data={elevProfile}
                  color={trailColor}
                  trailName={trail.name}
                />
              ) : (
                <View style={s.emptyState}>
                  <MaterialIcons name="terrain" size={40} color="#D1D5DB" />
                  <Text style={s.emptyText}>Dados de elevação indisponíveis</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── POIS TAB ── */}
        {activeTab === 'pois' && (
          <View style={s.tabContent}>
            {pois.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialIcons name="place" size={40} color="#D1D5DB" />
                <Text style={s.emptyText}>Nenhum ponto de interesse encontrado</Text>
              </View>
            ) : (
              pois.map((poi: any, idx: number) => (
                <TouchableOpacity
                  key={(poi as any).id || idx}
                  style={s.poiCard}
                  onPress={() => {
                    if ((poi as any).id) router.push(`/heritage/${(poi as any).id}` as any);
                  }}
                >
                  <View style={s.poiIcon}>
                    <MaterialIcons name="place" size={20} color="#2E5E4E" />
                  </View>
                  <View style={s.poiInfo}>
                    <Text style={s.poiName} numberOfLines={1}>
                      {(poi as any).name || 'Ponto de interesse'}
                    </Text>
                    {(poi as any).category ? (
                      <Text style={s.poiCategory}>{(poi as any).category}</Text>
                    ) : null}
                    {(poi as any).distance_m !== undefined ? (
                      <Text style={s.poiDist}>
                        {((poi as any).distance_m / 1000).toFixed(1)} km do trilho
                      </Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={s.ctaButton} onPress={openGoogleMaps} activeOpacity={0.85}>
          <MaterialIcons name="directions-walk" size={20} color="#FFFFFF" />
          <Text style={s.ctaText}>Iniciar Trilho</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, gap: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FAF8F3', letterSpacing: -0.3 },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  regionBadgeTxt: { fontSize: 11, color: '#A7F3D0', fontWeight: '600' },
  headerRight: { width: 40 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 12, paddingHorizontal: 16, gap: 12 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 4,
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabItemActive: { backgroundColor: '#2E5E4E' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#FFFFFF' },
  tabContent: { gap: 12, marginTop: 4 },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 22 },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagTxt: { fontSize: 12, color: '#15803D', fontWeight: '600' },

  // Terrain
  terrainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Alert cards
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
  },
  alertTextWrap: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 13, fontWeight: '700' },
  alertBody: { fontSize: 12, color: '#6B7280', lineHeight: 18 },

  // POI list
  poiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  poiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiInfo: { flex: 1, gap: 2 },
  poiName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  poiCategory: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  poiDist: { fontSize: 11, color: '#9CA3AF' },

  // Empty state
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  // Bottom CTA
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  ctaButton: {
    backgroundColor: '#2E5E4E',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },

  // Error
  errorText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },
  backBtn: {
    marginTop: 8,
    backgroundColor: '#2E5E4E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Section wrapper (for the hero card)
  section: { marginTop: 0 },
});
