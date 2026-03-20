/**
 * Explorar à Volta — Deep urban exploration in 300–800m radius
 * Micro-stories, photo spots, mini-challenges, and curiosities
 * for slow, mindful discovery on foot.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import api from '../src/services/api';
import { useTheme } from '../src/context/ThemeContext';

const { width } = Dimensions.get('window');

// ========================
// TYPES
// ========================

interface Challenge {
  type: string;
  icon: string;
  label: string;
  poi_id: string;
  poi_name: string;
}

interface ExplorePOI {
  id: string;
  name: string;
  category: string;
  location: { lat: number; lng: number };
  image_url?: string;
  distance_km: number;
  distance_m: number;
  direction: string;
  walking_minutes: number;
  micro_story: string;
  is_photo_spot: boolean;
  challenge?: Challenge;
  curiosity?: string;
  content_types: string[];
  iq_score?: number;
}

type ModeId = 'all' | 'stories' | 'photo_spots' | 'challenges' | 'curiosities';

// ========================
// CONSTANTS
// ========================

const RADIUS_STEPS = [300, 400, 500, 600, 800];
const CHALLENGE_COLORS: Record<string, string> = {
  foto: '#EC4899',
  quiz: '#3B82F6',
  degustacao: '#EF4444',
  exploracao: '#22C55E',
  observacao: '#06B6D4',
  aprendizagem: '#8B5CF6',
};

const MODES: { id: ModeId; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'Tudo', icon: 'explore', color: '#2E5E4E' },
  { id: 'stories', label: 'Histórias', icon: 'auto-stories', color: '#8B5CF6' },
  { id: 'photo_spots', label: 'Foto', icon: 'photo-camera', color: '#EC4899' },
  { id: 'challenges', label: 'Desafios', icon: 'emoji-events', color: '#F59E0B' },
  { id: 'curiosities', label: 'Curiosidades', icon: 'lightbulb', color: '#06B6D4' },
];

// ========================
// HELPERS
// ========================

const getContentBadgeColor = (type: string) => {
  const map: Record<string, string> = {
    story: '#8B5CF6',
    photo_spot: '#EC4899',
    challenge: '#F59E0B',
    curiosity: '#06B6D4',
  };
  return map[type] || '#94A3B8';
};

// ========================
// MAIN COMPONENT
// ========================

export default function ExploreAroundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusM, setRadiusM] = useState(500);
  const [mode, setMode] = useState<ModeId>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for radar effect
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Get location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permissão de localização negada.');
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setLocationError('Não foi possível obter a localização.');
      }
    })();
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['explore-around', location?.lat, location?.lng, radiusM, mode],
    queryFn: async () => {
      const res = await api.get('/explore-nearby/explore-around', {
        params: { lat: location!.lat, lng: location!.lng, radius_m: radiusM, mode, limit: 20 },
      });
      return res.data as { pois: ExplorePOI[]; summary: any };
    },
    enabled: !!location,
    staleTime: 60_000,
  });

  const pois = data?.pois || [];
  const summary = data?.summary || {};

  // ========================
  // RENDER
  // ========================

  if (locationError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <MaterialIcons name="location-off" size={48} color="#EF4444" />
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>{locationError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLocationError(null); }}>
          <Text style={{ color: '#FFF', fontWeight: '700' }}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#2E5E4E' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Explorar à Volta</Text>
          <Text style={styles.headerSub}>
            {location ? `${radiusM}m · ${pois.length} lugares` : 'A obter localização…'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
          <MaterialIcons name="my-location" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Radar visual */}
        <View style={styles.radarContainer}>
          <Animated.View style={[styles.radarOuter, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.radarMiddle} />
          <View style={styles.radarDot} />
          {!location && (
            <ActivityIndicator size="large" color="#2E5E4E" style={StyleSheet.absoluteFill} />
          )}
          {summary.total > 0 && (
            <View style={styles.radarStats}>
              {summary.photo_spots > 0 && (
                <View style={[styles.radarBadge, { backgroundColor: '#EC4899' }]}>
                  <MaterialIcons name="photo-camera" size={11} color="#FFF" />
                  <Text style={styles.radarBadgeText}>{summary.photo_spots}</Text>
                </View>
              )}
              {summary.challenges > 0 && (
                <View style={[styles.radarBadge, { backgroundColor: '#F59E0B' }]}>
                  <MaterialIcons name="emoji-events" size={11} color="#FFF" />
                  <Text style={styles.radarBadgeText}>{summary.challenges}</Text>
                </View>
              )}
              {summary.stories > 0 && (
                <View style={[styles.radarBadge, { backgroundColor: '#8B5CF6' }]}>
                  <MaterialIcons name="auto-stories" size={11} color="#FFF" />
                  <Text style={styles.radarBadgeText}>{summary.stories}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Radius selector */}
        <View style={styles.radiusRow}>
          {RADIUS_STEPS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusChip, radiusM === r && { backgroundColor: '#2E5E4E', borderColor: '#2E5E4E' }]}
              onPress={() => setRadiusM(r)}
            >
              <Text style={[styles.radiusText, radiusM === r && { color: '#FFF' }]}>
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mode tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modesRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modeChip, mode === m.id && { backgroundColor: m.color, borderColor: m.color }]}
              onPress={() => setMode(m.id)}
            >
              <MaterialIcons name={m.icon as any} size={14} color={mode === m.id ? '#FFF' : colors.textMuted} />
              <Text style={[styles.modeText, { color: mode === m.id ? '#FFF' : colors.textMuted }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2E5E4E" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>A explorar a zona…</Text>
          </View>
        )}

        {/* Empty state */}
        {!isLoading && pois.length === 0 && location && (
          <View style={styles.emptyState}>
            <MaterialIcons name="explore-off" size={40} color="#94A3B8" />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nada neste raio</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Tenta aumentar o raio ou muda de modo.
            </Text>
          </View>
        )}

        {/* POI cards */}
        <View style={styles.poiList}>
          {pois.map((poi) => {
            const isExpanded = expandedId === poi.id;
            return (
              <TouchableOpacity
                key={poi.id}
                style={[styles.poiCard, { backgroundColor: colors.surface }]}
                onPress={() => setExpandedId(isExpanded ? null : poi.id)}
                activeOpacity={0.85}
              >
                {/* Content type badges */}
                <View style={styles.badgeRow}>
                  {poi.content_types.map((ct) => (
                    <View key={ct} style={[styles.contentBadge, { backgroundColor: getContentBadgeColor(ct) }]}>
                      <Text style={styles.contentBadgeText}>{ct === 'photo_spot' ? '📷' : ct === 'challenge' ? '🏆' : ct === 'curiosity' ? '💡' : '📖'}</Text>
                    </View>
                  ))}
                </View>

                {/* POI header */}
                <View style={styles.poiHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.poiName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {poi.name}
                    </Text>
                    <Text style={[styles.poiCat, { color: colors.textMuted }]}>{poi.category}</Text>
                  </View>
                  <View style={styles.distanceBlock}>
                    <Text style={styles.distanceText}>{poi.distance_m}m</Text>
                    <Text style={styles.directionText}>{poi.direction}</Text>
                  </View>
                </View>

                {/* Walk time */}
                <View style={styles.walkRow}>
                  <MaterialIcons name="directions-walk" size={13} color={colors.textMuted} />
                  <Text style={[styles.walkText, { color: colors.textMuted }]}>
                    {poi.walking_minutes < 1 ? 'menos de 1 min' : `${poi.walking_minutes} min a pé`}
                  </Text>
                  {poi.is_photo_spot && (
                    <View style={styles.photoSpotPill}>
                      <MaterialIcons name="photo-camera" size={11} color="#EC4899" />
                      <Text style={styles.photoSpotText}>Spot Fotográfico</Text>
                    </View>
                  )}
                </View>

                {/* Micro-story (always visible, trimmed) */}
                <Text
                  style={[styles.microStory, { color: colors.textSecondary }]}
                  numberOfLines={isExpanded ? undefined : 2}
                >
                  {poi.micro_story}
                </Text>

                {/* Expanded: challenge + curiosity */}
                {isExpanded && (
                  <>
                    {poi.challenge && (
                      <View style={[styles.challengeCard, { borderColor: CHALLENGE_COLORS[poi.challenge.type] || '#F59E0B' }]}>
                        <View style={styles.challengeHeader}>
                          <MaterialIcons
                            name={poi.challenge.icon as any}
                            size={16}
                            color={CHALLENGE_COLORS[poi.challenge.type] || '#F59E0B'}
                          />
                          <Text style={[styles.challengeType, { color: CHALLENGE_COLORS[poi.challenge.type] || '#F59E0B' }]}>
                            Desafio
                          </Text>
                        </View>
                        <Text style={[styles.challengeLabel, { color: colors.textPrimary }]}>
                          {poi.challenge.label}
                        </Text>
                      </View>
                    )}

                    {poi.curiosity && (
                      <View style={[styles.curiosityCard, { backgroundColor: colors.background }]}>
                        <MaterialIcons name="lightbulb" size={14} color="#06B6D4" />
                        <Text style={[styles.curiosityText, { color: colors.textSecondary }]}>
                          {poi.curiosity}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.goBtn}
                      onPress={() => router.push(`/heritage/${poi.id}` as any)}
                    >
                      <MaterialIcons name="place" size={16} color="#FFF" />
                      <Text style={styles.goBtnText}>Ver detalhe</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Expand indicator */}
                <MaterialIcons
                  name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={18}
                  color={colors.textMuted}
                  style={styles.expandIcon}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preload hint */}
        {data?.offline_preload_hint && (
          <View style={[styles.offlineBanner, { backgroundColor: '#2E5E4E15' }]}>
            <MaterialIcons name="download-for-offline" size={18} color="#2E5E4E" />
            <Text style={[styles.offlineBannerText, { color: '#2E5E4E' }]}>
              Descarregue esta zona para usar offline sem internet.
            </Text>
            <TouchableOpacity onPress={() => router.push('/settings/offline' as any)}>
              <Text style={styles.offlineBannerLink}>Gerir</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ========================
// STYLES
// ========================

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  errorText: { fontSize: 15, textAlign: 'center' },
  retryBtn: { backgroundColor: '#2E5E4E', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },

  // Radar
  radarContainer: {
    width: 200, height: 200, alignSelf: 'center', marginVertical: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  radarOuter: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(46,94,78,0.08)', borderWidth: 1, borderColor: 'rgba(46,94,78,0.2)',
  },
  radarMiddle: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(46,94,78,0.12)', borderWidth: 1, borderColor: 'rgba(46,94,78,0.3)',
  },
  radarDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#2E5E4E',
  },
  radarStats: {
    position: 'absolute', bottom: -10, flexDirection: 'row', gap: 6,
  },
  radarBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 10,
  },
  radarBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Radius selector
  radiusRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 12,
  },
  radiusChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#D1D5DB',
  },
  radiusText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },

  // Mode tabs
  modesRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#D1D5DB',
  },
  modeText: { fontSize: 12, fontWeight: '600' },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, justifyContent: 'center' },
  loadingText: { fontSize: 14 },

  // Empty state
  emptyState: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center' },

  // POI list
  poiList: { paddingHorizontal: 16, gap: 10 },
  poiCard: {
    borderRadius: 14, padding: 14, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  badgeRow: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  contentBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  contentBadgeText: { fontSize: 10 },

  poiHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  poiName: { fontSize: 15, fontWeight: '700' },
  poiCat: { fontSize: 11, marginTop: 1 },

  distanceBlock: { alignItems: 'flex-end' },
  distanceText: { fontSize: 14, fontWeight: '800', color: '#2E5E4E' },
  directionText: { fontSize: 11, color: '#94A3B8' },

  walkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  walkText: { fontSize: 11 },
  photoSpotPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(236,72,153,0.1)', paddingHorizontal: 7,
    paddingVertical: 2, borderRadius: 8, marginLeft: 8,
  },
  photoSpotText: { fontSize: 10, color: '#EC4899', fontWeight: '600' },

  microStory: { fontSize: 13, lineHeight: 19, marginTop: 2 },

  // Challenge card
  challengeCard: {
    borderRadius: 8, borderWidth: 1.5, padding: 10, gap: 4, marginTop: 4,
  },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  challengeType: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  challengeLabel: { fontSize: 13, fontWeight: '600' },

  // Curiosity card
  curiosityCard: {
    flexDirection: 'row', gap: 6, padding: 10, borderRadius: 8, marginTop: 4, alignItems: 'flex-start',
  },
  curiosityText: { flex: 1, fontSize: 12, lineHeight: 18, fontStyle: 'italic' },

  // Go button
  goBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2E5E4E', borderRadius: 8, paddingVertical: 8, gap: 6, marginTop: 4,
  },
  goBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  expandIcon: { alignSelf: 'center', marginTop: 2 },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 10,
  },
  offlineBannerText: { flex: 1, fontSize: 12 },
  offlineBannerLink: { fontSize: 12, fontWeight: '700', color: '#2E5E4E', textDecorationLine: 'underline' },
});
