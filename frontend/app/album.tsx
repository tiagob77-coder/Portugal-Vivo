/**
 * Álbum-Memória — diário digital de viagem
 * Agrega: check-ins, badges ganhos, POIs favoritos e histórias lidas.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { getGamificationProfile, GamificationProfile } from '../src/services/api';
import { colors, shadows } from '../src/theme';

type AlbumTab = 'visitas' | 'badges' | 'favoritos';

export default function AlbumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<AlbumTab>('visitas');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: (): Promise<GamificationProfile> => getGamificationProfile(),
  });

  const handleShare = async () => {
    if (!profile) return;
    const text = [
      `🇵🇹 O meu Portugal Vivo`,
      ``,
      `📍 ${profile.total_checkins} locais visitados`,
      `🏅 ${profile.earned_badges_count} badges conquistados`,
      `⚡ ${profile.xp} XP · Nível ${profile.level}`,
      ``,
      `Descobre Portugal com a app Portugal Vivo!`,
    ].join('\n');

    if (Platform.OS === 'web') {
      if (navigator.share) { navigator.share({ title: 'O meu Portugal Vivo', text }); }
      else { await navigator.clipboard?.writeText(text); window.alert('Copiado!'); }
    } else {
      Share.share({ message: text });
    }
  };

  if (isLoading) {
    return (
      <View style={[s.container, { paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.terracotta[500]} />
      </View>
    );
  }

  const earnedBadges = (profile?.badges || []).filter((b: any) => b.earned);
  const checkins = profile?.recent_checkins || [];

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <LinearGradient colors={['#1E3A5F', '#2A5F6B']} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>O Meu Álbum</Text>
          <Text style={s.headerSub}>A tua viagem por Portugal</Text>
        </View>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <MaterialIcons name="share" size={20} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats hero */}
      <View style={s.statsRow}>
        {[
          { label: 'Visitas', value: profile?.total_checkins ?? 0, icon: 'place', color: colors.terracotta[500] },
          { label: 'Badges', value: earnedBadges.length, icon: 'military-tech', color: '#C49A6C' },
          { label: 'Nível', value: profile?.level ?? 1, icon: 'trending-up', color: colors.forest[600] },
          { label: 'XP', value: profile?.xp ?? 0, icon: 'bolt', color: '#8B5CF6' },
        ].map(stat => (
          <View key={stat.label} style={s.statCard}>
            <MaterialIcons name={stat.icon as any} size={18} color={stat.color} />
            <Text style={s.statValue}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {[
          { id: 'visitas' as const, label: 'Visitas', icon: 'place' },
          { id: 'badges' as const, label: 'Badges', icon: 'military-tech' },
          { id: 'favoritos' as const, label: 'Favoritos', icon: 'favorite' },
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, tab === t.id && s.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <MaterialIcons name={t.icon as any} size={16} color={tab === t.id ? colors.terracotta[500] : colors.gray[400]} />
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>

        {/* Visitas */}
        {tab === 'visitas' && (
          <View style={s.list}>
            {checkins.length === 0 ? (
              <View style={s.empty}>
                <MaterialIcons name="explore" size={40} color={colors.gray[300]} />
                <Text style={s.emptyText}>Ainda sem visitas</Text>
                <Text style={s.emptySubtext}>Faz check-in em locais para os ver aqui</Text>
              </View>
            ) : checkins.map((ci: any, i: number) => (
              <TouchableOpacity
                key={i}
                style={s.visitCard}
                onPress={() => ci.poi_id && router.push(`/heritage/${ci.poi_id}`)}
              >
                <View style={[s.visitDot, { backgroundColor: colors.terracotta[500] }]} />
                <View style={s.visitInfo}>
                  <Text style={s.visitName}>{ci.poi_name}</Text>
                  <Text style={s.visitMeta}>{ci.poi_category} · {ci.poi_region}</Text>
                </View>
                <View style={s.visitXP}>
                  <Text style={s.visitXPText}>+{ci.xp_earned} XP</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Badges */}
        {tab === 'badges' && (
          <View style={s.badgesGrid}>
            {earnedBadges.length === 0 ? (
              <View style={s.empty}>
                <MaterialIcons name="military-tech" size={40} color={colors.gray[300]} />
                <Text style={s.emptyText}>Ainda sem badges</Text>
                <Text style={s.emptySubtext}>Explora e faz check-in para ganhar badges</Text>
              </View>
            ) : earnedBadges.map((badge: any) => (
              <View key={badge.id} style={[s.badgeCard, { borderColor: badge.color + '40' }]}>
                <View style={[s.badgeIcon, { backgroundColor: badge.color + '20' }]}>
                  <MaterialIcons name={badge.icon as any} size={26} color={badge.color} />
                </View>
                <Text style={s.badgeName} numberOfLines={2}>{badge.name}</Text>
                <Text style={s.badgeDesc} numberOfLines={2}>{badge.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Favoritos */}
        {tab === 'favoritos' && (
          <View style={s.list}>
            <View style={s.empty}>
              <MaterialIcons name="favorite" size={40} color={colors.gray[300]} />
              <Text style={s.emptyText}>Favoritos guardados no perfil</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/profile' as any)}>
                <Text style={s.emptyBtnText}>Ver Perfil</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  shareBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 14, gap: 8 },
  statCard: { flex: 1, backgroundColor: colors.background.secondary, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, ...shadows.sm },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.gray[800] },
  statLabel: { fontSize: 10, color: colors.gray[400], fontWeight: '600' },

  tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.background.secondary, borderRadius: 12, padding: 3, ...shadows.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9 },
  tabActive: { backgroundColor: colors.terracotta[50] },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.gray[400] },
  tabTextActive: { color: colors.terracotta[500] },

  scroll: { flex: 1, marginTop: 12 },
  list: { paddingHorizontal: 16 },

  visitCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray[100], gap: 12 },
  visitDot: { width: 10, height: 10, borderRadius: 5 },
  visitInfo: { flex: 1 },
  visitName: { fontSize: 14, fontWeight: '600', color: colors.gray[800] },
  visitMeta: { fontSize: 11, color: colors.gray[400], textTransform: 'capitalize', marginTop: 2 },
  visitXP: { backgroundColor: colors.terracotta[50], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  visitXPText: { fontSize: 12, fontWeight: '700', color: colors.terracotta[500] },

  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  badgeCard: { width: '47%', backgroundColor: colors.background.secondary, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, ...shadows.sm },
  badgeIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeName: { fontSize: 13, fontWeight: '700', color: colors.gray[800], textAlign: 'center', marginBottom: 4 },
  badgeDesc: { fontSize: 10, color: colors.gray[400], textAlign: 'center', lineHeight: 14 },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.gray[500] },
  emptySubtext: { fontSize: 13, color: colors.gray[400], textAlign: 'center' },
  emptyBtn: { backgroundColor: colors.terracotta[500], paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
