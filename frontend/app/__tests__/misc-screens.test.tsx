// @ts-nocheck
/**
 * Smoke tests for miscellaneous screens:
 * auth, comboios, beachcams (standalone), route-planner, categories,
 * encyclopedia/index, encyclopedia/universe/[id], timeline/[region],
 * settings/language, settings/offline
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// ─── expo-router ──────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'gastronomia', region: 'norte' }),
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
jest.mock('../../src/context/AuthContext', () => ({
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
};
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: mockColors, isDark: false, toggleTheme: jest.fn() }),
}));
jest.mock('../../src/context/ThemeContext', () => ({
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
jest.mock('../../src/theme', () => ({
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
  getCategories: jest.fn(() => Promise.resolve([])),
  getMainCategories: jest.fn(() => Promise.resolve([])),
  getEncyclopediaUniverses: jest.fn(() => Promise.resolve([])),
  getEncyclopediaFeatured: jest.fn(() => Promise.resolve([])),
  getEncyclopediaUniverse: jest.fn(() => Promise.resolve({})),
  getCalendarEvents: jest.fn(() => Promise.resolve([])),
  getUpcomingEvents: jest.fn(() => Promise.resolve([])),
  planRoute: jest.fn(() => Promise.resolve({})),
  generateSmartItinerary: jest.fn(() => Promise.resolve({})),
  getLocalities: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
  getCategories: jest.fn(() => Promise.resolve([])),
  getMainCategories: jest.fn(() => Promise.resolve([])),
  getEncyclopediaUniverses: jest.fn(() => Promise.resolve([])),
  getEncyclopediaFeatured: jest.fn(() => Promise.resolve([])),
  getEncyclopediaUniverse: jest.fn(() => Promise.resolve({})),
  getCalendarEvents: jest.fn(() => Promise.resolve([])),
  getUpcomingEvents: jest.fn(() => Promise.resolve([])),
  planRoute: jest.fn(() => Promise.resolve({})),
  generateSmartItinerary: jest.fn(() => Promise.resolve({})),
  getLocalities: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../src/config/api', () => ({
  API_BASE: 'http://localhost:8000',
  API_URL: 'http://localhost:8000',
}));
jest.mock('../../src/config/api', () => ({
  API_BASE: 'http://localhost:8000',
  API_URL: 'http://localhost:8000',
}));

// ─── Offline cache ────────────────────────────────────────────────────────────
jest.mock('../src/services/offlineCache', () => ({
  __esModule: true,
  default: { get: jest.fn(() => null), set: jest.fn(), clear: jest.fn() },
}));
jest.mock('../../src/services/offlineCache', () => ({
  __esModule: true,
  default: { get: jest.fn(() => null), set: jest.fn(), clear: jest.fn() },
  offlineCache: { get: jest.fn(() => null), set: jest.fn(), clear: jest.fn() },
}));

// ─── i18n ─────────────────────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pt', changeLanguage: jest.fn() },
  }),
}));
jest.mock('../src/i18n', () => ({
  LANGUAGES: [
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ],
  changeLanguage: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../src/i18n', () => ({
  LANGUAGES: [
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ],
  changeLanguage: jest.fn(() => Promise.resolve()),
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

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Misc Screens — smoke tests', () => {
  it('auth renders without crashing', () => {
    const AuthScreen = require('../auth').default;
    const { toJSON } = render(<AuthScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('comboios renders without crashing', () => {
    const ComboiosScreen = require('../comboios').default;
    const { toJSON } = render(<ComboiosScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('beachcams (standalone) renders without crashing', () => {
    const BeachcamsScreen = require('../beachcams').default;
    const { toJSON } = render(<BeachcamsScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('route-planner renders without crashing', () => {
    const RoutePlannerScreen = require('../route-planner').default;
    const { toJSON } = render(<RoutePlannerScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('categories renders without crashing', () => {
    const CategoriesScreen = require('../categories').default;
    const { toJSON } = render(<CategoriesScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('encyclopedia/index renders without crashing', () => {
    const EncyclopediaIndex = require('../encyclopedia/index').default;
    const { toJSON } = render(<EncyclopediaIndex />);
    expect(toJSON()).toBeTruthy();
  });

  it('encyclopedia/universe/[id] renders without crashing', () => {
    const UniverseDetail = require('../encyclopedia/universe/[id]').default;
    const { toJSON } = render(<UniverseDetail />);
    expect(toJSON()).toBeTruthy();
  });

  it('timeline/[region] renders without crashing', () => {
    const TimelineScreen = require('../timeline/[region]').default;
    const { toJSON } = render(<TimelineScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('settings/language renders without crashing', () => {
    const LanguageScreen = require('../settings/language').default;
    const { getByText } = render(<LanguageScreen />);
    expect(getByText('Português')).toBeTruthy();
  });

  it('settings/offline renders without crashing', () => {
    const OfflineScreen = require('../settings/offline').default;
    const { toJSON } = render(<OfflineScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
