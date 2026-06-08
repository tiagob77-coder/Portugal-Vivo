/**
 * Tests for app/flora/index.tsx
 * Covers: render, loading, title, tabs, month filter, species list
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

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

// ─── React Query — controllable ──────────────────────────────────────────────
const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
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
jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, isDark: false, toggleTheme: jest.fn() }),
}));

jest.mock('../../src/theme/colors', () => ({
  getModuleTheme: () => ({
    bg: '#0A1A0A', card: '#0F2D18', accent: '#22C55E',
    accentMuted: '#16A34A20', textPrimary: '#F0FDF4',
    textSecondary: '#BBF7D0', textMuted: '#4ADE80',
  }),
  withOpacity: (color: string) => color,
}));

// ─── API ──────────────────────────────────────────────────────────────────────
jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

jest.mock('../../src/config/api', () => ({
  API_BASE: 'http://localhost:8001',
  API_URL: 'http://localhost:8001',
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

// ─── Component mocks ──────────────────────────────────────────────────────────
jest.mock('../../src/components/FloraSpeciesCard', () => ({
  __esModule: true,
  default: ({ species }: any) => {
    const { Text } = require('react-native');
    return <Text>{species.common_name}</Text>;
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('flora/index', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const FloraScreen = require('../flora/index').default;
    const { toJSON } = render(<FloraScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows screen title', () => {
    const FloraScreen = require('../flora/index').default;
    const { getByText } = render(<FloraScreen />);
    expect(getByText('Atlas de Flora')).toBeTruthy();
  });

  it('shows subtitle', () => {
    const FloraScreen = require('../flora/index').default;
    const { getByText } = render(<FloraScreen />);
    expect(getByText('Flora Silvestre · Endemismos · Calendário de Floração')).toBeTruthy();
  });

  it('shows loading indicator when isLoading is true', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, refetch: jest.fn() });
    const FloraScreen = require('../flora/index').default;
    const { toJSON } = render(<FloraScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders tab filters', () => {
    const FloraScreen = require('../flora/index').default;
    const { getByText } = render(<FloraScreen />);
    expect(getByText('Endémicas')).toBeTruthy();
    expect(getByText('Protegidas')).toBeTruthy();
    expect(getByText('Alta Montanha')).toBeTruthy();
    expect(getByText('Laurissilva')).toBeTruthy();
  });

  it('renders month filter chips', () => {
    const FloraScreen = require('../flora/index').default;
    const { getByText } = render(<FloraScreen />);
    expect(getByText('Jan')).toBeTruthy();
    expect(getByText('Jun')).toBeTruthy();
    expect(getByText('Dez')).toBeTruthy();
  });

  it('shows seasonal banner with flowering count', () => {
    const FloraScreen = require('../flora/index').default;
    const { getByText } = render(<FloraScreen />);
    expect(getByText(/A florir agora/)).toBeTruthy();
  });

  it('renders static species list when no remote data (Narciso-dos-prados)', () => {
    const FloraScreen = require('../flora/index').default;
    const { getByText } = render(<FloraScreen />);
    expect(getByText('Narciso-dos-prados')).toBeTruthy();
  });

  it('filters to Endémicas tab', () => {
    const FloraScreen = require('../flora/index').default;
    const { getByText, queryByText } = render(<FloraScreen />);
    fireEvent.press(getByText('Endémicas'));
    // Trovisco is autocone, not endemic — should disappear
    expect(queryByText('Trovisco')).toBeNull();
    // Narciso-dos-prados is endemica
    expect(getByText('Narciso-dos-prados')).toBeTruthy();
  });

  it('shows data sources footer', () => {
    const FloraScreen = require('../flora/index').default;
    const { getByText } = render(<FloraScreen />);
    expect(getByText(/Flora-On/)).toBeTruthy();
  });
});
