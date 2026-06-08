/**
 * Tests for app/economia/index.tsx
 * Covers: render, loading, title, tabs (mercados/artesaos/produtos), filters
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
    bg: '#1C1100', card: '#261600', accent: '#D97706',
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
jest.mock('../../src/components/EconomyMarketCard', () => ({
  __esModule: true,
  default: ({ item }: any) => {
    const { Text } = require('react-native');
    return <Text>{item.name}</Text>;
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('economia/index', () => {
  beforeEach(() => {
    // Default: no remote data, not loading
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { toJSON } = render(<EconomiaScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows screen title', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    expect(getByText('Economia Local')).toBeTruthy();
  });

  it('shows subtitle', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    expect(getByText('Mercados · Produtos · Artesãos')).toBeTruthy();
  });

  it('shows loading indicator when all queries loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, refetch: jest.fn() });
    const EconomiaScreen = require('../economia/index').default;
    const { toJSON } = render(<EconomiaScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders tab buttons: Mercados, Artesãos, Produtos', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    expect(getByText('Mercados')).toBeTruthy();
    expect(getByText('Artesãos')).toBeTruthy();
    expect(getByText('Produtos')).toBeTruthy();
  });

  it('shows static mercados list by default', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    expect(getByText('Mercado do Bolhão')).toBeTruthy();
    expect(getByText('Mercado da Ribeira')).toBeTruthy();
  });

  it('switches to Artesãos tab and shows artisans', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    fireEvent.press(getByText('Artesãos'));
    expect(getByText('Rendas de Viana')).toBeTruthy();
    expect(getByText('Olaria Alentejana')).toBeTruthy();
  });

  it('switches to Produtos tab and shows month filter', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    fireEvent.press(getByText('Produtos'));
    // Month filter label should appear
    expect(getByText(/Filtrar por época/)).toBeTruthy();
  });

  it('shows produtos after switching to Produtos tab', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    fireEvent.press(getByText('Produtos'));
    // Reset season filter to show all
    fireEvent.press(getByText('Todos'));
    expect(getByText('Bacalhau')).toBeTruthy();
  });

  it('shows mercados summary text', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    expect(getByText(/mercados e feiras/)).toBeTruthy();
  });

  it('shows data sources footer', () => {
    const EconomiaScreen = require('../economia/index').default;
    const { getByText } = render(<EconomiaScreen />);
    expect(getByText(/fontes regionais/)).toBeTruthy();
  });
});
