/**
 * Tests for app/biodiversidade/index.tsx
 * Covers: render, title, category tabs, season filter, species list, empty state
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
    bg: '#071828', card: '#0A2236', accent: '#06B6D4',
    accentMuted: '#0891B220', textPrimary: '#E0F2FE',
    textSecondary: '#BAE6FD', textMuted: '#0369A1',
  }),
  withOpacity: (color: string, _opacity: number) => color + '14',
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
jest.mock('../../src/components/MarineSpeciesCard', () => ({
  __esModule: true,
  default: ({ species }: any) => {
    const { Text } = require('react-native');
    return <Text>{species.common_name_pt}</Text>;
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('biodiversidade/index', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { toJSON } = render(<BiodiversidadeScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows screen title', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText } = render(<BiodiversidadeScreen />);
    expect(getByText('Vida Marinha')).toBeTruthy();
  });

  it('shows subtitle', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText } = render(<BiodiversidadeScreen />);
    expect(getByText('Espécies · Habitats · Avistamentos')).toBeTruthy();
  });

  it('renders category tabs', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText } = render(<BiodiversidadeScreen />);
    expect(getByText('Mamíferos')).toBeTruthy();
    expect(getByText('Aves')).toBeTruthy();
    expect(getByText('Peixes')).toBeTruthy();
    expect(getByText('Invertebrados')).toBeTruthy();
    expect(getByText('Plantas')).toBeTruthy();
  });

  it('renders season filter chips', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText } = render(<BiodiversidadeScreen />);
    expect(getByText('Inverno')).toBeTruthy();
    expect(getByText('Primavera')).toBeTruthy();
    expect(getByText('Verão')).toBeTruthy();
    expect(getByText('Outono')).toBeTruthy();
    expect(getByText('Migração')).toBeTruthy();
  });

  it('shows seasonal banner', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText } = render(<BiodiversidadeScreen />);
    expect(getByText(/Época atual/)).toBeTruthy();
  });

  it('renders species list with Golfinho-comum', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText } = render(<BiodiversidadeScreen />);
    expect(getByText('Golfinho-comum')).toBeTruthy();
  });

  it('shows species count summary', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getAllByText } = render(<BiodiversidadeScreen />);
    expect(getAllByText(/espécie/).length).toBeGreaterThan(0);
  });

  it('filters to Mamíferos category', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText, queryByText } = render(<BiodiversidadeScreen />);
    fireEvent.press(getByText('Mamíferos'));
    expect(getByText('Golfinho-comum')).toBeTruthy();
    // Cagarra is seabird, should not appear
    expect(queryByText('Cagarra')).toBeNull();
  });

  it('filters to Peixes category', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText, queryByText } = render(<BiodiversidadeScreen />);
    fireEvent.press(getByText('Peixes'));
    expect(getByText('Atum-rabilho')).toBeTruthy();
    expect(queryByText('Golfinho-comum')).toBeNull();
  });

  it('shows data sources footer', () => {
    const BiodiversidadeScreen = require('../biodiversidade/index').default;
    const { getByText } = render(<BiodiversidadeScreen />);
    expect(getByText(/FishBase/)).toBeTruthy();
  });
});
