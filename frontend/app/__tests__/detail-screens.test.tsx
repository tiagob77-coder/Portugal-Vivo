// @ts-nocheck
/**
 * Smoke tests for detail / dynamic-route screens.
 * Verifies each screen renders without crashing when given a mock param.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// ─── expo-router ──────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({
    id: 'test-id',
    region: 'norte',
    itemId: 'poi-001',
    itemName: 'Test Item',
    itemCategory: 'termas',
    itemRegion: 'centro',
    imageUrl: '',
  }),
  Link: ({ children }: any) => children,
  Stack: {
    Screen: () => null,
    __esModule: true,
    default: ({ children }: any) => children,
  },
}));

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: any) => children,
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
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
    sessionToken: null,
    isPremium: false,
    premiumTier: 'free',
  }),
}));
// heritage/[id] uses relative path
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
    sessionToken: null,
    isPremium: false,
    premiumTier: 'free',
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
    forest: { 500: '#2E5E4E' },
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
    forest: { 500: '#2E5E4E' },
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
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
  },
  getHeritageItem: jest.fn(() => Promise.resolve(null)),
  getHeritageItems: jest.fn(() => Promise.resolve([])),
  getCategories: jest.fn(() => Promise.resolve([])),
  generateNarrative: jest.fn(() => Promise.resolve({})),
  addFavorite: jest.fn(() => Promise.resolve({})),
  removeFavorite: jest.fn(() => Promise.resolve({})),
  getAudioGuideForItem: jest.fn(() => Promise.resolve(null)),
  doCheckin: jest.fn(() => Promise.resolve({})),
  getPoiImages: jest.fn(() => Promise.resolve([])),
  getRoute: jest.fn(() => Promise.resolve(null)),
  getRouteItems: jest.fn(() => Promise.resolve([])),
  getAgendaEventDetail: jest.fn(() => Promise.resolve(null)),
  getItinerary: jest.fn(() => Promise.resolve(null)),
  updateItinerary: jest.fn(() => Promise.resolve({})),
  deleteItinerary: jest.fn(() => Promise.resolve({})),
  shareItinerary: jest.fn(() => Promise.resolve({})),
  getItineraryComments: jest.fn(() => Promise.resolve([])),
  addItineraryComment: jest.fn(() => Promise.resolve({})),
  getItineraryBudget: jest.fn(() => Promise.resolve({})),
  voteItineraryPoi: jest.fn(() => Promise.resolve({})),
  getAgendaEvents: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
  },
  getHeritageItem: jest.fn(() => Promise.resolve(null)),
  getHeritageItems: jest.fn(() => Promise.resolve([])),
  getCategories: jest.fn(() => Promise.resolve([])),
  generateNarrative: jest.fn(() => Promise.resolve({})),
  addFavorite: jest.fn(() => Promise.resolve({})),
  removeFavorite: jest.fn(() => Promise.resolve({})),
  getAudioGuideForItem: jest.fn(() => Promise.resolve(null)),
  doCheckin: jest.fn(() => Promise.resolve({})),
  getPoiImages: jest.fn(() => Promise.resolve([])),
  getRoute: jest.fn(() => Promise.resolve(null)),
  getRouteItems: jest.fn(() => Promise.resolve([])),
  getAgendaEventDetail: jest.fn(() => Promise.resolve(null)),
  getItinerary: jest.fn(() => Promise.resolve(null)),
  updateItinerary: jest.fn(() => Promise.resolve({})),
  deleteItinerary: jest.fn(() => Promise.resolve({})),
  shareItinerary: jest.fn(() => Promise.resolve({})),
  getItineraryComments: jest.fn(() => Promise.resolve([])),
  addItineraryComment: jest.fn(() => Promise.resolve({})),
  getItineraryBudget: jest.fn(() => Promise.resolve({})),
  voteItineraryPoi: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../src/config/api', () => ({ API_BASE: 'http://localhost:8000', API_URL: 'http://localhost:8000' }));
jest.mock('../../src/config/api', () => ({ API_BASE: 'http://localhost:8000', API_URL: 'http://localhost:8000' }));

// ─── Offline cache ────────────────────────────────────────────────────────────
jest.mock('../../src/services/offlineCache', () => ({
  __esModule: true,
  default: { get: jest.fn(() => null), set: jest.fn() },
  offlineCache: { get: jest.fn(() => null), set: jest.fn() },
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

jest.mock('expo-av', () => ({
  Audio: {
    Sound: { createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn(), pauseAsync: jest.fn(), unloadAsync: jest.fn() } })) },
    setAudioModeAsync: jest.fn(),
  },
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 38.7, longitude: -9.1 } })
  ),
  Accuracy: { High: 3, Balanced: 2 },
}));

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

jest.mock('../src/components/ReviewsSection', () => ({
  ReviewsSection: () => null,
}));

jest.mock('../../src/components/ReviewsSection', () => ({
  ReviewsSection: () => null,
}));

jest.mock('../src/components/ShareButton', () => ({
  ShareButton: () => null,
}));
jest.mock('../../src/components/ShareButton', () => ({
  ShareButton: () => null,
}));

jest.mock('../src/components/ImageUpload', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/components/ImageUpload', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/components/HeritageCard', () => ({
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Detail Screens — smoke tests', () => {
  it('heritage/[id] renders without crashing', () => {
    const HeritageDetail = require('../heritage/[id]').default;
    const { toJSON } = render(<HeritageDetail />);
    expect(toJSON()).toBeTruthy();
  });

  it('route/[id] renders without crashing', () => {
    const RouteDetail = require('../route/[id]').default;
    const { toJSON } = render(<RouteDetail />);
    expect(toJSON()).toBeTruthy();
  });

  it('category/[id] renders without crashing', () => {
    const CategoryDetail = require('../category/[id]').default;
    const { toJSON } = render(<CategoryDetail />);
    expect(toJSON()).toBeTruthy();
  });

  it('evento/[id] renders without crashing', () => {
    const EventoDetail = require('../evento/[id]').default;
    const { toJSON } = render(<EventoDetail />);
    expect(toJSON()).toBeTruthy();
  });

  it('profile/[id] renders without crashing', () => {
    const PublicProfile = require('../profile/[id]').default;
    const { toJSON } = render(<PublicProfile />);
    expect(toJSON()).toBeTruthy();
  });

  it('itinerary/[id] renders without crashing', () => {
    const ItineraryDetail = require('../itinerary/[id]').default;
    const { toJSON } = render(<ItineraryDetail />);
    expect(toJSON()).toBeTruthy();
  });
});
