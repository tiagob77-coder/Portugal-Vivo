import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, ActivityIndicator, DimensionValue } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getDashboardProgress, 
  getDashboardBadges, 
  getDashboardStatistics, 
  getVisitHistory,
  DashboardProgress,
  Badge,
  DashboardStatistics,
  VisitRecord
} from '../src/services/api';

const { width } = Dimensions.get('window');

// Region names
const REGION_NAMES: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

// Category names
const CATEGORY_NAMES: Record<string, string> = {
  termas: 'Termas',
  piscinas: 'Praias Fluviais',
  miradouros: 'Miradouros',
  cascatas: 'Cascatas',
  aldeias: 'Aldeias',
  gastronomia: 'Gastronomia',
  religioso: 'Património Religioso',
  lendas: 'Lendas',
  festas: 'Festas',
  natureza: 'Natureza',
  produtos: 'Produtos',
  saberes: 'Saberes',
  crencas: 'Crenças',
  areas_protegidas: 'Áreas Protegidas',
  rios: 'Rios',
  minerais: 'Minerais',
  percursos: 'Percursos',
  rotas: 'Rotas',
  cogumelos: 'Cogumelos',
  arqueologia: 'Arqueologia',
  fauna: 'Fauna e Flora',
  arte: 'Arte',
  comunidade: 'Comunidade',
  tascas: 'Tascas',
  baloicos: 'Baloiços',
  moinhos: 'Moinhos',
  aventura: 'Aventura',
};

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  
  // Data from API
  const [progress, setProgress] = useState<DashboardProgress | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [history, setHistory] = useState<VisitRecord[]>([]);
  
  const [selectedTab, setSelectedTab] = useState<'stats' | 'badges' | 'history'>('stats');

  const checkAuth = useCallback(async (): Promise<string | null> => {
    // In SSR context, skip auth check and show login prompt
    if (typeof window === 'undefined') {
      setLoading(false);
      return null;
    }
    
    try {
      const savedToken = await AsyncStorage.getItem('session_token');
      if (savedToken) {
        setToken(savedToken);
        setIsAuthenticated(true);
        return savedToken;
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    }
    
    // No token found - immediately show login prompt
    setLoading(false);
    return null;
  }, []);

  const loadData = useCallback(async (authToken?: string | null) => {
    const tokenToUse = authToken || token;
    
    if (!tokenToUse) {
      setLoading(false);
      return;
    }

    try {
      const [progressData, badgesData, statsData, historyData] = await Promise.all([
        getDashboardProgress(tokenToUse),
        getDashboardBadges(tokenToUse),
        getDashboardStatistics(tokenToUse),
        getVisitHistory(tokenToUse, 20),
      ]);

      setProgress(progressData);
      setBadges(badgesData);
      setStats(statsData);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // If auth fails, clear token
      if ((error as any)?.response?.status === 401) {
        setIsAuthenticated(false);
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const init = async () => {
      const authToken = await checkAuth();
      await loadData(authToken);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const unlockedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);

  // Show login prompt if not authenticated
  if (!loading && !isAuthenticated) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <LinearGradient
          colors={['#264E41', '#2E5E4E']}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>O Meu Progresso</Text>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        <View style={styles.authPrompt}>
          <MaterialIcons name="lock" size={64} color="#3D4A3D" />
          <Text style={styles.authTitle}>Inicia Sessão</Text>
          <Text style={styles.authText}>
            Faz login para acompanhar o teu progresso, ganhar badges e competir no leaderboard!
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push('/profile')}
          >
            <MaterialIcons name="login" size={20} color="#2E5E4E" />
            <Text style={styles.loginButtonText}>Iniciar Sessão</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#C49A6C" />
        <Text style={styles.loadingText}>A carregar progresso...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <LinearGradient
        colors={['#264E41', '#2E5E4E']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>O Meu Progresso</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={() => {}}>
            <MaterialIcons name="settings" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Level Card */}
        {progress && (
          <View style={styles.levelCard}>
            <View style={styles.levelIconContainer}>
              <MaterialIcons name={progress.level_icon as any || 'emoji-objects'} size={40} color="#C49A6C" />
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelName}>{progress.level_name}</Text>
              <Text style={styles.levelNumber}>Nível {progress.level}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress.level_progress}%` as DimensionValue }]} />
              </View>
              <Text style={styles.pointsText}>{progress.total_points} pontos</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'stats' && styles.tabActive]}
          onPress={() => setSelectedTab('stats')}
          data-testid="tab-stats"
        >
          <MaterialIcons name="analytics" size={20} color={selectedTab === 'stats' ? '#C49A6C' : '#64748B'} />
          <Text style={[styles.tabText, selectedTab === 'stats' && styles.tabTextActive]}>Estatísticas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'badges' && styles.tabActive]}
          onPress={() => setSelectedTab('badges')}
          data-testid="tab-badges"
        >
          <MaterialIcons name="emoji-events" size={20} color={selectedTab === 'badges' ? '#C49A6C' : '#64748B'} />
          <Text style={[styles.tabText, selectedTab === 'badges' && styles.tabTextActive]}>
            Badges ({unlockedBadges.length}/{badges.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'history' && styles.tabActive]}
          onPress={() => setSelectedTab('history')}
          data-testid="tab-history"
        >
          <MaterialIcons name="history" size={20} color={selectedTab === 'history' ? '#C49A6C' : '#64748B'} />
          <Text style={[styles.tabText, selectedTab === 'history' && styles.tabTextActive]}>Histórico</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C49A6C" />
        }
      >
        {selectedTab === 'stats' && stats && (
          <>
            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.quickStat}>
                <Text style={styles.quickStatValue}>{stats.total_visits}</Text>
                <Text style={styles.quickStatLabel}>Visitas</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStat}>
                <Text style={styles.quickStatValue}>{stats.unique_pois}</Text>
                <Text style={styles.quickStatLabel}>Locais</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStat}>
                <Text style={styles.quickStatValue}>{stats.current_streak}</Text>
                <Text style={styles.quickStatLabel}>Streak</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStat}>
                <Text style={styles.quickStatValue}>{stats.badges_unlocked}</Text>
                <Text style={styles.quickStatLabel}>Badges</Text>
              </View>
            </View>

            {/* Top Categories */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categorias Favoritas</Text>
              {stats.top_categories.length > 0 ? (
                stats.top_categories.map((cat, index) => (
                  <View key={cat.category} style={styles.statRow}>
                    <View style={styles.statRowLeft}>
                      <Text style={styles.statRank}>#{index + 1}</Text>
                      <Text style={styles.statName}>{CATEGORY_NAMES[cat.category] || cat.category}</Text>
                    </View>
                    <View style={styles.statBarContainer}>
                      <View 
                        style={[
                          styles.statBar, 
                          { width: `${(cat.count / stats.top_categories[0].count) * 100}%` as DimensionValue }
                        ]} 
                      />
                    </View>
                    <Text style={styles.statCount}>{cat.count}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Ainda não visitaste nenhum local</Text>
              )}
            </View>

            {/* Top Regions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Regiões Exploradas</Text>
              {stats.top_regions.length > 0 ? (
                stats.top_regions.map((reg, index) => (
                  <View key={reg.region} style={styles.statRow}>
                    <View style={styles.statRowLeft}>
                      <Text style={styles.statRank}>#{index + 1}</Text>
                      <Text style={styles.statName}>{REGION_NAMES[reg.region] || reg.region}</Text>
                    </View>
                    <View style={styles.statBarContainer}>
                      <View 
                        style={[
                          styles.statBar, 
                          { width: `${(reg.count / stats.top_regions[0].count) * 100}%` as DimensionValue, backgroundColor: '#3B82F6' }
                        ]} 
                      />
                    </View>
                    <Text style={styles.statCount}>{reg.count}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Ainda não visitaste nenhuma região</Text>
              )}
            </View>

            {/* Streaks */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Streaks</Text>
              <View style={styles.streakCards}>
                <View style={styles.streakCard}>
                  <MaterialIcons name="local-fire-department" size={32} color="#C49A6C" />
                  <Text style={styles.streakValue}>{stats.current_streak}</Text>
                  <Text style={styles.streakLabel}>Atual</Text>
                </View>
                <View style={styles.streakCard}>
                  <MaterialIcons name="emoji-events" size={32} color="#8B5CF6" />
                  <Text style={styles.streakValue}>{stats.longest_streak}</Text>
                  <Text style={styles.streakLabel}>Recorde</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {selectedTab === 'badges' && (
          <>
            {/* Unlocked Badges */}
            {unlockedBadges.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Desbloqueados ({unlockedBadges.length})</Text>
                <View style={styles.badgesGrid}>
                  {unlockedBadges.map(badge => (
                    <View key={badge.id} style={styles.badgeCard}>
                      <View style={[styles.badgeIcon, { backgroundColor: badge.color + '20' }]}>
                        <MaterialIcons name={badge.icon as any} size={28} color={badge.color} />
                      </View>
                      <Text style={styles.badgeName}>{badge.name}</Text>
                      <Text style={styles.badgePoints}>+{badge.points} pts</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Locked Badges */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Por Desbloquear ({lockedBadges.length})</Text>
              <View style={styles.badgesGrid}>
                {lockedBadges.map(badge => (
                  <View key={badge.id} style={[styles.badgeCard, styles.badgeCardLocked]}>
                    <View style={[styles.badgeIcon, styles.badgeIconLocked]}>
                      <MaterialIcons name="lock" size={28} color="#3D4A3D" />
                    </View>
                    <Text style={[styles.badgeName, styles.badgeNameLocked]}>{badge.name}</Text>
                    <Text style={styles.badgeDescription} numberOfLines={2}>{badge.description}</Text>
                    <View style={styles.badgeProgressContainer}>
                      <View style={[styles.badgeProgressBar, { width: `${badge.progress}%` as DimensionValue }]} />
                    </View>
                    <Text style={styles.badgeProgressText}>{badge.current}/{badge.requirement}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {selectedTab === 'history' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visitas Recentes</Text>
            {history.length > 0 ? (
              history.map((visit) => (
                <TouchableOpacity 
                  key={visit.id} 
                  style={styles.historyItem}
                  onPress={() => router.push(`/heritage/${visit.poi_id}`)}
                >
                  <View style={styles.historyIcon}>
                    <MaterialIcons name="place" size={20} color="#C49A6C" />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyName}>{visit.poi_name}</Text>
                    <Text style={styles.historyMeta}>
                      {CATEGORY_NAMES[visit.category] || visit.category} • {REGION_NAMES[visit.region] || visit.region}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(visit.timestamp).toLocaleDateString('pt-PT', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.historyPoints}>
                    <Text style={styles.historyPointsText}>+{visit.points_earned}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyHistory}>
                <MaterialIcons name="explore" size={48} color="#3D4A3D" />
                <Text style={styles.emptyTitle}>Ainda sem visitas</Text>
                <Text style={styles.emptyText}>
                  Começa a explorar Portugal e as tuas visitas aparecerão aqui!
                </Text>
                <TouchableOpacity 
                  style={styles.exploreButton}
                  onPress={() => router.push('/nearby')}
                >
                  <MaterialIcons name="near-me" size={18} color="#2E5E4E" />
                  <Text style={styles.exploreButtonText}>Explorar Próximos</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E5E4E',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  levelIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FAF8F3',
  },
  levelNumber: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#2A2F2A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C49A6C',
    borderRadius: 3,
  },
  pointsText: {
    fontSize: 12,
    color: '#C49A6C',
    marginTop: 4,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#264E41',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#C49A6C',
  },
  content: {
    flex: 1,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#264E41',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: '#2A2F2A',
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FAF8F3',
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAF8F3',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
  },
  statRank: {
    fontSize: 12,
    color: '#64748B',
    width: 24,
  },
  statName: {
    fontSize: 14,
    color: '#FAF8F3',
    fontWeight: '500',
  },
  statBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#2A2F2A',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  statBar: {
    height: '100%',
    backgroundColor: '#C49A6C',
    borderRadius: 4,
  },
  statCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FAF8F3',
    width: 30,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 20,
  },
  streakCards: {
    flexDirection: 'row',
    gap: 12,
  },
  streakCard: {
    flex: 1,
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FAF8F3',
    marginTop: 8,
  },
  streakLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: (width - 56) / 3,
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  badgeCardLocked: {
    opacity: 0.7,
  },
  badgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeIconLocked: {
    backgroundColor: '#2A2F2A',
  },
  badgeName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FAF8F3',
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: '#94A3B8',
  },
  badgePoints: {
    fontSize: 10,
    color: '#C49A6C',
    fontWeight: '600',
    marginTop: 2,
  },
  badgeDescription: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  badgeProgressContainer: {
    width: '100%',
    height: 4,
    backgroundColor: '#2A2F2A',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  badgeProgressBar: {
    height: '100%',
    backgroundColor: '#C49A6C',
    borderRadius: 2,
  },
  badgeProgressText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FAF8F3',
  },
  historyMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  historyDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyPoints: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyPointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C49A6C',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
    marginTop: 16,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C49A6C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  exploreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E5E4E',
  },
  // Auth prompt styles
  authPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FAF8F3',
    marginTop: 20,
  },
  authText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C49A6C',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E5E4E',
  },
});
