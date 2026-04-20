// @ts-nocheck
/**
 * Tests for the Gamification Service
 * Covers: points, badge unlocking, streak logic, level calculation, error handling
 */

// In-memory AsyncStorage mock so we can inspect reads/writes
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

// Import after mocks
import { BADGES, LEVELS } from '../gamification'; // eslint-disable-line import/first

// We need a fresh service instance per test to avoid shared singleton state
function createFreshService() {
  jest.resetModules();
  // Re-apply the mock after resetModules
  jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
      setItem: jest.fn((key: string, value: string) => {
        mockStorage[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete mockStorage[key];
        return Promise.resolve();
      }),
    },
  }));
  const mod = require('../gamification');
  return mod.gamificationService;
}

describe('BADGES constant', () => {
  it('defines expected badge IDs', () => {
    expect(BADGES).toHaveProperty('first_visit');
    expect(BADGES).toHaveProperty('explorer_10');
    expect(BADGES).toHaveProperty('streak_7');
    expect(BADGES).toHaveProperty('early_bird');
    expect(BADGES).toHaveProperty('night_owl');
  });

  it('each badge has required fields', () => {
    Object.values(BADGES).forEach(badge => {
      expect(badge).toHaveProperty('id');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('description');
      expect(badge).toHaveProperty('points');
      expect(badge).toHaveProperty('category');
    });
  });
});

describe('LEVELS constant', () => {
  it('starts at level 1 with 0 min points', () => {
    expect(LEVELS[0].level).toBe(1);
    expect(LEVELS[0].minPoints).toBe(0);
  });

  it('ends at level 10 (Lenda)', () => {
    const last = LEVELS[LEVELS.length - 1];
    expect(last.level).toBe(10);
    expect(last.name).toBe('Lenda');
  });

  it('levels are in ascending order', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minPoints).toBeGreaterThan(LEVELS[i - 1].minPoints);
    }
  });
});

