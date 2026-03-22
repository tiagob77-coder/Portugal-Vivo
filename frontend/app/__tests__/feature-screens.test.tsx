// @ts-nocheck
/**
 * Smoke tests for feature screens:
 * search, premium, gamification, leaderboard, achievements, onboarding,
 * ar-time-travel, explore-around, nearby, calendar, smart-routes
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// ─── expo-router ──────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({
    itemId: 'poi-001',
    itemName: 'Castelo Test',
    itemCategory: 'castelos',
    itemRegion: 'norte',
    imageUrl: '',
  }),
  Link: ({ children }: any) => children,
  Stack: {
    Screen: () => null,
    __esModule: true,
    default: ({ children }: any) => children,
  },
}));

// ─── React Query ──────────────────────────────────────────────────────────────
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// ─── Auth ─────────────────────────────────────────────────────────────────────
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null, isLoading: false, isAuthenticated: false,
    login: jest.fn(), logout: jest.fn(), sessionToken: null,
    isPremium: false, premiumTier: 'free',
  }),
}));

// ─── Theme ────────────────────────────────────────────────────────────────────
const mockColors = {
  background: '#fff', surface: '#f5f5f5', textPrimary: '#000', textSecondary: '#666',
  textMuted: '#999', accent: '#2E5E4E', border: '#eee', card: '#fff',
  terracotta: { 500: '#C49A6C' },
  forest: { 400: '#3F6F4A', 500: '#2E5E4E' },
};
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: mockColors, isDark: false, toggleTheme: jest.fn() }),
}));
jest.mock('../src/theme', () => ({
  useTheme: () => ({ colors: mockColors }),
  colors: mockColors,
  typography: {},
  shadows: {},
  spacing: {},
  borders: {},
  palette: {
    forest: { 400: '#3F6F4A', 500: '#2E5E4E' },
    terracotta: { 500: '#C49A6C', 600: '#B08556' },
    ocean: { 500: '#0891B2' },
    rust: { 500: '#EF4444' },
  },
  withOpacity: (color: string) => color,
}));

// ─── API ──────────────────────────────────────────────────────────────────────
jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
  getCategories: jest.fn(() => Promise.resolve([])),
  getHeritageItem: jest.fn(() => Promise.resolve(null)),
  getHeritageItems: jest.fn(() => Promise.resolve([])),
  getGamificationProfile: jest.fn(() => Promise.resolve({ points: 0, badges: [], level: 1, checkins: 0 })),
  getNearbyCheckins: jest.fn(() => Promise.resolve([])),
  doCheckin: jest.fn(() => Promise.resolve({})),
  getPremiumTiers: jest.fn(() => Promise.resolve([])),
  createCheckoutSession: jest.fn(() => Promise.resolve({})),
  createCheckoutMBWay: jest.fn(() => Promise.resolve({})),
  createCheckoutMultibanco: jest.fn(() => Promise.resolve({})),
  getLeaderboard: jest.fn(() => Promise.resolve({ entries: [] })),
  getUserProgress: jest.fn(() => Promise.resolve({})),
  getExplorerProfile: jest.fn(() => Promise.resolve({})),
  getLeaderboardRegions: jest.fn(() => Promise.resolve([])),
  getBadges: jest.fn(() => Promise.resolve([])),
  getSmartRouteThemes: jest.fn(() => Promise.resolve([])),
  getSmartRouteProfiles: jest.fn(() => Promise.resolve([])),
  getSmartRouteRegions: jest.fn(() => Promise.resolve([])),
  generateSmartRoute: jest.fn(() => Promise.resolve({})),
  getCalendarEvents: jest.fn(() => Promise.resolve([])),
  getUpcomingEvents: jest.fn(() => Promise.resolve([])),
  getNearbyPOIs: jest.fn(() => Promise.resolve([])),
  getNearbyCategoryCounts: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../src/config/api', () => ({
  API_BASE: 'http://localhost:8000',
  API_URL: 'http://localhost:8000',
}));

// ─── Native deps ──────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
  Ionicons: 'Ionicons',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 38.7, longitude: -9.1 } })
  ),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  Accuracy: { High: 3, Balanced: 2 },
}));

jest.mock('../src/components/BadgeCelebration', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/components/AnimatedListItem', () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

jest.mock('../src/components/SkeletonCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/components/SearchBar', () => ({
  SearchBar: () => null,
}));

jest.mock('../src/components/EmptyState', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/components/ShareButton', () => ({
  ShareButton: () => null,
}));

jest.mock('../src/components/ARTimeTravelView', () => ({
  __esModule: true,
  default: () => null,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Feature Screens — smoke tests', () => {
  it('search renders without crashing', () => {
    const SearchScreen = require('../search').default;
    const { toJSON } = render(<SearchScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('premium renders without crashing', () => {
    const PremiumScreen = require('../premium').default;
    const { toJSON } = render(<PremiumScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('gamification renders without crashing', () => {
    const GamificationScreen = require('../gamification').default;
    const { toJSON } = render(<GamificationScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('leaderboard renders without crashing', () => {
    const LeaderboardScreen = require('../leaderboard').default;
    const { toJSON } = render(<LeaderboardScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('achievements renders without crashing', () => {
    const AchievementsScreen = require('../achievements').default;
    const { toJSON } = render(<AchievementsScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('onboarding renders without crashing', () => {
    const OnboardingScreen = require('../onboarding').default;
    const { toJSON } = render(<OnboardingScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('ar-time-travel renders without crashing', () => {
    const ARTimeTravelScreen = require('../ar-time-travel').default;
    const { toJSON } = render(<ARTimeTravelScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('explore-around renders without crashing', () => {
    const ExploreAroundScreen = require('../explore-around').default;
    const { toJSON } = render(<ExploreAroundScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('nearby renders without crashing', () => {
    const NearbyScreen = require('../nearby').default;
    const { toJSON } = render(<NearbyScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('calendar renders without crashing', () => {
    const CalendarScreen = require('../calendar').default;
    const { toJSON } = render(<CalendarScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('smart-routes renders without crashing', () => {
    const SmartRoutesScreen = require('../smart-routes').default;
    const { toJSON } = render(<SmartRoutesScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
