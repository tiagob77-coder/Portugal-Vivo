/**
 * Tests for app/cultura-maritima/index.tsx
 * Covers: render, title, type tabs, region filter, events list, empty state
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
    bg: '#030B1A', card: '#071428', accent: '#1E40AF',
    accentMuted: '#1D4ED820', textPrimary: '#DBEAFE',
    textSecondary: '#BFDBFE', textMuted: '#60A5FA',
  }),
  withOpacity: (color: string, _opacity: number) => color + '1E',
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
jest.mock('../../src/components/MaritimeCultureCard', () => ({
  __esModule: true,
  default: ({ event }: any) => {
    const { Text } = require('react-native');
    return <Text>{event.name}</Text>;
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cultura-maritima/index', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { toJSON } = render(<CulturaScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows screen title', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText } = render(<CulturaScreen />);
    expect(getByText('Cultura Marítima')).toBeTruthy();
  });

  it('shows subtitle', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText } = render(<CulturaScreen />);
    expect(getByText('Rituais · Festas · Procissões ao Mar')).toBeTruthy();
  });

  it('renders type tabs', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText } = render(<CulturaScreen />);
    expect(getByText('Procissões')).toBeTruthy();
    expect(getByText('Bênçãos')).toBeTruthy();
    expect(getByText('Festas')).toBeTruthy();
    expect(getByText('Rituais')).toBeTruthy();
    expect(getByText('Tradições')).toBeTruthy();
  });

  it('renders region filter chips', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText } = render(<CulturaScreen />);
    expect(getByText('Minho')).toBeTruthy();
    expect(getByText('Norte')).toBeTruthy();
    expect(getByText('Açores')).toBeTruthy();
  });

  it('shows events list with Festa da Nossa Senhora da Agonia', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText } = render(<CulturaScreen />);
    expect(getByText('Festa da Nossa Senhora da Agonia')).toBeTruthy();
  });

  it('shows events list with Procissão de Nossa Senhora da Boa Viagem', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText } = render(<CulturaScreen />);
    expect(getByText('Procissão de Nossa Senhora da Boa Viagem')).toBeTruthy();
  });

  it('shows event count summary', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getAllByText } = render(<CulturaScreen />);
    expect(getAllByText(/evento/).length).toBeGreaterThan(0);
  });

  it('filters to Procissões type', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText, queryByText } = render(<CulturaScreen />);
    fireEvent.press(getByText('Procissões'));
    // Procissão de Nossa Sra da Boa Viagem is procissao_maritima
    expect(getByText('Procissão de Nossa Senhora da Boa Viagem')).toBeTruthy();
    // Banho Santo de São Bartolomeu is banho_santo, not procissao — should disappear
    expect(queryByText('Banho Santo de São Bartolomeu')).toBeNull();
  });

  it('filters to Minho region', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText, queryByText } = render(<CulturaScreen />);
    fireEvent.press(getByText('Minho'));
    // Festa da Agonia is Minho
    expect(getByText('Festa da Nossa Senhora da Agonia')).toBeTruthy();
    // Procissão dos Pescadores de Nazaré is Centro — should not appear
    expect(queryByText('Procissão dos Pescadores de Nazaré')).toBeNull();
  });

  it('shows empty state when no events match filter', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText } = render(<CulturaScreen />);
    // Alentejo has no maritime culture events
    fireEvent.press(getByText('Alentejo'));
    expect(getByText('Sem eventos nesta categoria')).toBeTruthy();
  });

  it('shows data sources footer', () => {
    const CulturaScreen = require('../cultura-maritima/index').default;
    const { getByText } = render(<CulturaScreen />);
    // Footer text includes "Associações de Pescadores"
    expect(getByText(/DGPC · Municípios · Associações de Pescadores/)).toBeTruthy();
  });
});
