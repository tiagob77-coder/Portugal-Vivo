// @ts-nocheck
/**
 * Smoke tests for all (tabs) screens.
 * Verifies each screen renders without crashing.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// ─── expo-router ──────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
}));

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

// ─── React Query ──────────────────────────────────────────────────────────────
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  QueryClient: jest.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }: any) => children,
}));

// ─── Auth ─────────────────────────────────────────────────────────────────────
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
    refreshUser: jest.fn(),
    refreshSubscription: jest.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

// ─── Theme ────────────────────────────────────────────────────────────────────
const mockPalette = {
  gray: { 50: '#FAF8F3', 100: '#F2EDE4', 200: '#E5E0D5', 300: '#D1CCBF', 400: '#9A958A', 500: '#6B665C', 600: '#4A4A4A', 700: '#3A3A3A', 800: '#1C1F1C', 900: '#111311' },
  forest: { 50: '#EEF4F0', 100: '#D9EBE0', 200: '#B3D7C2', 300: '#8DC3A4', 400: '#3F6F4A', 500: '#2E5E4E', 600: '#245048', 700: '#1B3D39', 800: '#122B2A', 900: '#0A1A1A' },
  terracotta: { 50: '#FDF7F2', 100: '#FAEADE', 200: '#F4D3BC', 300: '#EDBC9B', 400: '#E6A47A', 500: '#C49A6C', 600: '#B08556', 700: '#8A6642', 800: '#64472F', 900: '#3E2A1B' },
  ocean: { 50: '#EEF9FF', 100: '#D9F2FF', 200: '#B3E5FF', 300: '#7DD3FC', 400: '#38BDF8', 500: '#0891B2', 600: '#0E7490', 700: '#155E75', 800: '#164E63', 900: '#0C3547' },
  rust: { 50: '#FFF0EE', 100: '#FFE0DB', 200: '#FFC2B8', 300: '#FFA395', 400: '#FF7B72', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C', 800: '#991B1B', 900: '#7F1D1D' },
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
const mockBorders = {
  radius: { none: 0, sm: 4, md: 8, lg: 12, xl: 16, '2xl': 20, '3xl': 24, full: 9999 },
};
const mockShadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
};

jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: mockColors, isDark: false, toggleTheme: jest.fn() }),
  ThemeProvider: ({ children }: any) => children,
}));

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: mockColors }),
  palette: mockPalette,
  colors: mockColors,
  typography: mockTypography,
  spacing: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80 },
  borders: mockBorders,
  shadows: mockShadows,
  regionImages: { hero: '', norte: '', centro: '', lisboa: '', alentejo: '', algarve: '', acores: '', madeira: '' },
  withOpacity: (color: string, _opacity: number) => color,
  getCategoryColor: jest.fn(() => '#000'),
  getCategoryBg: jest.fn(() => '#fff'),
  lightColors: mockColors,
  darkColors: mockColors,
  categoryColors: {},
  stateColors: {},
  mapColors: {},
}));

// ─── API services ─────────────────────────────────────────────────────────────
jest.mock('../../src/services/api', () => {
  const mockNoop = jest.fn(() => Promise.resolve([]));
  return {
    __esModule: true,
    default: {
      get: jest.fn(() => Promise.resolve({ data: [] })),
      post: jest.fn(() => Promise.resolve({ data: {} })),
    },
    getCategories: mockNoop,
    getHeritageItems: mockNoop,
    getStats: jest.fn(() => Promise.resolve({ categories: [], total: 0 })),
    getRegions: mockNoop,
    getRoutes: mockNoop,
    getAgendaEvents: mockNoop,
    getDiscoveryFeed: mockNoop,
    getTrendingItems: mockNoop,
    getEncyclopediaUniverses: mockNoop,
    getPOIDoDia: jest.fn(() => Promise.resolve(null)),
    getWeatherForecast: mockNoop,
    getWeatherAlerts: mockNoop,
    getSafetyCheck: jest.fn(() => Promise.resolve({})),
    getActiveFires: mockNoop,
    getAllSpotsConditions: mockNoop,
    getCalendarEvents: mockNoop,
    getUpcomingEvents: mockNoop,
    getVisitHistory: mockNoop,
    getFavorites: mockNoop,
    getBadges: mockNoop,
    getGamificationProfile: jest.fn(() => Promise.resolve({})),
    getSubscriptionStatus: jest.fn(() => Promise.resolve({ tier: 'free' })),
    getApprovedContributions: mockNoop,
    createContribution: jest.fn(() => Promise.resolve({})),
    voteContribution: jest.fn(() => Promise.resolve({})),
    getLocalities: mockNoop,
    generateSmartItinerary: jest.fn(() => Promise.resolve({})),
    generateAiItinerary: jest.fn(() => Promise.resolve({})),
    saveItinerary: jest.fn(() => Promise.resolve({})),
    listItineraries: mockNoop,
  };
});

jest.mock('../../src/config/api', () => ({
  API_BASE: 'http://localhost:8000',
  API_URL: 'http://localhost:8000',
}));

// ─── Native dependencies ───────────────────────────────────────────────────────
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

jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: 'MapView',
  Marker: 'Marker',
  Callout: 'Callout',
  PROVIDER_GOOGLE: 'google',
}));

jest.mock('../../src/components/NativeMap', () => ({
  __esModule: true,
  default: 'MapView',
  MapView: 'MapView',
  Marker: 'Marker',
  Callout: 'Callout',
  PROVIDER_GOOGLE: 'google',
  isMapAvailable: false,
  LeafletMapComponent: () => null,
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 38.7, longitude: -9.1 } })
  ),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  Accuracy: { High: 3, Balanced: 2 },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pt', changeLanguage: jest.fn() },
  }),
}));

jest.mock('../../src/i18n', () => ({
  LANGUAGES: [{ code: 'pt', name: 'Português', flag: '🇵🇹' }],
  changeLanguage: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../src/services/pushNotifications', () => ({
  pushNotificationService: {
    initialize: jest.fn(),
    requestPermissions: jest.fn(() => Promise.resolve(false)),
  },
}));

jest.mock('../../src/services/backgroundTasks', () => ({
  registerBackgroundTasks: jest.fn(() => Promise.resolve()),
  unregisterBackgroundTasks: jest.fn(() => Promise.resolve()),
  startWebProximityPolling: jest.fn(),
  stopWebProximityPolling: jest.fn(),
}));

jest.mock('../../src/components/OnboardingModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/components/GeofenceControl', () => ({
  GeofenceControl: () => null,
}));

jest.mock('../../src/components/map', () => ({
  MapLayerSelector: () => null,
  MapModeSelector: () => null,
  TimelineControls: () => null,
  ProximityPanel: () => null,
  NightExplorerPanel: () => null,
  NIGHT_FILTERS: [],
}));

jest.mock('../../src/components/AccessibilityFilters', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('expo-av', () => ({
  Audio: { Sound: { createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn() } })) } },
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('../../src/components/ImageUpload', () => ({
  __esModule: true,
  default: () => null,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Tab Screens — smoke tests', () => {
  it('(tabs)/index renders without crashing', () => {
    const ExploreScreen = require('../(tabs)/index').default;
    const { getByText } = render(<ExploreScreen />);
    expect(getByText('Explorar')).toBeTruthy();
  });

  it('(tabs)/descobrir renders without crashing', () => {
    const DescobrirScreen = require('../(tabs)/descobrir').default;
    const { toJSON } = render(<DescobrirScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/mapa renders without crashing', () => {
    const MapaScreen = require('../(tabs)/mapa').default;
    const { toJSON } = render(<MapaScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/map renders without crashing', () => {
    const MapScreen = require('../(tabs)/map').default;
    const { toJSON } = render(<MapScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/routes renders without crashing', () => {
    const RoutesScreen = require('../(tabs)/routes').default;
    const { toJSON } = render(<RoutesScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/eventos renders without crashing', () => {
    const EventosScreen = require('../(tabs)/eventos').default;
    const { toJSON } = render(<EventosScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/experienciar renders without crashing', () => {
    const ExperienciarScreen = require('../(tabs)/experienciar').default;
    const { toJSON } = render(<ExperienciarScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/coleccoes renders without crashing', () => {
    const ColeccoesScreen = require('../(tabs)/coleccoes').default;
    const { toJSON } = render(<ColeccoesScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/planeador renders without crashing', () => {
    const PlaneadorScreen = require('../(tabs)/planeador').default;
    const { toJSON } = render(<PlaneadorScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/profile renders without crashing', () => {
    const ProfileScreen = require('../(tabs)/profile').default;
    const { toJSON } = render(<ProfileScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/transportes renders without crashing', () => {
    const TransportesScreen = require('../(tabs)/transportes').default;
    const { toJSON } = render(<TransportesScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/beachcams renders without crashing', () => {
    const BeachcamsTabScreen = require('../(tabs)/beachcams').default;
    const { toJSON } = render(<BeachcamsTabScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('(tabs)/community renders without crashing', () => {
    const CommunityScreen = require('../(tabs)/community').default;
    const { toJSON } = render(<CommunityScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
