/**
 * Gamification Service
 * Manages badges, achievements, points and user progress
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  USER_PROGRESS: 'gamification_progress',
  BADGES: 'gamification_badges',
  ACHIEVEMENTS: 'gamification_achievements',
  VISIT_HISTORY: 'gamification_visits',
};

// Badge definitions
export const BADGES = {
  // Explorer badges
  first_visit: {
    id: 'first_visit',
    name: 'Primeiro Passo',
    description: 'Visitou o primeiro ponto de interesse',
    icon: 'flag',
    color: '#22C55E',
    points: 10,
    category: 'explorer',
  },
  explorer_10: {
    id: 'explorer_10',
    name: 'Explorador',
    description: 'Visitou 10 pontos de interesse',
    icon: 'explore',
    color: '#3B82F6',
    points: 50,
    category: 'explorer',
  },
  explorer_50: {
    id: 'explorer_50',
    name: 'Aventureiro',
    description: 'Visitou 50 pontos de interesse',
    icon: 'hiking',
    color: '#8B5CF6',
    points: 200,
    category: 'explorer',
  },
  explorer_100: {
    id: 'explorer_100',
    name: 'Descobridor',
    description: 'Visitou 100 pontos de interesse',
    icon: 'public',
    color: '#F59E0B',
    points: 500,
    category: 'explorer',
  },

  // Category specialists
  termas_master: {
    id: 'termas_master',
    name: 'Mestre das Águas',
    description: 'Visitou 10 termas diferentes',
    icon: 'hot-tub',
    color: '#06B6D4',
    points: 100,
    category: 'specialist',
  },
  praia_lover: {
    id: 'praia_lover',
    name: 'Amante das Praias',
    description: 'Visitou 15 praias fluviais',
    icon: 'pool',
    color: '#0EA5E9',
    points: 100,
    category: 'specialist',
  },
  miradouro_hunter: {
    id: 'miradouro_hunter',
    name: 'Caçador de Vistas',
    description: 'Visitou 10 miradouros',
    icon: 'landscape',
    color: '#6366F1',
    points: 100,
    category: 'specialist',
  },
  gastronome: {
    id: 'gastronome',
    name: 'Gastrónomo',
    description: 'Visitou 10 locais gastronómicos',
    icon: 'restaurant',
    color: '#EF4444',
    points: 100,
    category: 'specialist',
  },
  history_buff: {
    id: 'history_buff',
    name: 'Amante da História',
    description: 'Visitou 10 locais históricos ou religiosos',
    icon: 'account-balance',
    color: '#7C3AED',
    points: 100,
    category: 'specialist',
  },

  // Regional badges
  norte_explorer: {
    id: 'norte_explorer',
    name: 'Explorador do Norte',
    description: 'Visitou 20 locais no Norte de Portugal',
    icon: 'terrain',
    color: '#22C55E',
    points: 150,
    category: 'regional',
  },
  centro_explorer: {
    id: 'centro_explorer',
    name: 'Explorador do Centro',
    description: 'Visitou 20 locais no Centro de Portugal',
    icon: 'landscape',
    color: '#3B82F6',
    points: 150,
    category: 'regional',
  },
  sul_explorer: {
    id: 'sul_explorer',
    name: 'Explorador do Sul',
    description: 'Visitou 15 locais no Alentejo ou Algarve',
    icon: 'wb-sunny',
    color: '#F59E0B',
    points: 150,
    category: 'regional',
  },
  ilhas_explorer: {
    id: 'ilhas_explorer',
    name: 'Explorador das Ilhas',
    description: 'Visitou 5 locais nos Açores ou Madeira',
    icon: 'waves',
    color: '#14B8A6',
    points: 200,
    category: 'regional',
  },
  portugal_completo: {
    id: 'portugal_completo',
    name: 'Portugal Completo',
    description: 'Visitou pelo menos 1 local em cada região',
    icon: 'emoji-events',
    color: '#F59E0B',
    points: 500,
    category: 'regional',
  },

  // Special badges
  early_bird: {
    id: 'early_bird',
    name: 'Madrugador',
    description: 'Visitou um local antes das 8h da manhã',
    icon: 'wb-twilight',
    color: '#FB923C',
    points: 25,
    category: 'special',
  },
  night_owl: {
    id: 'night_owl',
    name: 'Coruja Noturna',
    description: 'Visitou um local depois das 21h',
    icon: 'nightlight',
    color: '#6366F1',
    points: 25,
    category: 'special',
  },
  weekend_warrior: {
    id: 'weekend_warrior',
    name: 'Guerreiro de Fim de Semana',
    description: 'Visitou 5 locais num único fim de semana',
    icon: 'event',
    color: '#EC4899',
    points: 75,
    category: 'special',
  },
  streak_7: {
    id: 'streak_7',
    name: 'Semana Ativa',
    description: 'Visitou locais 7 dias consecutivos',
    icon: 'local-fire-department',
    color: '#EF4444',
    points: 100,
    category: 'special',
  },
  reviewer: {
    id: 'reviewer',
    name: 'Crítico',
    description: 'Deixou 10 avaliações',
    icon: 'rate-review',
    color: '#F59E0B',
    points: 50,
    category: 'social',
  },
  photographer: {
    id: 'photographer',
    name: 'Fotógrafo',
    description: 'Partilhou 10 fotos',
    icon: 'photo-camera',
    color: '#EC4899',
    points: 50,
    category: 'social',
  },
  contributor: {
    id: 'contributor',
    name: 'Contribuidor',
    description: 'Sugeriu 5 novos locais aprovados',
    icon: 'add-location',
    color: '#22C55E',
    points: 150,
    category: 'social',
  },
};

// Level definitions
export const LEVELS = [
  { level: 1, name: 'Iniciante', minPoints: 0, maxPoints: 99, icon: 'looks-one' },
  { level: 2, name: 'Curioso', minPoints: 100, maxPoints: 299, icon: 'looks-two' },
  { level: 3, name: 'Explorador', minPoints: 300, maxPoints: 599, icon: 'looks-3' },
  { level: 4, name: 'Aventureiro', minPoints: 600, maxPoints: 999, icon: 'looks-4' },
  { level: 5, name: 'Descobridor', minPoints: 1000, maxPoints: 1499, icon: 'looks-5' },
  { level: 6, name: 'Viajante', minPoints: 1500, maxPoints: 2499, icon: 'looks-6' },
  { level: 7, name: 'Expert', minPoints: 2500, maxPoints: 3999, icon: 'star-half' },
  { level: 8, name: 'Mestre', minPoints: 4000, maxPoints: 5999, icon: 'star' },
  { level: 9, name: 'Guardião', minPoints: 6000, maxPoints: 9999, icon: 'auto-awesome' },
  { level: 10, name: 'Lenda', minPoints: 10000, maxPoints: Infinity, icon: 'emoji-events' },
];

export interface UserProgress {
  points: number;
  level: number;
  totalVisits: number;
  visitsByCategory: Record<string, number>;
  visitsByRegion: Record<string, number>;
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: string | null;
  reviewsCount: number;
  photosCount: number;
  contributionsCount: number;
}

export interface UnlockedBadge {
  badgeId: string;
  unlockedAt: string;
  visitId?: string;
}

export interface Visit {
  id: string;
  poiId: string;
  poiName: string;
  category: string;
  region: string;
  timestamp: string;
  coordinates?: { lat: number; lng: number };
}

class GamificationService {
  private progress: UserProgress = this.getDefaultProgress();
  private unlockedBadges: UnlockedBadge[] = [];
  private visitHistory: Visit[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadData();
  }

  private getDefaultProgress(): UserProgress {
    return {
      points: 0,
      level: 1,
      totalVisits: 0,
      visitsByCategory: {},
      visitsByRegion: {},
      currentStreak: 0,
      longestStreak: 0,
      lastVisitDate: null,
      reviewsCount: 0,
      photosCount: 0,
      contributionsCount: 0,
    };
  }

  private async loadData(): Promise<void> {
    // Skip AsyncStorage in SSR context
    if (typeof window === 'undefined') return;
    
    try {
      const [progressRaw, badgesRaw, visitsRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_PROGRESS),
        AsyncStorage.getItem(STORAGE_KEYS.BADGES),
        AsyncStorage.getItem(STORAGE_KEYS.VISIT_HISTORY),
      ]);

      if (progressRaw) this.progress = JSON.parse(progressRaw);
      if (badgesRaw) this.unlockedBadges = JSON.parse(badgesRaw);
      if (visitsRaw) this.visitHistory = JSON.parse(visitsRaw);
    } catch (error) {
      console.error('Error loading gamification data:', error);
    }
  }

  private async saveData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.USER_PROGRESS, JSON.stringify(this.progress)),
        AsyncStorage.setItem(STORAGE_KEYS.BADGES, JSON.stringify(this.unlockedBadges)),
        AsyncStorage.setItem(STORAGE_KEYS.VISIT_HISTORY, JSON.stringify(this.visitHistory)),
      ]);
      this.notifyListeners();
    } catch (error) {
      console.error('Error saving gamification data:', error);
    }
  }

  /**
   * Register a visit to a POI
   */
  async registerVisit(poi: {
    id: string;
    name: string;
    category: string;
    region: string;
    coordinates?: { lat: number; lng: number };
  }): Promise<{ newBadges: typeof BADGES[keyof typeof BADGES][]; pointsEarned: number; levelUp: boolean }> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();

    // Check if already visited today
    const alreadyVisitedToday = this.visitHistory.some(
      v => v.poiId === poi.id && v.timestamp.startsWith(today)
    );

    if (alreadyVisitedToday) {
      return { newBadges: [], pointsEarned: 0, levelUp: false };
    }

    // Create visit record
    const visit: Visit = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      poiId: poi.id,
      poiName: poi.name,
      category: poi.category,
      region: poi.region,
      timestamp: now.toISOString(),
      coordinates: poi.coordinates,
    };

    this.visitHistory.push(visit);

    // Update progress
    const previousLevel = this.progress.level;
    this.progress.totalVisits++;
    this.progress.visitsByCategory[poi.category] = (this.progress.visitsByCategory[poi.category] || 0) + 1;
    this.progress.visitsByRegion[poi.region] = (this.progress.visitsByRegion[poi.region] || 0) + 1;

    // Update streak
    if (this.progress.lastVisitDate) {
      const lastDate = new Date(this.progress.lastVisitDate);
      const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        this.progress.currentStreak++;
      } else if (daysDiff > 1) {
        this.progress.currentStreak = 1;
      }
    } else {
      this.progress.currentStreak = 1;
    }

    this.progress.longestStreak = Math.max(this.progress.longestStreak, this.progress.currentStreak);
    this.progress.lastVisitDate = today;

    // Calculate base points
    let pointsEarned = 10; // Base points per visit

    // Check for new badges
    const newBadges: typeof BADGES[keyof typeof BADGES][] = [];

    // First visit badge
    if (this.progress.totalVisits === 1) {
      const badge = this.unlockBadge('first_visit', visit.id);
      if (badge) {
        newBadges.push(badge);
        pointsEarned += badge.points;
      }
    }

    // Explorer badges
    if (this.progress.totalVisits === 10) {
      const badge = this.unlockBadge('explorer_10', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }
    if (this.progress.totalVisits === 50) {
      const badge = this.unlockBadge('explorer_50', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }
    if (this.progress.totalVisits === 100) {
      const badge = this.unlockBadge('explorer_100', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }

    // Category specialist badges
    if (this.progress.visitsByCategory['termas'] === 10) {
      const badge = this.unlockBadge('termas_master', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }
    if (this.progress.visitsByCategory['piscinas'] === 15) {
      const badge = this.unlockBadge('praia_lover', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }
    if (this.progress.visitsByCategory['miradouros'] === 10) {
      const badge = this.unlockBadge('miradouro_hunter', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }
    if (this.progress.visitsByCategory['gastronomia'] === 10) {
      const badge = this.unlockBadge('gastronome', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }

    // Regional badges
    if (this.progress.visitsByRegion['norte'] === 20) {
      const badge = this.unlockBadge('norte_explorer', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }
    if (this.progress.visitsByRegion['centro'] === 20) {
      const badge = this.unlockBadge('centro_explorer', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }
    const sulVisits = (this.progress.visitsByRegion['alentejo'] || 0) + (this.progress.visitsByRegion['algarve'] || 0);
    if (sulVisits === 15) {
      const badge = this.unlockBadge('sul_explorer', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }

    // Portugal completo
    const regions = ['norte', 'centro', 'lisboa', 'alentejo', 'algarve'];
    const visitedAllRegions = regions.every(r => (this.progress.visitsByRegion[r] || 0) > 0);
    if (visitedAllRegions && !this.hasBadge('portugal_completo')) {
      const badge = this.unlockBadge('portugal_completo', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }

    // Time-based badges
    if (hour < 8 && !this.hasBadge('early_bird')) {
      const badge = this.unlockBadge('early_bird', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }
    if (hour >= 21 && !this.hasBadge('night_owl')) {
      const badge = this.unlockBadge('night_owl', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }

    // Streak badge
    if (this.progress.currentStreak === 7) {
      const badge = this.unlockBadge('streak_7', visit.id);
      if (badge) { newBadges.push(badge); pointsEarned += badge.points; }
    }

    // Update points and level
    this.progress.points += pointsEarned;
    this.progress.level = this.calculateLevel(this.progress.points);
    const levelUp = this.progress.level > previousLevel;

    await this.saveData();

    return { newBadges, pointsEarned, levelUp };
  }

  /**
   * Register a review
   */
  async registerReview(): Promise<{ badge?: typeof BADGES[keyof typeof BADGES]; pointsEarned: number }> {
    this.progress.reviewsCount++;
    let pointsEarned = 5;
    let badge;

    if (this.progress.reviewsCount === 10) {
      badge = this.unlockBadge('reviewer');
      if (badge) pointsEarned += badge.points;
    }

    this.progress.points += pointsEarned;
    this.progress.level = this.calculateLevel(this.progress.points);
    await this.saveData();

    return { badge: badge || undefined, pointsEarned };
  }

  /**
   * Unlock a badge
   */
  private unlockBadge(badgeId: string, visitId?: string): typeof BADGES[keyof typeof BADGES] | null {
    if (this.hasBadge(badgeId)) return null;

    const badge = BADGES[badgeId as keyof typeof BADGES];
    if (!badge) return null;

    this.unlockedBadges.push({
      badgeId,
      unlockedAt: new Date().toISOString(),
      visitId,
    });

    return badge;
  }

  /**
   * Check if user has a badge
   */
  hasBadge(badgeId: string): boolean {
    return this.unlockedBadges.some(b => b.badgeId === badgeId);
  }

  /**
   * Calculate level from points
   */
  private calculateLevel(points: number): number {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (points >= LEVELS[i].minPoints) {
        return LEVELS[i].level;
      }
    }
    return 1;
  }

  /**
   * Get current user progress
   */
  getProgress(): UserProgress {
    return { ...this.progress };
  }

  /**
   * Get all unlocked badges
   */
  getUnlockedBadges(): (typeof BADGES[keyof typeof BADGES] & { unlockedAt: string })[] {
    return this.unlockedBadges.map(ub => ({
      ...BADGES[ub.badgeId as keyof typeof BADGES],
      unlockedAt: ub.unlockedAt,
    }));
  }

  /**
   * Get all available badges with unlock status
   */
  getAllBadges(): (typeof BADGES[keyof typeof BADGES] & { unlocked: boolean; unlockedAt?: string })[] {
    return Object.values(BADGES).map(badge => {
      const unlocked = this.unlockedBadges.find(ub => ub.badgeId === badge.id);
      return {
        ...badge,
        unlocked: !!unlocked,
        unlockedAt: unlocked?.unlockedAt,
      };
    });
  }

  /**
   * Get current level info
   */
  getLevelInfo(): typeof LEVELS[number] & { progress: number } {
    const level = LEVELS.find(l => l.level === this.progress.level) || LEVELS[0];
    const nextLevel = LEVELS.find(l => l.level === this.progress.level + 1);
    
    let progress = 100;
    if (nextLevel) {
      const pointsInLevel = this.progress.points - level.minPoints;
      const pointsNeeded = nextLevel.minPoints - level.minPoints;
      progress = Math.round((pointsInLevel / pointsNeeded) * 100);
    }

    return { ...level, progress };
  }

  /**
   * Get visit history
   */
  getVisitHistory(limit?: number): Visit[] {
    const sorted = [...this.visitHistory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalVisits: number;
    uniquePOIs: number;
    totalPoints: number;
    badgesUnlocked: number;
    totalBadges: number;
    currentStreak: number;
    longestStreak: number;
    topCategories: { category: string; count: number }[];
    topRegions: { region: string; count: number }[];
  } {
    const uniquePOIs = new Set(this.visitHistory.map(v => v.poiId)).size;
    
    const topCategories = Object.entries(this.progress.visitsByCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topRegions = Object.entries(this.progress.visitsByRegion)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalVisits: this.progress.totalVisits,
      uniquePOIs,
      totalPoints: this.progress.points,
      badgesUnlocked: this.unlockedBadges.length,
      totalBadges: Object.keys(BADGES).length,
      currentStreak: this.progress.currentStreak,
      longestStreak: this.progress.longestStreak,
      topCategories,
      topRegions,
    };
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Reset all progress (for testing)
   */
  async resetProgress(): Promise<void> {
    this.progress = this.getDefaultProgress();
    this.unlockedBadges = [];
    this.visitHistory = [];
    await this.saveData();
  }
}

export const gamificationService = new GamificationService();
export default gamificationService;
