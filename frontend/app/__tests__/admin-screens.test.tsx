// @ts-nocheck
/**
 * Smoke tests for admin / management screens:
 * admin, analytics, dashboard, iq-admin, iq-dashboard, iq-overview, importer, content-toolkit
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// ─── expo-router ──────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
    terracotta: { 500: '#C49A6C' },
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
  getAnalyticsDashboard: jest.fn(() => Promise.resolve({})),
  getAnalyticsTrends: jest.fn(() => Promise.resolve({})),
  getDashboardProgress: jest.fn(() => Promise.resolve({})),
  getDashboardBadges: jest.fn(() => Promise.resolve([])),
  getDashboardStatistics: jest.fn(() => Promise.resolve({})),
  getVisitHistory: jest.fn(() => Promise.resolve([])),
  getIQAdmin: jest.fn(() => Promise.resolve({})),
  getIQHealth: jest.fn(() => Promise.resolve({})),
  processPoiIQ: jest.fn(() => Promise.resolve({})),
  getIQOverview: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../src/config/api', () => ({
  API_BASE: 'http://localhost:8000',
  API_URL: 'http://localhost:8000',
}));

// ─── expo-constants ───────────────────────────────────────────────────────────
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { EXPO_PUBLIC_BACKEND_URL: 'http://localhost:8000' },
    },
  },
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Admin Screens — smoke tests', () => {
  it('admin renders without crashing', () => {
    const AdminScreen = require('../admin').default;
    const { toJSON } = render(<AdminScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('analytics renders without crashing', () => {
    const AnalyticsScreen = require('../analytics').default;
    const { toJSON } = render(<AnalyticsScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('dashboard renders without crashing', () => {
    const DashboardScreen = require('../dashboard').default;
    const { toJSON } = render(<DashboardScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('iq-admin renders without crashing', () => {
    const IQAdminScreen = require('../iq-admin').default;
    const { toJSON } = render(<IQAdminScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('iq-dashboard renders without crashing', () => {
    const IQDashboardScreen = require('../iq-dashboard').default;
    const { toJSON } = render(<IQDashboardScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('iq-overview renders without crashing', () => {
    const IQOverviewScreen = require('../iq-overview').default;
    const { toJSON } = render(<IQOverviewScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('importer renders without crashing', () => {
    const ImporterScreen = require('../importer').default;
    const { toJSON } = render(<ImporterScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('content-toolkit renders without crashing', () => {
    const ContentToolkitScreen = require('../content-toolkit').default;
    const { toJSON } = render(<ContentToolkitScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
