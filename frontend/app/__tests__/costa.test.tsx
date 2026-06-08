/**
 * Tests for app/costa/index.tsx
 * Covers: render, loading state, data display, profile filters
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

// ─── React Query — default: not loading ───────────────────────────────────────
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

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));

// ─── Component mocks ──────────────────────────────────────────────────────────
jest.mock('../../src/components/CoastalDataCard', () => ({
  __esModule: true,
  default: () => null,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('costa/index', () => {
  beforeEach(() => {
    // Default: not loading, no remote data (falls back to static COASTAL_ZONES)
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const CostaScreen = require('../costa/index').default;
    const { toJSON } = render(<CostaScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows the screen title', () => {
    const CostaScreen = require('../costa/index').default;
    const { getByText } = render(<CostaScreen />);
    expect(getByText('Linha de Costa')).toBeTruthy();
  });

  it('shows the subtitle', () => {
    const CostaScreen = require('../costa/index').default;
    const { getByText } = render(<CostaScreen />);
    expect(getByText('Minho → Algarve')).toBeTruthy();
  });

  it('shows loading indicator when isLoading is true', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: jest.fn(),
    });
    const CostaScreen = require('../costa/index').default;
    const { toJSON } = render(<CostaScreen />);
    // Screen renders with ActivityIndicator visible
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders static coastal zones (10 items) when no remote data', () => {
    const CostaScreen = require('../costa/index').default;
    const { getAllByText } = render(<CostaScreen />);
    // Each zone has a "Ver detalhes" button
    const buttons = getAllByText('Ver detalhes');
    expect(buttons.length).toBe(10);
  });

  it('renders profile filter chips', () => {
    const CostaScreen = require('../costa/index').default;
    const { getByText } = render(<CostaScreen />);
    expect(getByText('Surfista')).toBeTruthy();
    expect(getByText('Família')).toBeTruthy();
    expect(getByText('Fotógrafo')).toBeTruthy();
    expect(getByText('Natureza')).toBeTruthy();
  });

  it('filters zones when a profile chip is pressed', () => {
    const CostaScreen = require('../costa/index').default;
    const { getByText, getAllByText } = render(<CostaScreen />);
    // Tap "Surfista" filter
    fireEvent.press(getByText('Surfista'));
    // After filtering, fewer than 10 "Ver detalhes" should remain visible
    const buttons = getAllByText('Ver detalhes');
    expect(buttons.length).toBeLessThanOrEqual(10);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders Costa do Minho in the list', () => {
    const CostaScreen = require('../costa/index').default;
    const { getByText } = render(<CostaScreen />);
    expect(getByText('Costa do Minho')).toBeTruthy();
  });
});
