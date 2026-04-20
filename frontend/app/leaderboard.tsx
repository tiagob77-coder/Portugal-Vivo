/**
 * Leaderboard Screen - Top Explorers + Rankings
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useRouter, Stack } from 'expo-router';
import api from '../src/services/api';

const PERIODS = [
  { id: 'all', label: 'Total' },
  { id: 'month', label: 'Este Mês' },
  { id: 'week', label: 'Semana' },
];

const REGIONS = [
  { id: '', label: 'Portugal' },
  { id: 'norte', label: 'Norte' },
  { id: 'centro', label: 'Centro' },
  { id: 'lisboa', label: 'Lisboa' },
  { id: 'alentejo', label: 'Alentejo' },
  { id: 'algarve', label: 'Algarve' },
  { id: 'acores', label: 'Açores' },
  { id: 'madeira', label: 'Madeira' },
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('all');
  const [region, setRegion] = useState('');

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard', period, region],
    queryFn: async () => {
      const params = new URLSearchParams({ period, limit: '20' });
      if (region) params.append('region', region);
      const res = await api.get(`/leaderboard/top?${params.toString()}`);
      return res.data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['leaderboard-stats'],
    queryFn: async () => {
      const res = await api.get('/leaderboard/stats');
      return res.data;
    },
  });

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return { icon: 'emoji-events', color: '#C49A6C', bg: '#FEF3C7' };
    if (rank === 2) return { icon: 'workspace-premium', color: '#94A3B8', bg: '#F1F5F9' };
    if (rank === 3) return { icon: 'workspace-premium', color: '#CD7F32', bg: '#FEF3C7' };
    return null;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#C49A6C', '#B08556']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <MaterialIcons name="leaderboard" size={36} color="#FFF" />
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <Text style={styles.headerSub}>Os melhores exploradores de Portugal</Text>

          {/* Stats */}
          {stats && (
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.total_explorers}</Text>
                <Text style={styles.statLabel}>Exploradores</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.total_checkins}</Text>
                <Text style={styles.statLabel}>Check-ins</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.total_xp}</Text>
                <Text style={styles.statLabel}>XP Total</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Period Filter */}
        <View style={styles.periodFilter}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodBtn, period === p.id && styles.periodBtnActive]}
              onPress={() => setPeriod(p.id)}
            >
              <Text style={[styles.periodText, period === p.id && styles.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Region Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 4 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {REGIONS.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.periodBtn, region === r.id && styles.periodBtnActive, { marginRight: 0 }]}
              onPress={() => setRegion(r.id)}
            >
              <Text style={[styles.periodText, region === r.id && styles.periodTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Leaderboard List */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#C49A6C" style={{ marginTop: 40 }} />
          ) : (leaderboard?.leaderboard || []).length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="explore" size={48} color="#C8C3B8" />
              <Text style={styles.emptyText}>Ainda sem exploradores</Text>
              <Text style={styles.emptySubtext}>Faça check-in em POIs para aparecer no ranking!</Text>
            </View>
          ) : (
            (leaderboard?.leaderboard || []).map((explorer: any) => {
              const medal = getMedalIcon(explorer.rank);
              return (
                <View key={explorer.user_id} style={[styles.explorerCard, explorer.rank <= 3 && styles.topCard]}>
                  {/* Rank */}
                  <View style={[styles.rankBadge, { backgroundColor: medal?.bg || '#F1F5F9' }]}>
                    {medal ? (
                      <MaterialIcons name={medal.icon as any} size={20} color={medal.color} />
                    ) : (
                      <Text style={styles.rankNumber}>{explorer.rank}</Text>
                    )}
                  </View>

                  {/* Avatar */}
                  <View style={[styles.avatar, { backgroundColor: explorer.avatar_color }]}>
                    <Text style={styles.avatarText}>
                      {(explorer.display_name || 'E')[0].toUpperCase()}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.explorerInfo}>
                    <Text style={styles.explorerName} numberOfLines={1}>{explorer.display_name}</Text>
                    <View style={styles.explorerMeta}>
                      <Text style={styles.levelBadge}>Nv. {explorer.level}</Text>
                      {explorer.top_region ? (
                        <Text style={styles.regionTag}>{explorer.top_region}</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Stats */}
                  <View style={styles.explorerStats}>
                    <Text style={styles.xpValue}>{explorer.xp} XP</Text>
                    <View style={styles.miniStats}>
                      <MaterialIcons name="check-circle" size={12} color="#22C55E" />
                      <Text style={styles.miniStatText}>{explorer.total_checkins}</Text>
                      <MaterialIcons name="military-tech" size={12} color="#C49A6C" />
                      <Text style={styles.miniStatText}>{explorer.badges_count}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Top Regions */}
        {stats?.top_regions && stats.top_regions.length > 0 && (
          <View style={styles.regionsSection}>
            <Text style={styles.sectionTitle}>Regiões Mais Exploradas</Text>
            <View style={styles.regionsGrid}>
              {stats.top_regions.map((r: any, i: number) => (
                <View key={r.region} style={styles.regionCard}>
                  <Text style={styles.regionRank}>#{i + 1}</Text>
                  <Text style={styles.regionName}>{r.region}</Text>
                  <Text style={styles.regionCount}>{r.count} check-ins</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F3' },
  header: { paddingTop: 50, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 50, left: 16, padding: 6 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginTop: 8 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 18, gap: 12 },
  statBox: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  periodFilter: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  periodBtnActive: { backgroundColor: '#C49A6C' },
  periodText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  periodTextActive: { color: '#FFF' },
  listContainer: { paddingHorizontal: 20, marginTop: 16 },
  explorerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F2EDE4', gap: 12 },
  topCard: { borderColor: '#FDE68A' },
  rankBadge: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rankNumber: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  explorerInfo: { flex: 1 },
  explorerName: { fontSize: 14, fontWeight: '700', color: '#2E5E4E' },
  explorerMeta: { flexDirection: 'row', gap: 6, marginTop: 3 },
  levelBadge: { fontSize: 11, fontWeight: '600', color: '#C49A6C', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  regionTag: { fontSize: 11, fontWeight: '500', color: '#8B5CF6', backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, textTransform: 'capitalize' },
  explorerStats: { alignItems: 'flex-end' },
  xpValue: { fontSize: 14, fontWeight: '800', color: '#C49A6C' },
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  miniStatText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 50 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#64748B', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  regionsSection: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2E5E4E', marginBottom: 12 },
  regionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  regionCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#F2EDE4', minWidth: 100, flex: 1 },
  regionRank: { fontSize: 11, fontWeight: '700', color: '#C49A6C' },
  regionName: { fontSize: 14, fontWeight: '700', color: '#2E5E4E', textTransform: 'capitalize', marginTop: 2 },
  regionCount: { fontSize: 11, color: '#64748B', marginTop: 2 },
});
