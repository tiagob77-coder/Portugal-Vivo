/**
 * Tests for app/infraestrutura/index.tsx
 * Covers: render, title, type tabs, accessibility filters, infrastructure list
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
    bg: '#040F07', card: '#071A0C', accent: '#22C55E',
    accentMuted: '#16A34A20', textPrimary: '#F0FDF4',
    textSecondary: '#BBF7D0', textMuted: '#4ADE80',
  }),
  withOpacity: (color: string, _opacity: number) => color + '20',
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
jest.mock('../../src/components/InfrastructureCard', () => ({
  __esModule: true,
  default: ({ item }: any) => {
    const { Text } = require('react-native');
    return <Text>{item.name}</Text>;
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('infraestrutura/index', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { toJSON } = render(<InfraScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows screen title', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText } = render(<InfraScreen />);
    expect(getByText('Infraestrutura Natural')).toBeTruthy();
  });

  it('shows subtitle', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText } = render(<InfraScreen />);
    expect(getByText('Passadiços · Pontes · Ecovias · Miradouros')).toBeTruthy();
  });

  it('renders type tabs', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText } = render(<InfraScreen />);
    expect(getByText('Passadiços')).toBeTruthy();
    expect(getByText('Pontes Suspensas')).toBeTruthy();
    expect(getByText('Ecovias')).toBeTruthy();
    expect(getByText('Miradouros')).toBeTruthy();
    expect(getByText('Torres')).toBeTruthy();
  });

  it('renders accessibility filter chips', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText } = render(<InfraScreen />);
    expect(getByText('Acessível')).toBeTruthy();
    expect(getByText('Família')).toBeTruthy();
    expect(getByText('Cão')).toBeTruthy();
  });

  it('renders infra list with Passadiços do Paiva', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText } = render(<InfraScreen />);
    expect(getByText('Passadiços do Paiva')).toBeTruthy();
  });

  it('renders Ponte 516 Arouca in the list', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText } = render(<InfraScreen />);
    expect(getByText('Ponte 516 Arouca')).toBeTruthy();
  });

  it('shows infrastructure count summary', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText } = render(<InfraScreen />);
    expect(getByText(/infraestrutura/)).toBeTruthy();
  });

  it('filters to Passadiços type', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText, queryByText } = render(<InfraScreen />);
    fireEvent.press(getByText('Passadiços'));
    // Passadiços do Paiva should still appear
    expect(getByText('Passadiços do Paiva')).toBeTruthy();
    // Ponte 516 Arouca is ponte_suspensa — should disappear
    expect(queryByText('Ponte 516 Arouca')).toBeNull();
  });

  it('filters to Pontes Suspensas type', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText, queryByText } = render(<InfraScreen />);
    fireEvent.press(getByText('Pontes Suspensas'));
    expect(getByText('Ponte 516 Arouca')).toBeTruthy();
    expect(queryByText('Passadiços do Paiva')).toBeNull();
  });

  it('filters by Família accessibility', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText, queryByText } = render(<InfraScreen />);
    fireEvent.press(getByText('Família'));
    // Passadiço das Sete Lagoas is family-friendly
    expect(getByText('Passadiço das Sete Lagoas')).toBeTruthy();
    // Passadiços do Paiva is not family-friendly
    expect(queryByText('Passadiços do Paiva')).toBeNull();
  });

  it('shows data sources footer', () => {
    const InfraScreen = require('../infraestrutura/index').default;
    const { getByText } = render(<InfraScreen />);
    expect(getByText(/Turismo de Portugal/)).toBeTruthy();
  });
});
