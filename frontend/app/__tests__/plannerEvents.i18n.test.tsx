/**
 * i18n checks for the Planeador and Eventos tabs: Portuguese by default,
 * English after switching the UI language.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { changeLanguage } from 'i18next';
import PlaneadorTab from '../(tabs)/planeador';
import EventosTab from '../(tabs)/eventos';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ isPremium: false }),
}));

const mockColors = {
  background: '#FAF8F3',
  surface: '#f5f5f5',
  surfaceAlt: '#eeeeee',
  textPrimary: '#1C1F1C',
  textSecondary: '#4A4A4A',
  textMuted: '#9A958A',
  accent: '#2E5E4E',
  border: '#E5E0D5',
};

jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: mockColors, isDark: false }),
}));

jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: [] })) },
  getAgendaLive: jest.fn(() => Promise.resolve({ events: [] })),
  getLocalities: jest.fn(() => Promise.resolve({ localities: [] })),
  generateSmartItinerary: jest.fn(),
  generateAiItinerary: jest.fn(),
  saveItinerary: jest.fn(),
  listItineraries: jest.fn(() => Promise.resolve({ items: [] })),
  deleteItinerary: jest.fn(),
}));

jest.mock('../../src/components/EmptyState', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => {
    const { Text } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    return <Text>{title}</Text>;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock('expo-image', () => ({ Image: 'Image' }));

describe('Planeador & Eventos tabs — translations', () => {
  afterEach(async () => {
    await act(() => changeLanguage('pt'));
  });

  it('renders the planner in Portuguese by default', () => {
    const { getByText } = render(<PlaneadorTab />);
    expect(getByText('Ferramentas de Planeamento')).toBeTruthy();
    expect(getByText('2 dias')).toBeTruthy();
  });

  it('renders the planner in English', async () => {
    await act(() => changeLanguage('en'));
    const { getByText } = render(<PlaneadorTab />);
    expect(getByText('Planning Tools')).toBeTruthy();
    expect(getByText('1 day')).toBeTruthy();
  });

  it('renders the events tab in English', async () => {
    await act(() => changeLanguage('en'));
    const { getByText } = render(<EventosTab />);
    expect(getByText('Upcoming Events')).toBeTruthy();
    expect(getByText('No upcoming events')).toBeTruthy();
  });
});
