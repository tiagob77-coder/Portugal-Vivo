/**
 * Gamificação - Check-in & Badges Screen
 * Sistema de check-in por proximidade GPS com badges e progressão
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ShareButton } from '../src/components/ShareButton';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getGamificationProfile, getNearbyCheckins, doCheckin,
  GamificationProfile as _GamificationProfile, NearbyPOI as _NearbyPOI, Badge as _Badge,
} from '../src/services/api';
import { colors, shadows } from '../src/theme';
import BadgeCelebration from '../src/components/BadgeCelebration';
import AnimatedListItem from '../src/components/AnimatedListItem';
import SkeletonCard from '../src/components/SkeletonCard';
import MissionCard, { Mission } from '../src/components/MissionCard';
import { API_BASE } from '../src/config/api';

export default function GamificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tab, setTab] = useState<'badges' | 'nearby' | 'checkins' | 'missions'>('badges');
  const [celebration, setCelebration] = useState<{ visible: boolean; name: string; icon: string; color: string; xp: number }>({
    visible: false, name: '', icon: '', color: '', xp: 0,
  });

  // Get user location
  useEffect(() => {
    if (Platform.OS === 'web') {
      navigator.geolocation?.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 41.1496, lng: -8.6109 }) // Default: Porto
      );
    } else {
      setUserLocation({ lat: 41.1496, lng: -8.6109 });
    }
  }, []);

  const { data: profile, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: () => getGamificationProfile(),
  });

  const { data: missionsData, refetch: refetchMissions } = useQuery({
    queryKey: ['missions-my'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/missions/my`);
      if (!res.ok) return { missions: [] };
      return res.json();
    },
  });

  const claimMission = useMutation({
    mutationFn: async (missionId: string) => {
      const res = await fetch(`${API_BASE}/missions/${missionId}/claim`, { method: 'POST' });
      if (!res.ok) throw new Error('Não foi possível reclamar a recompensa');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions-my'] });
      queryClient.invalidateQueries({ queryKey: ['gamification-profile'] });
    },
  });

  const { data: nearbyData } = useQuery({
    queryKey: ['nearby-checkins', userLocation?.lat, userLocation?.lng],
    queryFn: () => getNearbyCheckins(userLocation!.lat, userLocation!.lng, 10),
    enabled: !!userLocation,
  });

  const checkinMutation = useMutation({
    mutationFn: (poiId: string) => doCheckin(userLocation!.lat, userLocation!.lng, poiId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gamification-profile'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-checkins'] });
      if (data.success) {
        const badges = data.new_badges?.map(b => b.name).join(', ');
        const msg = `+${data.xp_earned} XP${badges ? `\nNovo badge: ${badges}!` : ''}`;
        // Trigger celebration if new badges earned
        if (data.new_badges && data.new_badges.length > 0) {
          const b = data.new_badges[0];
          setCelebration({ visible: true, name: b.name, icon: b.icon || 'military-tech', color: b.color || colors.terracotta[500], xp: data.xp_earned || 0 });
        } else {
          if (Platform.OS === 'web') {
            window.alert(`${data.message}\n${msg}`);
          } else {
            Alert.alert('Check-in!', `${data.message}\n${msg}`);
          }
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(data.message);
        } else {
          Alert.alert('Aviso', data.message);
        }
      }
    },
  });

  if (isLoading || !profile) {
    return (
      <View style={[s.container, { paddingTop: 80 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ paddingHorizontal: 16 }}>
          <SkeletonCard variant="heritage" count={4} />
        </View>
      </View>
    );
  }

  const xpPct = ((profile.xp % 100) / 100) * 100;

  return (
    <View style={s.container} data-testid="gamification-screen">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} data-testid="gamification-back">
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Conquistas</Text>
          <Text style={s.headerSub}>Explore e colecione badges</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.terracotta[500]} />}
      >
        {/* Profile Hero */}
        <View style={s.heroCard}>
          <LinearGradient colors={[colors.terracotta[500], colors.terracotta[700]]} style={s.heroGrad}>
            <View style={s.levelBadge}>
              <Text style={s.levelText}>Nv. {profile.level}</Text>
            </View>
            <View style={s.heroRow}>
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{profile.total_checkins}</Text>
                <Text style={s.heroStatLabel}>Check-ins</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{profile.xp}</Text>
                <Text style={s.heroStatLabel}>XP Total</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStat}>
                <Text style={s.heroStatVal}>{profile.earned_badges_count}/{profile.total_badges}</Text>
                <Text style={s.heroStatLabel}>Badges</Text>
              </View>
            </View>
            <View style={s.xpBar}>
              <View style={s.xpTrack}>
                <View style={[s.xpFill, { width: `${xpPct}%` }]} />
              </View>
              <Text style={s.xpText}>{profile.xp_to_next_level} XP para o nível {profile.level + 1}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Tab Selector */}
        <View style={s.tabRow}>
          {[
            { id: 'badges' as const, label: 'Badges', icon: 'military-tech' },
            { id: 'missions' as const, label: 'Missões', icon: 'flag' },
            { id: 'nearby' as const, label: 'Perto', icon: 'near-me' },
            { id: 'checkins' as const, label: 'Histórico', icon: 'history' },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, tab === t.id && s.tabActive]}
              onPress={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
            >
              <MaterialIcons name={t.icon as any} size={18} color={tab === t.id ? colors.terracotta[500] : colors.gray[400]} />
              <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Badges Tab */}
        {tab === 'badges' && (
          <View style={s.badgesGrid}>
            {profile.badges.map((badge, index) => (
              <AnimatedListItem key={badge.id} index={index} stagger={40}>
              <View style={[s.badgeCard, badge.earned && s.badgeCardEarned]} data-testid={`badge-${badge.id}`}>
                <View style={[s.badgeIcon, { backgroundColor: badge.earned ? badge.color + '20' : colors.gray[100] }]}>
                  <MaterialIcons name={badge.icon as any} size={24} color={badge.earned ? badge.color : colors.gray[300]} />
                </View>
                <Text style={[s.badgeName, !badge.earned && { color: colors.gray[400] }]} numberOfLines={1}>{badge.name}</Text>
                <Text style={s.badgeDesc} numberOfLines={2}>{badge.description}</Text>
                <View style={s.badgeProgress}>
                  <View style={s.badgeProgressTrack}>
                    <View style={[s.badgeProgressFill, { width: `${badge.progress_pct}%`, backgroundColor: badge.earned ? badge.color : colors.gray[300] }]} />
                  </View>
                  <Text style={s.badgeProgressText}>{badge.progress}/{badge.threshold}</Text>
                </View>
                {badge.earned && (
                  <View style={s.earnedRow}>
                    <View style={[s.earnedTag, { backgroundColor: badge.color }]}>
                      <MaterialIcons name="check" size={10} color="#FFF" />
                    </View>
                    <ShareButton
                      title={badge.name}
                      description={`Ganhei o badge ${badge.name} no Portugal Vivo! \u{1F3C6}`}
                      iconSize={16}
                      iconColor={badge.color}
                      style={s.badgeShareBtn}
                    />
                  </View>
                )}
              </View>
              </AnimatedListItem>
            ))}
          </View>
        )}

        {/* Missions Tab */}
        {tab === 'missions' && (
          <View style={s.missionsList}>
            {!missionsData?.missions?.length ? (
              <View style={s.emptyState}>
                <MaterialIcons name="flag" size={40} color={colors.gray[300]} />
                <Text style={s.emptyText}>Sem missões activas</Text>
                <Text style={s.emptySubtext}>Volta na próxima semana!</Text>
              </View>
            ) : (
              missionsData.missions.map((mission: Mission) => (
                <MissionCard
                  key={mission.mission_id}
                  mission={mission}
                  onClaim={(id) => claimMission.mutate(id)}
                  onPress={(m) => {}}
                />
              ))
            )}
          </View>
        )}

        {/* Nearby Tab */}
        {tab === 'nearby' && (
          <View style={s.nearbyList}>
            {!userLocation ? (
              <View style={s.emptyState}>
                <MaterialIcons name="gps-off" size={40} color={colors.gray[300]} />
                <Text style={s.emptyText}>A obter localização...</Text>
              </View>
            ) : nearbyData?.pois.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialIcons name="explore-off" size={40} color={colors.gray[300]} />
                <Text style={s.emptyText}>Nenhum POI nas proximidades</Text>
              </View>
            ) : (
              nearbyData?.pois.map((poi, index) => (
                <AnimatedListItem key={poi.id} index={index} stagger={60}>
                <View style={s.nearbyCard} data-testid={`nearby-${poi.id}`}>
                  <View style={s.nearbyInfo}>
                    <Text style={s.nearbyName} numberOfLines={1}>{poi.name}</Text>
                    <View style={s.nearbyMeta}>
                      <Text style={s.nearbyCategory}>{poi.category}</Text>
                      <Text style={s.nearbyDist}>{poi.distance_m < 1000 ? `${poi.distance_m}m` : `${(poi.distance_m / 1000).toFixed(1)}km`}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[s.checkinBtn, !poi.can_checkin && s.checkinBtnDisabled]}
                    onPress={() => poi.can_checkin && checkinMutation.mutate(poi.id)}
                    disabled={!poi.can_checkin || checkinMutation.isPending}
                    data-testid={`checkin-btn-${poi.id}`}
                  >
                    {checkinMutation.isPending && checkinMutation.variables === poi.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name={poi.can_checkin ? "check-circle" : "radio-button-unchecked"} size={16} color={poi.can_checkin ? "#FFF" : colors.gray[400]} />
                        <Text style={[s.checkinBtnText, !poi.can_checkin && { color: colors.gray[400] }]}>
                          {poi.can_checkin ? 'Check-in' : `${poi.distance_m}m`}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                </AnimatedListItem>
              ))
            )}
          </View>
        )}

        {/* Checkins History Tab */}
        {tab === 'checkins' && (
          <View style={s.historyList}>
            {profile.recent_checkins.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialIcons name="explore" size={40} color={colors.gray[300]} />
                <Text style={s.emptyText}>Ainda sem check-ins</Text>
                <Text style={s.emptySubtext}>Visite locais e faça check-in!</Text>
              </View>
            ) : (
              profile.recent_checkins.map((ci, i) => (
                <View key={i} style={s.historyCard}>
                  <View style={s.historyDot} />
                  <View style={s.historyInfo}>
                    <Text style={s.historyName}>{ci.poi_name}</Text>
                    <Text style={s.historyMeta}>{ci.poi_category} | {ci.poi_region}</Text>
                  </View>
                  <View style={s.historyXP}>
                    <Text style={s.historyXPText}>+{ci.xp_earned} XP</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BadgeCelebration
        visible={celebration.visible}
        badgeName={celebration.name}
        badgeIcon={celebration.icon}
        badgeColor={celebration.color}
        pointsEarned={celebration.xp}
        onDone={() => setCelebration(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    backgroundColor: colors.forest[700], paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Hero
  heroCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden', ...shadows.lg },
  heroGrad: { padding: 20, alignItems: 'center' },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14,
    paddingVertical: 4, borderRadius: 20, marginBottom: 14,
  },
  levelText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  heroRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-around' },
  heroStat: { alignItems: 'center' },
  heroStatVal: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' },
  xpBar: { width: '100%', marginTop: 16 },
  xpTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' },
  xpFill: { height: 6, backgroundColor: '#FFF', borderRadius: 3 },
  xpText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 4 },

  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, backgroundColor: colors.background.secondary, borderRadius: 14, padding: 4, ...shadows.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6, borderRadius: 10 },
  tabActive: { backgroundColor: colors.terracotta[50] },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.gray[400] },
  tabTextActive: { color: colors.terracotta[500] },

  // Badges
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  badgeCard: {
    width: '48%', backgroundColor: colors.background.secondary, borderRadius: 16,
    padding: 14, ...shadows.sm, position: 'relative',
  },
  badgeCardEarned: { borderWidth: 1.5, borderColor: colors.terracotta[200] },
  badgeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeName: { fontSize: 13, fontWeight: '700', color: colors.gray[800], marginBottom: 2 },
  badgeDesc: { fontSize: 10, color: colors.gray[400], lineHeight: 14, marginBottom: 8 },
  badgeProgress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeProgressTrack: { flex: 1, height: 4, backgroundColor: colors.gray[100], borderRadius: 2, overflow: 'hidden' },
  badgeProgressFill: { height: 4, borderRadius: 2 },
  badgeProgressText: { fontSize: 9, fontWeight: '600', color: colors.gray[400] },
  earnedTag: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  earnedRow: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeShareBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.08)' },

  // Missions
  missionsList: { paddingHorizontal: 16, marginTop: 12 },

  // Nearby
  nearbyList: { paddingHorizontal: 16, marginTop: 12 },
  nearbyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.secondary,
    borderRadius: 14, padding: 14, marginBottom: 8, ...shadows.sm,
  },
  nearbyInfo: { flex: 1 },
  nearbyName: { fontSize: 14, fontWeight: '600', color: colors.gray[800] },
  nearbyMeta: { flexDirection: 'row', gap: 8, marginTop: 2 },
  nearbyCategory: { fontSize: 11, color: colors.gray[400], textTransform: 'capitalize' },
  nearbyDist: { fontSize: 11, fontWeight: '600', color: colors.ocean[500] },
  checkinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.terracotta[500], paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 10,
  },
  checkinBtnDisabled: { backgroundColor: colors.gray[100] },
  checkinBtnText: { fontSize: 12, fontWeight: '600', color: '#FFF' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: colors.gray[400], marginTop: 12 },
  emptySubtext: { fontSize: 12, color: colors.gray[300], marginTop: 4 },

  // History
  historyList: { paddingHorizontal: 16, marginTop: 12 },
  historyCard: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100], gap: 12,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.terracotta[500] },
  historyInfo: { flex: 1 },
  historyName: { fontSize: 13, fontWeight: '600', color: colors.gray[800] },
  historyMeta: { fontSize: 11, color: colors.gray[400], textTransform: 'capitalize' },
  historyXP: { backgroundColor: colors.terracotta[50], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  historyXPText: { fontSize: 12, fontWeight: '700', color: colors.terracotta[500] },
});
