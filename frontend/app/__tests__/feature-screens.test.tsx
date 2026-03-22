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
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null, isLoading: false, isAuthenticated: false,
    login: jest.fn(), logout: jest.fn(), sessionToken: null,
    isPremium: false, premiumTier: 'free',
  }),
}));

// ─── Theme ────────────────────────────────────────────────────────────────────
const mockPalette = {
  gray: { 50: '#FAF8F3', 100: '#F2EDE4', 200: '#E5E0D5', 300: '#D1CCBF', 400: '#9A958A', 500: '#6B665C', 600: '#4A4A4A', 700: '#3A3A3A', 800: '#1C1F1C', 900: '#111311' },
  forest: { 50: '#EEF4F0', 100: '#D9EBE0', 200: '#B3D7C2', 300: '#8DC3A4', 400: '#3F6F4A', 500: '#2E5E4E', 600: '#245048', 700: '#1B3D39', 800: '#122B2A', 900: '#0A1A1A' },
  terracotta: { 50: '#FBF5EF', 100: '#F7EBDF', 200: '#EFD7BF', 300: '#E7C39F', 400: '#DFAF7F', 500: '#C49A6C', 600: '#B08556', 700: '#8A6542', 800: '#64452F', 900: '#3E251B' },
  ocean: { 50: '#EEF9FF', 100: '#D9F2FF', 200: '#B3E5FF', 300: '#7DD3FC', 400: '#38BDF8', 500: '#0891B2', 600: '#0E7490', 700: '#155E75', 800: '#164E63', 900: '#0C3547' },
  rust: { 50: '#FFF0EE', 100: '#FFE0DB', 200: '#FFC2B8', 300: '#FFA395', 400: '#FF7B72', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C', 800: '#991B1B', 900: '#7F1D1D' },
  mint: { 50: '#F0F7F2', 100: '#E1EFE5', 200: '#C3DFCB', 300: '#A5CFB1', 400: '#87BF97', 500: '#6BBF9A', 600: '#55A67E', 700: '#408D63', 800: '#2A7448', 900: '#155B2D' },
  white: '#FFFFFF',
  black: '#000000',
};
const mockColors = {
  ...mockPalette,
  background: { primary: '#FAF8F3', secondary: '#FFFFFF', tertiary: '#F7F4EE', dark: '#2E5E4E' },
  surface: '#f5f5f5',
  textPrimary: '#1C1F1C',
  textSecondary: '#4A4A4A',
  textMuted: '#9A958A',
  accent: '#2E5E4E',
  border: '#E5E0D5',
  card: '#FFFFFF',
  success: '#3FA66B',
  warning: '#E8A23A',
  error: '#C44536',
  info: '#2A6F97',
};
const mockTypography = {
  fontFamily: { sans: 'System', heading: 'System' },
  fontSize: { xs: 10, sm: 12, base: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 28, '4xl': 32, '5xl': 40 },
  fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
};
const mockBorders = { radius: { none: 0, sm: 4, md: 8, lg: 12, xl: 16, '2xl': 20, '3xl': 24, full: 9999 } };
const mockShadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
};
const mockTheme = {
  useTheme: () => ({ colors: mockColors }),
  colors: mockColors,
  palette: mockPalette,
  typography: mockTypography,
  shadows: mockShadows,
  spacing: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80 },
  borders: mockBorders,
  regionImages: { hero: '', norte: '', centro: '', lisboa: '', alentejo: '', algarve: '', acores: '', madeira: '' },
  withOpacity: (color: string) => color,
  getCategoryColor: jest.fn(() => '#000'),
  getCategoryBg: jest.fn(() => '#fff'),
  lightColors: mockColors,
  darkColors: mockColors,
  categoryColors: {},
  stateColors: {},
  mapColors: {},
};
jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: mockColors, isDark: false, toggleTheme: jest.fn() }),
}));
jest.mock('../../src/theme', () => mockTheme);

// ─── API ──────────────────────────────────────────────────────────────────────
jest.mock('../../src/services/api', () => ({
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

jest.mock('../../src/config/api', () => ({
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

jest.mock('../../src/components/BadgeCelebration', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/components/AnimatedListItem', () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

jest.mock('../../src/components/SkeletonCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/components/SearchBar', () => ({
  SearchBar: () => null,
}));

jest.mock('../../src/components/EmptyState', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/components/ShareButton', () => ({
  ShareButton: () => null,
}));

jest.mock('../../src/components/ARTimeTravelView', () => ({
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
