import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getUserProgress, getLeaderboard, Badge, LeaderboardEntry } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, sessionToken, login } = useAuth();
  const [activeTab, setActiveTab] = useState<'badges' | 'leaderboard'>('badges');

  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } = useQuery({
    queryKey: ['userProgress', sessionToken],
    queryFn: () => getUserProgress(sessionToken!),
    enabled: isAuthenticated && !!sessionToken,
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => getLeaderboard(20),
  });

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conquistas</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.loginPrompt}>
          <MaterialIcons name="emoji-events" size={64} color="#F59E0B" />
          <Text style={styles.loginTitle}>Desbloqueie Conquistas</Text>
          <Text style={styles.loginSubtitle}>
            Inicie sessão para acompanhar o seu progresso e ganhar badges exclusivos!
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={login}>
            <MaterialIcons name="login" size={20} color="#0F172A" />
            <Text style={styles.loginButtonText}>Entrar com Google</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderBadgeCard = (badge: Badge) => {
    const isEarned = badge.earned;
    return (
      <View key={badge.id} style={[styles.badgeCard, !isEarned && styles.badgeCardLocked]}>
        <View style={[styles.badgeIcon, { backgroundColor: (isEarned ? badge.color : '#64748B') + '20' }]}>
          <MaterialIcons 
            name={badge.icon as any} 
            size={32} 
            color={isEarned ? badge.color : '#64748B'} 
          />
          {isEarned && (
            <View style={styles.checkMark}>
              <MaterialIcons name="check-circle" size={16} color="#22C55E" />
            </View>
          )}
        </View>
        <Text style={[styles.badgeName, !isEarned && styles.badgeNameLocked]}>{badge.name}</Text>
        <Text style={styles.badgeDescription}>{badge.description}</Text>
        
        {!isEarned && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${badge.progress || 0}%`, backgroundColor: badge.color }]} />
            </View>
            <Text style={styles.progressText}>{badge.current || 0}/{badge.requirement}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderLeaderboardItem = (entry: LeaderboardEntry, index: number) => {
    const isCurrentUser = entry.user_id === user?.user_id;
    return (
      <View key={entry.user_id} style={[styles.leaderboardItem, isCurrentUser && styles.leaderboardItemCurrent]}>
        <View style={styles.leaderboardRank}>
          {index < 3 ? (
            <MaterialIcons 
              name="emoji-events" 
              size={24} 
              color={index === 0 ? '#F59E0B' : index === 1 ? '#94A3B8' : '#CD7F32'} 
            />
          ) : (
            <Text style={styles.rankNumber}>{index + 1}</Text>
          )}
        </View>
        
        {entry.picture ? (
          <Image source={{ uri: entry.picture }} style={styles.leaderboardAvatar} />
        ) : (
          <View style={styles.leaderboardAvatarPlaceholder}>
            <Text style={styles.avatarText}>{entry.name.charAt(0)}</Text>
          </View>
        )}
        
        <View style={styles.leaderboardInfo}>
          <Text style={styles.leaderboardName}>{entry.name}</Text>
          <View style={styles.leaderboardStats}>
            <MaterialIcons name="stars" size={14} color="#F59E0B" />
            <Text style={styles.leaderboardPoints}>{entry.total_points} pts</Text>
            <Text style={styles.leaderboardBadges}>{entry.badges_count} badges</Text>
          </View>
        </View>
        
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Nv.{entry.level}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conquistas</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* User Stats Summary */}
      {progress && (
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="stars" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>{progress.total_points}</Text>
              <Text style={styles.statLabel}>Pontos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="emoji-events" size={24} color="#8B5CF6" />
              <Text style={styles.statValue}>
                {progress.badges.filter(b => b.earned).length}/{progress.badges.length}
              </Text>
              <Text style={styles.statLabel}>Badges</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="explore" size={24} color="#22C55E" />
              <Text style={styles.statValue}>{progress.visits_count}</Text>
              <Text style={styles.statLabel}>Visitas</Text>
            </View>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'badges' && styles.tabActive]}
          onPress={() => setActiveTab('badges')}
        >
          <MaterialIcons 
            name="emoji-events" 
            size={20} 
            color={activeTab === 'badges' ? '#F59E0B' : '#64748B'} 
          />
          <Text style={[styles.tabText, activeTab === 'badges' && styles.tabTextActive]}>
            Badges
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <MaterialIcons 
            name="leaderboard" 
            size={20} 
            color={activeTab === 'leaderboard' ? '#F59E0B' : '#64748B'} 
          />
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
            Ranking
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'badges' ? (
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.badgesGrid}
          refreshControl={
            <RefreshControl
              refreshing={progressLoading}
              onRefresh={refetchProgress}
              tintColor="#F59E0B"
            />
          }
        >
          {progressLoading ? (
            <ActivityIndicator size="large" color="#F59E0B" style={styles.loader} />
          ) : progress ? (
            <>
              {/* Earned Badges */}
              {progress.badges.filter(b => b.earned).length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Conquistados</Text>
                  <View style={styles.badgesRow}>
                    {progress.badges.filter(b => b.earned).map(renderBadgeCard)}
                  </View>
                </>
              )}
              
              {/* Locked Badges */}
              <Text style={styles.sectionTitle}>Por Conquistar</Text>
              <View style={styles.badgesRow}>
                {progress.badges.filter(b => !b.earned).map(renderBadgeCard)}
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.leaderboardContent}
        >
          {leaderboardLoading ? (
            <ActivityIndicator size="large" color="#F59E0B" style={styles.loader} />
          ) : leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => renderLeaderboardItem(entry, index))
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="people" size={48} color="#64748B" />
              <Text style={styles.emptyText}>Ainda não há participantes</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 16,
  },
  loginSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  statsCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#0F172A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#F59E0B',
  },
  content: {
    flex: 1,
    marginTop: 16,
  },
  badgesGrid: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
    marginTop: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeCardLocked: {
    opacity: 0.7,
  },
  badgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  checkMark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#1E293B',
    borderRadius: 10,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: '#94A3B8',
  },
  badgeDescription: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  progressContainer: {
    width: '100%',
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  leaderboardContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  leaderboardItemCurrent: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B10',
  },
  leaderboardRank: {
    width: 36,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  leaderboardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  leaderboardAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  leaderboardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  leaderboardPoints: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  leaderboardBadges: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  levelBadge: {
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
});
