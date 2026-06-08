/**
 * Tests for app/gastronomia/index.tsx
 * Covers: render, title, category tabs, region filter, dish list, empty state
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
    bg: '#261200', card: '#3D1E00', accent: '#D97706',
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
jest.mock('../../src/components/GastronomyDishCard', () => ({
  __esModule: true,
  default: ({ dish }: any) => {
    const { Text } = require('react-native');
    return <Text>{dish.name}</Text>;
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('gastronomia/index', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { toJSON } = render(<GastronomiaScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows screen title', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText } = render(<GastronomiaScreen />);
    expect(getByText('Gastronomia Costeira')).toBeTruthy();
  });

  it('shows subtitle', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText } = render(<GastronomiaScreen />);
    expect(getByText('Pratos · Tradições · Sabores do Mar')).toBeTruthy();
  });

  it('renders category tabs', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText } = render(<GastronomiaScreen />);
    expect(getByText('Peixe')).toBeTruthy();
    expect(getByText('Marisco')).toBeTruthy();
    expect(getByText('Sopas')).toBeTruthy();
    expect(getByText('Doces')).toBeTruthy();
    expect(getByText('Tradicionais')).toBeTruthy();
  });

  it('renders region filter chips', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText } = render(<GastronomiaScreen />);
    expect(getByText('Minho')).toBeTruthy();
    expect(getByText('Algarve')).toBeTruthy();
    expect(getByText('Açores')).toBeTruthy();
  });

  it('shows seasonal banner with dish count', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText, getAllByText } = render(<GastronomiaScreen />);
    expect(getByText(/Em época agora/)).toBeTruthy();
    expect(getAllByText(/pratos/).length).toBeGreaterThan(0);
  });

  it('renders dish list with Caldeirada de Peixe', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText } = render(<GastronomiaScreen />);
    expect(getByText('Caldeirada de Peixe')).toBeTruthy();
  });

  it('renders dish list with Sardinhas Assadas', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText } = render(<GastronomiaScreen />);
    expect(getByText('Sardinhas Assadas')).toBeTruthy();
  });

  it('filters to Marisco category', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText, queryByText } = render(<GastronomiaScreen />);
    fireEvent.press(getByText('Marisco'));
    expect(getByText('Amêijoas à Bulhão Pato')).toBeTruthy();
    // Caldeirada de Peixe is type 'tradicional', should disappear
    expect(queryByText('Caldeirada de Peixe')).toBeNull();
  });

  it('filters by Algarve region', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText, queryByText } = render(<GastronomiaScreen />);
    fireEvent.press(getByText('Algarve'));
    // Arroz de Lingueirão is from Algarve
    expect(getByText('Arroz de Lingueirão')).toBeTruthy();
  });

  it('shows empty state when no dishes match a narrow filter', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText } = render(<GastronomiaScreen />);
    // Filter to Doces + Minho region — unlikely to have a match
    fireEvent.press(getByText('Doces'));
    fireEvent.press(getByText('Minho'));
    expect(getByText('Nenhum prato encontrado')).toBeTruthy();
  });

  it('shows data sources footer', () => {
    const GastronomiaScreen = require('../gastronomia/index').default;
    const { getByText } = render(<GastronomiaScreen />);
    expect(getByText(/DGRM/)).toBeTruthy();
  });
});
