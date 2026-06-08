/**
 * Tests for app/fauna/index.tsx
 * Covers: render, title, tabs, habitat filters, species count
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
    bg: '#1A1200', card: '#261A00', accent: '#D97706',
    accentMuted: '#78350F20', textPrimary: '#FDE68A',
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
jest.mock('../../src/components/FaunaSpeciesCard', () => ({
  __esModule: true,
  default: ({ species }: any) => {
    const { Text } = require('react-native');
    return <Text>{species.common_name}</Text>;
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fauna/index', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { toJSON } = render(<FaunaScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows screen title', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getByText } = render(<FaunaScreen />);
    expect(getByText('Atlas de Fauna')).toBeTruthy();
  });

  it('shows subtitle', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getByText } = render(<FaunaScreen />);
    expect(getByText('Vida Selvagem · Endemismos · Rotas de Observação')).toBeTruthy();
  });

  it('renders all category tabs', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getAllByText, getByText } = render(<FaunaScreen />);
    // "Todos" appears in both tabs and habitat filters
    expect(getAllByText('Todos').length).toBeGreaterThanOrEqual(2);
    expect(getByText('Aves')).toBeTruthy();
    expect(getByText('Mamíferos')).toBeTruthy();
    expect(getByText('Répteis')).toBeTruthy();
  });

  it('shows habitat filter chips', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getByText } = render(<FaunaScreen />);
    expect(getByText('Montanha')).toBeTruthy();
    expect(getByText('Zonas Húmidas')).toBeTruthy();
    expect(getByText('Marinho')).toBeTruthy();
  });

  it('shows flagship banner with count', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getByText } = render(<FaunaScreen />);
    expect(getByText(/espécies bandeira/)).toBeTruthy();
  });

  it('renders species list (Lobo-ibérico visible)', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getByText } = render(<FaunaScreen />);
    expect(getByText('Lobo-ibérico')).toBeTruthy();
  });

  it('shows species count summary text', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getAllByText } = render(<FaunaScreen />);
    // Summary line like "15 espécies encontradas"
    expect(getAllByText(/espécie/).length).toBeGreaterThan(0);
  });

  it('filters to Aves tab when pressed', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getByText, queryByText } = render(<FaunaScreen />);
    fireEvent.press(getByText('Aves'));
    // Lobo-ibérico is mammal, should not appear in Aves tab
    expect(queryByText('Lobo-ibérico')).toBeNull();
  });

  it('shows Épicos tab and filters to epic species', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getByText } = render(<FaunaScreen />);
    fireEvent.press(getByText('Épicos'));
    // Lince-ibérico is Épico
    expect(getByText('Lince-ibérico')).toBeTruthy();
  });

  it('shows data sources footer', () => {
    const FaunaScreen = require('../fauna/index').default;
    const { getByText } = render(<FaunaScreen />);
    expect(getByText(/ICNF/)).toBeTruthy();
  });
});