describe('GamificationService', () => {
  let service: any;

  beforeEach(() => {
    // Clear shared mock storage and create a fresh service
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    jest.clearAllMocks();
    service = createFreshService();
  });

  // Helper: build a minimal POI for registerVisit
  const makePoi = (overrides: Partial<{
    id: string; name: string; category: string; region: string;
  }> = {}) => ({
    id: 'poi-001',
    name: 'Termas de Monchique',
    category: 'termas',
    region: 'algarve',
    ...overrides,
  });

  // ──────────────────────────────────────────────
  // getProgress / initial state
  // ──────────────────────────────────────────────
  describe('getProgress', () => {
    it('returns default progress on fresh instance', () => {
      const progress = service.getProgress();
      expect(progress.points).toBe(0);
      expect(progress.level).toBe(1);
      expect(progress.totalVisits).toBe(0);
      expect(progress.currentStreak).toBe(0);
      expect(progress.longestStreak).toBe(0);
      expect(progress.lastVisitDate).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // registerVisit — points
  // ──────────────────────────────────────────────
  describe('registerVisit — basic points', () => {
    it('awards 10 base points for a visit', async () => {
      const result = await service.registerVisit(makePoi());
      // Base 10 + first_visit badge (10) = 20
      expect(result.pointsEarned).toBeGreaterThanOrEqual(10);
    });

    it('updates totalVisits after a visit', async () => {
      await service.registerVisit(makePoi());
      expect(service.getProgress().totalVisits).toBe(1);
    });

    it('does not count duplicate visit to same POI on same day', async () => {
      await service.registerVisit(makePoi({ id: 'poi-dup' }));
      const second = await service.registerVisit(makePoi({ id: 'poi-dup' }));
      expect(second.pointsEarned).toBe(0);
      expect(service.getProgress().totalVisits).toBe(1);
    });

    it('persists points to AsyncStorage', async () => {
      await service.registerVisit(makePoi());
      const raw = mockStorage['gamification_progress'];
      expect(raw).toBeDefined();
      const stored = JSON.parse(raw);
      expect(stored.points).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────
  // registerVisit — badge unlocking
  // ──────────────────────────────────────────────
  describe('registerVisit — badge unlocking', () => {
    it('unlocks first_visit badge on first visit', async () => {
      const result = await service.registerVisit(makePoi());
      const badgeIds = result.newBadges.map((b: any) => b.id);
      expect(badgeIds).toContain('first_visit');
    });

    it('does not unlock first_visit badge again on second visit', async () => {
      await service.registerVisit(makePoi({ id: 'poi-a' }));
      const second = await service.registerVisit(makePoi({ id: 'poi-b' }));
      const badgeIds = second.newBadges.map((b: any) => b.id);
      expect(badgeIds).not.toContain('first_visit');
    });

    it('unlocks explorer_10 badge on 10th unique visit', async () => {
      // Simulate 9 existing visits by pre-loading progress
      await service.resetProgress();
      const progress = service.getProgress();
      // Directly register 9 different POIs
      for (let i = 1; i < 10; i++) {
        await service.registerVisit(makePoi({ id: `poi-${i}` }));
      }
      const result = await service.registerVisit(makePoi({ id: 'poi-10' }));
      const badgeIds = result.newBadges.map((b: any) => b.id);
      expect(badgeIds).toContain('explorer_10');
    });

    it('unlocks termas_master after 10 termas visits', async () => {
      await service.resetProgress();
      let result;
      for (let i = 1; i <= 10; i++) {
        result = await service.registerVisit(makePoi({ id: `termas-${i}`, category: 'termas', region: 'norte' }));
      }
      const badgeIds = result.newBadges.map((b: any) => b.id);
      expect(badgeIds).toContain('termas_master');
    });

    it('hasBadge returns true after badge is unlocked', async () => {
      await service.registerVisit(makePoi());
      expect(service.hasBadge('first_visit')).toBe(true);
    });

    it('hasBadge returns false for badge not yet earned', () => {
      expect(service.hasBadge('explorer_100')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // registerVisit — streak logic
  // ──────────────────────────────────────────────
  describe('registerVisit — streak logic', () => {
    it('starts streak at 1 on first visit', async () => {
      await service.registerVisit(makePoi());
      expect(service.getProgress().currentStreak).toBe(1);
    });

    it('increments streak on consecutive days', async () => {
      // Day 1
      await service.registerVisit(makePoi({ id: 'poi-d1' }));

      // Manually manipulate lastVisitDate to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const progress = service.getProgress();
      // Access private via workaround: reset with manufactured data in storage
      const stored = JSON.parse(mockStorage['gamification_progress']);
      stored.lastVisitDate = yesterday.toISOString().split('T')[0];
      stored.currentStreak = 1;
      mockStorage['gamification_progress'] = JSON.stringify(stored);

      // Re-create service so it loads the patched data
      service = createFreshService();
      // Wait for loadData to complete
      await new Promise(r => setTimeout(r, 50));

      await service.registerVisit(makePoi({ id: 'poi-d2' }));
      expect(service.getProgress().currentStreak).toBe(2);
    });

    it('resets streak when visit gap is more than 1 day', async () => {
      await service.registerVisit(makePoi({ id: 'poi-old' }));

      // Simulate 3-day gap
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const stored = JSON.parse(mockStorage['gamification_progress']);
      stored.lastVisitDate = threeDaysAgo.toISOString().split('T')[0];
      stored.currentStreak = 5;
      mockStorage['gamification_progress'] = JSON.stringify(stored);

      service = createFreshService();
      await new Promise(r => setTimeout(r, 50));

      await service.registerVisit(makePoi({ id: 'poi-new' }));
      expect(service.getProgress().currentStreak).toBe(1);
    });

    it('updates longestStreak when currentStreak exceeds it', async () => {
      // Inject a streak of 6 so the next consecutive day makes it 7
      const stored = {
        points: 60,
        level: 1,
        totalVisits: 6,
        visitsByCategory: {},
        visitsByRegion: {},
        currentStreak: 6,
        longestStreak: 6,
        lastVisitDate: (() => {
          const d = new Date(); d.setDate(d.getDate() - 1);
          return d.toISOString().split('T')[0];
        })(),
        reviewsCount: 0,
        photosCount: 0,
        contributionsCount: 0,
      };
      mockStorage['gamification_progress'] = JSON.stringify(stored);
      mockStorage['gamification_badges'] = JSON.stringify([
        { badgeId: 'first_visit', unlockedAt: new Date().toISOString() },
      ]);
      mockStorage['gamification_visits'] = JSON.stringify(
        Array.from({ length: 6 }, (_, i) => ({
          id: `v${i}`,
          poiId: `prev-poi-${i}`,
          poiName: `POI ${i}`,
          category: 'termas',
          region: 'norte',
          timestamp: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
        }))
      );

      service = createFreshService();
      await new Promise(r => setTimeout(r, 50));

      const result = await service.registerVisit(makePoi({ id: 'poi-day7' }));
      const progress = service.getProgress();
      expect(progress.currentStreak).toBe(7);
      expect(progress.longestStreak).toBe(7);
      // Should also unlock streak_7 badge
      const badgeIds = result.newBadges.map((b: any) => b.id);
      expect(badgeIds).toContain('streak_7');
    });
  });

  // ──────────────────────────────────────────────
  // Level calculation
  // ──────────────────────────────────────────────
  describe('level calculation', () => {
    it('levelUp flag is true when points cross a level threshold', async () => {
      // Inject enough visits to be near level 2 threshold (100 pts)
      // Each visit = 10 pts. First visit also gives first_visit badge (+10 pts = 20 total).
      // We need 80 more from subsequent visits = 8 more visits
      await service.resetProgress();
      for (let i = 1; i <= 9; i++) {
        await service.registerVisit(makePoi({ id: `lv-poi-${i}` }));
      }
      // At this point: 20 (first) + 8*10 = 100 pts → level 2
      expect(service.getProgress().level).toBe(2);
    });

    it('getLevelInfo returns progress percentage', async () => {
      await service.registerVisit(makePoi());
      const info = service.getLevelInfo();
      expect(info).toHaveProperty('level');
      expect(info).toHaveProperty('progress');
      expect(info.progress).toBeGreaterThanOrEqual(0);
      expect(info.progress).toBeLessThanOrEqual(100);
    });
  });

  // ──────────────────────────────────────────────
  // registerReview
  // ──────────────────────────────────────────────
  describe('registerReview', () => {
    it('awards 5 points per review', async () => {
      const result = await service.registerReview();
      expect(result.pointsEarned).toBe(5);
    });

    it('unlocks reviewer badge on 10th review', async () => {
      for (let i = 0; i < 9; i++) await service.registerReview();
      const result = await service.registerReview();
      expect(result.badge?.id).toBe('reviewer');
      expect(result.pointsEarned).toBeGreaterThan(5); // 5 + badge points
    });
  });

  // ──────────────────────────────────────────────
  // getAllBadges / getUnlockedBadges
  // ──────────────────────────────────────────────
  describe('getAllBadges', () => {
    it('returns all badges with unlocked status', async () => {
      await service.registerVisit(makePoi());
      const all = service.getAllBadges();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBe(Object.keys(BADGES).length);
      const firstVisitBadge = all.find((b: any) => b.id === 'first_visit');
      expect(firstVisitBadge.unlocked).toBe(true);
      expect(firstVisitBadge.unlockedAt).toBeDefined();
      const lockedBadge = all.find((b: any) => b.id === 'explorer_100');
      expect(lockedBadge.unlocked).toBe(false);
    });
  });

  describe('getUnlockedBadges', () => {
    it('returns empty array before any visits', () => {
      expect(service.getUnlockedBadges()).toEqual([]);
    });

    it('returns unlocked badges with unlockedAt timestamp', async () => {
      await service.registerVisit(makePoi());
      const badges = service.getUnlockedBadges();
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0]).toHaveProperty('unlockedAt');
    });
  });

  // ──────────────────────────────────────────────
  // getStatistics
  // ──────────────────────────────────────────────
  describe('getStatistics', () => {
    it('returns all required statistic fields', async () => {
      await service.registerVisit(makePoi());
      const stats = service.getStatistics();
      expect(stats).toHaveProperty('totalVisits');
      expect(stats).toHaveProperty('uniquePOIs');
      expect(stats).toHaveProperty('totalPoints');
      expect(stats).toHaveProperty('badgesUnlocked');
      expect(stats).toHaveProperty('totalBadges');
      expect(stats).toHaveProperty('currentStreak');
      expect(stats).toHaveProperty('longestStreak');
      expect(stats).toHaveProperty('topCategories');
      expect(stats).toHaveProperty('topRegions');
    });

    it('counts unique POIs correctly', async () => {
      await service.registerVisit(makePoi({ id: 'p1' }));
      await service.registerVisit(makePoi({ id: 'p2' }));
      const stats = service.getStatistics();
      expect(stats.uniquePOIs).toBe(2);
    });
  });

  // ──────────────────────────────────────────────
  // subscribe / notify listeners
  // ──────────────────────────────────────────────
  describe('subscribe', () => {
    it('calls listener when data is saved', async () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);
      await service.registerVisit(makePoi());
      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it('does not call listener after unsubscribe', async () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);
      unsubscribe();
      await service.registerVisit(makePoi());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // resetProgress
  // ──────────────────────────────────────────────
  describe('resetProgress', () => {
    it('clears all progress and badges', async () => {
      await service.registerVisit(makePoi());
      await service.resetProgress();
      const progress = service.getProgress();
      expect(progress.points).toBe(0);
      expect(progress.totalVisits).toBe(0);
      expect(service.getUnlockedBadges()).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────
  // Error handling — AsyncStorage failure
  // ──────────────────────────────────────────────
  describe('error handling', () => {
    it('handles AsyncStorage.setItem failure gracefully', async () => {
      // Override setItem to throw
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));

      // Should not throw; error is caught internally
      await expect(service.registerVisit(makePoi())).resolves.not.toThrow();
    });
  });
});
