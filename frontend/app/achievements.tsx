import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import OptimizedImage from '../src/components/OptimizedImage';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getUserProgress, getLeaderboard, getExplorerProfile, getLeaderboardRegions, Badge, LeaderboardEntry, ExplorerProfile } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

const PERIODS = [
  { key: 'all', label: 'Geral' },
  { key: 'month', label: 'Mensal' },
  { key: 'week', label: 'Semanal' },
] as const;

const REGION_LABELS: Record<string, string> = {
  norte: 'Norte', centro: 'Centro', lisboa: 'Lisboa',
  alentejo: 'Alentejo', algarve: 'Algarve', acores: 'Acores', madeira: 'Madeira',
};

const REGION_COLORS: Record<string, string> = {
  norte: '#059669', centro: '#D97706', lisboa: '#DC2626',
  alentejo: '#CA8A04', algarve: '#0EA5E9', acores: '#7C3AED', madeira: '#EC4899',
};

const MEDAL_COLORS = ['#D4A574', '#94A3B8', '#CD7F32'];

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, sessionToken, login } = useAuth();
  const [activeTab, setActiveTab] = useState<'badges' | 'leaderboard'>('leaderboard');
  const [period, setPeriod] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [explorerModal, setExplorerModal] = useState<ExplorerProfile | null>(null);

  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } = useQuery({
    queryKey: ['userProgress', sessionToken],
    queryFn: () => getUserProgress(sessionToken!),
    enabled: isAuthenticated && !!sessionToken,
  });

  const { data: lbData, isLoading: lbLoading } = useQuery({
    queryKey: ['leaderboard', period, selectedRegion],
    queryFn: () => getLeaderboard(20, period, selectedRegion),
  });

  const { data: regions } = useQuery({
    queryKey: ['leaderboard-regions'],
    queryFn: getLeaderboardRegions,
  });

  const leaderboard = lbData?.leaderboard ?? [];

  const openExplorer = async (userId: string) => {
    try {
      const profile = await getExplorerProfile(userId);
      setExplorerModal(profile);
    } catch { /* ignore */ }
  };

  const showLoginForBadges = !isAuthenticated && activeTab === 'badges';

  const renderBadge = (badge: Badge) => {
    const earned = badge.earned;
    return (
      <View key={badge.id} style={[s.badgeCard, !earned && s.badgeLocked]} data-testid={`badge-${badge.id}`}>
        <View style={[s.badgeIcon, { backgroundColor: (earned ? badge.color : '#64748B') + '20' }]}>
          <MaterialIcons name={badge.icon as any} size={32} color={earned ? badge.color : '#64748B'} />
          {earned && <View style={s.checkMark}><MaterialIcons name="check-circle" size={16} color="#22C55E" /></View>}
        </View>
        <Text style={[s.badgeName, !earned && { color: '#94A3B8' }]}>{badge.name}</Text>
        <Text style={s.badgeDesc}>{badge.description}</Text>
        {!earned && (
          <View style={s.progressWrap}>
            <View style={s.progressBar}><View style={[s.progressFill, { width: `${badge.progress || 0}%`, backgroundColor: badge.color }]} /></View>
            <Text style={s.progressText}>{badge.current || 0}/{badge.requirement}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderPodium = () => {
    if (leaderboard.length < 1) return null;
    const top3 = leaderboard.slice(0, 3);
    const ordered = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]];
    const heights = top3.length >= 3 ? [80, 110, 60] : top3.length === 2 ? [80, 110] : [110];
    return (
      <View style={s.podiumWrap} data-testid="leaderboard-podium">
        {ordered.map((entry, i) => {
          const realIdx = top3.length >= 3 ? [1, 0, 2][i] : top3.length === 2 ? [1, 0][i] : [0][i];
          return (
            <TouchableOpacity key={entry.user_id} style={s.podiumCol} onPress={() => openExplorer(entry.user_id)} activeOpacity={0.7}>
              <View style={s.podiumAvatar}>
                {entry.picture ? (
                  <OptimizedImage uri={entry.picture} style={s.podiumImg} />
                ) : (
                  <View style={[s.podiumImgPlaceholder, { backgroundColor: MEDAL_COLORS[realIdx] }]}>
                    <Text style={s.avatarLetter}>{entry.name.charAt(0)}</Text>
                  </View>
                )}
                <View style={[s.medalBadge, { backgroundColor: MEDAL_COLORS[realIdx] }]}>
                  <Text style={s.medalText}>{realIdx + 1}</Text>
                </View>
              </View>
              <Text style={s.podiumName} numberOfLines={1}>{entry.name.split(' ')[0]}</Text>
              <Text style={s.podiumScore}>{entry.score} pts</Text>
              <View style={[s.podiumBar, { height: heights[i], backgroundColor: MEDAL_COLORS[realIdx] + '40' }]}>
                <Text style={[s.podiumRank, { color: MEDAL_COLORS[realIdx] }]}>#{realIdx + 1}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderLeaderboardItem = (entry: LeaderboardEntry, index: number) => {
    if (index < 3) return null;
    const isCurrent = entry.user_id === user?.user_id;
    return (
      <TouchableOpacity
        key={entry.user_id}
        style={[s.lbItem, isCurrent && s.lbItemCurrent]}
        onPress={() => openExplorer(entry.user_id)}
        activeOpacity={0.7}
        data-testid={`leaderboard-item-${index}`}
      >
        <View style={s.lbRank}><Text style={s.rankNum}>{entry.rank}</Text></View>
        {entry.picture ? (
          <OptimizedImage uri={entry.picture} style={s.lbAvatar} />
        ) : (
          <View style={s.lbAvatarPlaceholder}><Text style={s.avatarText}>{entry.name.charAt(0)}</Text></View>
        )}
        <View style={s.lbInfo}>
          <Text style={s.lbName}>{entry.name}</Text>
          <View style={s.lbStats}>
            <MaterialIcons name="stars" size={14} color="#C49A6C" />
            <Text style={s.lbPts}>{entry.score} pts</Text>
            {entry.total_checkins ? <Text style={s.lbCheckins}>{entry.total_checkins} check-ins</Text> : null}
          </View>
        </View>
        <View style={s.levelBadge}><Text style={s.levelText}>Nv.{entry.level}</Text></View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} data-testid="achievements-back">
          <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Conquistas</Text>
        <View style={{ width: 44 }} />
      </View>

      {isAuthenticated && progress && (
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <MaterialIcons name="stars" size={24} color="#C49A6C" />
              <Text style={s.statVal}>{progress.total_points}</Text>
              <Text style={s.statLabel}>Pontos</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statItem}>
              <MaterialIcons name="emoji-events" size={24} color="#8B5CF6" />
              <Text style={s.statVal}>{progress.badges.filter(b => b.earned).length}/{progress.badges.length}</Text>
              <Text style={s.statLabel}>Badges</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statItem}>
              <MaterialIcons name="explore" size={24} color="#22C55E" />
              <Text style={s.statVal}>{progress.visits_count}</Text>
              <Text style={s.statLabel}>Visitas</Text>
            </View>
          </View>
        </View>
      )}

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, activeTab === 'badges' && s.tabActive]} onPress={() => setActiveTab('badges')} data-testid="tab-badges">
          <MaterialIcons name="emoji-events" size={20} color={activeTab === 'badges' ? '#C49A6C' : '#64748B'} />
          <Text style={[s.tabText, activeTab === 'badges' && s.tabTextActive]}>Badges</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'leaderboard' && s.tabActive]} onPress={() => setActiveTab('leaderboard')} data-testid="tab-leaderboard">
          <MaterialIcons name="leaderboard" size={20} color={activeTab === 'leaderboard' ? '#C49A6C' : '#64748B'} />
          <Text style={[s.tabText, activeTab === 'leaderboard' && s.tabTextActive]}>Ranking</Text>
        </TouchableOpacity>
      </View>

      {showLoginForBadges ? (
        <View style={s.loginPrompt}>
          <MaterialIcons name="emoji-events" size={64} color="#C49A6C" />
          <Text style={s.loginTitle}>Desbloqueie Conquistas</Text>
          <Text style={s.loginSub}>Inicie sessao para acompanhar o seu progresso e ganhar badges exclusivos!</Text>
          <TouchableOpacity style={s.loginBtn} onPress={login} data-testid="achievements-login">
            <MaterialIcons name="login" size={20} color="#2E5E4E" />
            <Text style={s.loginBtnText}>Entrar com Google</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'badges' ? (
        <ScrollView style={s.content} showsVerticalScrollIndicator={false} contentContainerStyle={s.badgesGrid}
          refreshControl={<RefreshControl refreshing={progressLoading} onRefresh={refetchProgress} tintColor="#C49A6C" />}>
          {progressLoading ? <ActivityIndicator size="large" color="#C49A6C" style={s.loader} /> : progress ? (
            <>
              {progress.badges.filter(b => b.earned).length > 0 && (
                <><Text style={s.sectionTitle}>Conquistados</Text><View style={s.badgesRow}>{progress.badges.filter(b => b.earned).map(renderBadge)}</View></>
              )}
              <Text style={s.sectionTitle}>Por Conquistar</Text>
              <View style={s.badgesRow}>{progress.badges.filter(b => !b.earned).map(renderBadge)}</View>
            </>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView style={s.content} showsVerticalScrollIndicator={false} contentContainerStyle={s.lbContent}>
          {/* Period Filter */}
          <View style={s.periodRow} data-testid="period-filters">
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[s.periodBtn, period === p.key && s.periodBtnActive]}
                onPress={() => { setPeriod(p.key); setSelectedRegion(''); }}
                data-testid={`period-${p.key}`}
              >
                <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Region Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.regionScroll} contentContainerStyle={s.regionRow}>
            <TouchableOpacity
              style={[s.regionChip, !selectedRegion && s.regionChipActive]}
              onPress={() => setSelectedRegion('')}
              data-testid="region-all"
            >
              <Text style={[s.regionText, !selectedRegion && s.regionTextActive]}>Todas</Text>
            </TouchableOpacity>
            {(regions || []).filter(r => r.players > 0).map(r => (
              <TouchableOpacity
                key={r.region}
                style={[s.regionChip, selectedRegion === r.region && { backgroundColor: REGION_COLORS[r.region] + '30', borderColor: REGION_COLORS[r.region] }]}
                onPress={() => setSelectedRegion(selectedRegion === r.region ? '' : r.region)}
                data-testid={`region-${r.region}`}
              >
                <Text style={[s.regionText, selectedRegion === r.region && { color: REGION_COLORS[r.region] }]}>{REGION_LABELS[r.region] || r.region} ({r.players})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {lbLoading ? <ActivityIndicator size="large" color="#C49A6C" style={s.loader} /> : leaderboard.length > 0 ? (
            <>
              {renderPodium()}
              <View style={s.lbListHeader}>
                <Text style={s.lbListTitle}>Ranking Completo</Text>
                <Text style={s.lbListCount}>{lbData?.total || 0} exploradores</Text>
              </View>
              {leaderboard.map((entry, idx) => renderLeaderboardItem(entry, idx))}
            </>
          ) : (
            <View style={s.emptyState}>
              <MaterialIcons name="people" size={48} color="#64748B" />
              <Text style={s.emptyText}>Ainda nao ha participantes</Text>
              <Text style={s.emptySubText}>Visite monumentos para aparecer no ranking!</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Explorer Profile Modal */}
      <Modal visible={!!explorerModal} animationType="slide" transparent onRequestClose={() => setExplorerModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Perfil do Explorador</Text>
              <TouchableOpacity onPress={() => setExplorerModal(null)} data-testid="close-explorer-modal">
                <MaterialIcons name="close" size={24} color="#FAF8F3" />
              </TouchableOpacity>
            </View>
            {explorerModal && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.explorerHeader}>
                  {explorerModal.picture ? (
                    <OptimizedImage uri={explorerModal.picture} style={s.explorerAvatar} />
                  ) : (
                    <View style={s.explorerAvatarPlaceholder}><Text style={s.explorerAvatarText}>{explorerModal.name.charAt(0)}</Text></View>
                  )}
                  <Text style={s.explorerName}>{explorerModal.name}</Text>
                  <View style={s.explorerMeta}>
                    <Text style={s.explorerLevel}>Nivel {explorerModal.level}</Text>
                    <Text style={s.explorerRank}>#{explorerModal.rank}</Text>
                  </View>
                </View>
                <View style={s.xpCard}>
                  <View style={s.xpRow}>
                    <Text style={s.xpLabel}>XP</Text>
                    <Text style={s.xpValue}>{explorerModal.xp}/{explorerModal.next_level_xp}</Text>
                  </View>
                  <View style={s.xpBar}>
                    <View style={[s.xpFill, { width: `${Math.min(100, (explorerModal.xp / explorerModal.next_level_xp) * 100)}%` }]} />
                  </View>
                </View>
                <View style={s.explorerStats}>
                  <View style={s.explorerStat}>
                    <MaterialIcons name="place" size={20} color="#C49A6C" />
                    <Text style={s.explorerStatVal}>{explorerModal.total_checkins}</Text>
                    <Text style={s.explorerStatLbl}>Check-ins</Text>
                  </View>
                  <View style={s.explorerStat}>
                    <MaterialIcons name="emoji-events" size={20} color="#8B5CF6" />
                    <Text style={s.explorerStatVal}>{explorerModal.badges_count}</Text>
                    <Text style={s.explorerStatLbl}>Badges</Text>
                  </View>
                  <View style={s.explorerStat}>
                    <MaterialIcons name="local-fire-department" size={20} color="#EF4444" />
                    <Text style={s.explorerStatVal}>{explorerModal.streak_days}</Text>
                    <Text style={s.explorerStatLbl}>Streak</Text>
                  </View>
                </View>
                {explorerModal.region_stats.length > 0 && (
                  <View style={s.regionBreakdown}>
                    <Text style={s.sectionTitle}>Regioes Exploradas</Text>
                    {explorerModal.region_stats.map(rs => (
                      <View key={rs.region} style={s.regionStatRow}>
                        <View style={[s.regionDot, { backgroundColor: rs.color }]} />
                        <Text style={s.regionStatName}>{REGION_LABELS[rs.region] || rs.region}</Text>
                        <View style={s.regionStatBar}>
                          <View style={[s.regionStatFill, { width: `${Math.min(100, (rs.count / Math.max(1, explorerModal.total_checkins)) * 100)}%`, backgroundColor: rs.color }]} />
                        </View>
                        <Text style={s.regionStatCount}>{rs.count}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2E5E4E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#264E41', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FAF8F3' },
  loginPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loginTitle: { fontSize: 24, fontWeight: '700', color: '#FAF8F3', marginTop: 16 },
  loginSub: { fontSize: 15, color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#C49A6C', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 24, gap: 8 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#2E5E4E' },
  statsCard: { backgroundColor: '#264E41', marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2F2A' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '800', color: '#FAF8F3', marginTop: 4 },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  statDiv: { width: 1, height: 40, backgroundColor: '#2A2F2A' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, backgroundColor: '#264E41', borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6 },
  tabActive: { backgroundColor: '#2E5E4E' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#C49A6C' },
  content: { flex: 1, marginTop: 16 },
  badgesGrid: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FAF8F3', marginBottom: 12, marginTop: 8 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  badgeCard: { width: '47%', backgroundColor: '#264E41', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2A2F2A' },
  badgeLocked: { opacity: 0.7 },
  badgeIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12, position: 'relative' },
  checkMark: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#264E41', borderRadius: 10 },
  badgeName: { fontSize: 14, fontWeight: '700', color: '#FAF8F3', textAlign: 'center' },
  badgeDesc: { fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 4, lineHeight: 16 },
  progressWrap: { width: '100%', marginTop: 12 },
  progressBar: { height: 6, backgroundColor: '#2E5E4E', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 10, color: '#64748B', textAlign: 'center', marginTop: 4 },
  lbContent: { paddingHorizontal: 16, paddingBottom: 20 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#264E41', alignItems: 'center', borderWidth: 1, borderColor: '#2A2F2A' },
  periodBtnActive: { backgroundColor: '#C49A6C20', borderColor: '#C49A6C' },
  periodText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  periodTextActive: { color: '#C49A6C' },
  regionScroll: { marginBottom: 16 },
  regionRow: { gap: 8 },
  regionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#264E41', borderWidth: 1, borderColor: '#2A2F2A' },
  regionChipActive: { backgroundColor: '#C49A6C20', borderColor: '#C49A6C' },
  regionText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  regionTextActive: { color: '#C49A6C' },
  podiumWrap: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 24, gap: 8, paddingTop: 16 },
  podiumCol: { alignItems: 'center', width: 100 },
  podiumAvatar: { position: 'relative', marginBottom: 8 },
  podiumImg: { width: 56, height: 56, borderRadius: 28 },
  podiumImgPlaceholder: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 22, fontWeight: '800', color: '#1A0F0A' },
  medalBadge: { position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#2E5E4E' },
  medalText: { fontSize: 11, fontWeight: '800', color: '#1A0F0A' },
  podiumName: { fontSize: 13, fontWeight: '600', color: '#FAF8F3', marginBottom: 2 },
  podiumScore: { fontSize: 11, fontWeight: '700', color: '#C49A6C', marginBottom: 6 },
  podiumBar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8, alignItems: 'center', justifyContent: 'center' },
  podiumRank: { fontSize: 18, fontWeight: '900' },
  lbListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  lbListTitle: { fontSize: 16, fontWeight: '700', color: '#FAF8F3' },
  lbListCount: { fontSize: 12, color: '#64748B' },
  lbItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#264E41', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2A2F2A' },
  lbItemCurrent: { borderColor: '#C49A6C', backgroundColor: '#C49A6C10' },
  lbRank: { width: 36, alignItems: 'center' },
  rankNum: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  lbAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  lbAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#C49A6C', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#2E5E4E' },
  lbInfo: { flex: 1 },
  lbName: { fontSize: 15, fontWeight: '600', color: '#FAF8F3' },
  lbStats: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  lbPts: { fontSize: 12, color: '#C49A6C', fontWeight: '600' },
  lbCheckins: { fontSize: 12, color: '#64748B', marginLeft: 8 },
  levelBadge: { backgroundColor: '#8B5CF620', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  levelText: { fontSize: 12, fontWeight: '700', color: '#8B5CF6' },
  loader: { marginTop: 40 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#64748B', marginTop: 12 },
  emptySubText: { fontSize: 13, color: '#475569', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#264E41', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FAF8F3' },
  explorerHeader: { alignItems: 'center', marginBottom: 20 },
  explorerAvatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  explorerAvatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#C49A6C', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  explorerAvatarText: { fontSize: 28, fontWeight: '800', color: '#2E5E4E' },
  explorerName: { fontSize: 20, fontWeight: '700', color: '#FAF8F3' },
  explorerMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  explorerLevel: { fontSize: 14, fontWeight: '600', color: '#C49A6C', backgroundColor: '#C49A6C20', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  explorerRank: { fontSize: 14, fontWeight: '600', color: '#8B5CF6', backgroundColor: '#8B5CF620', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  xpCard: { backgroundColor: '#2E5E4E', borderRadius: 12, padding: 14, marginBottom: 16 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  xpLabel: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  xpValue: { fontSize: 13, fontWeight: '700', color: '#C49A6C' },
  xpBar: { height: 8, backgroundColor: '#1A3A2E', borderRadius: 4, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 4, backgroundColor: '#C49A6C' },
  explorerStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#2E5E4E', borderRadius: 12, padding: 16, marginBottom: 16 },
  explorerStat: { alignItems: 'center' },
  explorerStatVal: { fontSize: 20, fontWeight: '800', color: '#FAF8F3', marginTop: 4 },
  explorerStatLbl: { fontSize: 11, color: '#64748B', marginTop: 2 },
  regionBreakdown: { marginTop: 4 },
  regionStatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  regionDot: { width: 10, height: 10, borderRadius: 5 },
  regionStatName: { fontSize: 13, fontWeight: '600', color: '#FAF8F3', width: 70 },
  regionStatBar: { flex: 1, height: 8, backgroundColor: '#1A3A2E', borderRadius: 4, overflow: 'hidden' },
  regionStatFill: { height: '100%', borderRadius: 4 },
  regionStatCount: { fontSize: 12, fontWeight: '700', color: '#64748B', width: 30, textAlign: 'right' },
});
