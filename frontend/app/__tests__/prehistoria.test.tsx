/**
 * Tests for app/prehistoria/index.tsx
 * Covers: render, title, category tabs, period filters, site list, astronomy banner
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
jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, isDark: false, toggleTheme: jest.fn() }),
}));

jest.mock('../../src/theme/colors', () => ({
  getModuleTheme: () => ({
    bg: '#1A1000', card: '#261600', accent: '#D97706',
    accentMuted: '#78350F20', textPrimary: '#FEF3C7',
    textSecondary: '#FCD34D', textMuted: '#92400E',
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
jest.mock('../../src/components/PrehistoriaCard', () => ({
  __esModule: true,
  default: ({ site }: any) => {
    const { Text } = require('react-native');
    return <Text>{site.name}</Text>;
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('prehistoria/index', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { toJSON } = render(<PrehistoriaScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows screen title', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    expect(getByText('Pré-História')).toBeTruthy();
  });

  it('shows subtitle', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    expect(getByText('Geossítios · Megalitos · Arte Rupestre · Astronomia')).toBeTruthy();
  });

  it('renders category tabs', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    expect(getByText('Megalitos')).toBeTruthy();
    expect(getByText('Arte Rupestre')).toBeTruthy();
    expect(getByText('Geossítios')).toBeTruthy();
    expect(getByText('Astronomia')).toBeTruthy();
  });

  it('renders period filter chips', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    expect(getByText('Paleolítico')).toBeTruthy();
    expect(getByText('Neolítico')).toBeTruthy();
    expect(getByText('Calcolítico')).toBeTruthy();
    expect(getByText('Bronze')).toBeTruthy();
    expect(getByText('Ferro')).toBeTruthy();
  });

  it('shows site list with Cromeleque dos Almendres', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    expect(getByText('Cromeleque dos Almendres')).toBeTruthy();
  });

  it('shows Arte Rupestre do Vale do Côa in the list', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    expect(getByText('Arte Rupestre do Vale do Côa')).toBeTruthy();
  });

  it('shows site count summary', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    expect(getByText(/sítios encontrados/)).toBeTruthy();
  });

  it('filters to Megalitos category', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText, queryByText } = render(<PrehistoriaScreen />);
    fireEvent.press(getByText('Megalitos'));
    // Should still show Almendres (is megalito)
    expect(getByText('Cromeleque dos Almendres')).toBeTruthy();
    // Arte Rupestre do Côa should not appear (is rupestre)
    expect(queryByText('Arte Rupestre do Vale do Côa')).toBeNull();
  });

  it('shows astronomy banner when Astronomia tab selected', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    fireEvent.press(getByText('Astronomia'));
    expect(getByText('Próximo evento')).toBeTruthy();
  });

  it('filters to Paleolítico period', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText, queryByText } = render(<PrehistoriaScreen />);
    fireEvent.press(getByText('Paleolítico'));
    // Vale do Côa is Paleolítico
    expect(getByText('Arte Rupestre do Vale do Côa')).toBeTruthy();
    // Almendres is Neolítico, should not appear
    expect(queryByText('Cromeleque dos Almendres')).toBeNull();
  });

  it('shows data sources footer', () => {
    const PrehistoriaScreen = require('../prehistoria/index').default;
    const { getByText } = render(<PrehistoriaScreen />);
    expect(getByText(/DGPC/)).toBeTruthy();
  });
});
