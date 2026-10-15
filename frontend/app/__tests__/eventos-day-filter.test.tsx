/**
 * Eventos — seleção de dia no calendário.
 *
 * Tocar num dia com eventos filtra a lista a esse dia; o chip limpa; um
 * segundo toque no mesmo dia volta ao mês inteiro. Os mocks seguem o
 * tabs.test, mas o useQuery é sensível à chave para semear eventos no mês
 * corrente.
 */
import React from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react-native';
import { changeLanguage } from 'i18next';

// ─── Dados de teste: dois eventos no mês corrente, dias 17 e 20 ───────────────
// mockEvents é referenciado pela fábrica do mock do react-query (hoisted pelo
// babel-jest), por isso não pode depender de outras constantes do módulo —
// o mês é calculado dentro do próprio inicializador.
const mockEvents = (() => {
  const mm = String(new Date().getMonth() + 1).padStart(2, '0');
  return [
    {
      id: 'fumeiro', name: 'Feira do Fumeiro', date_start: `${mm}-17`, date_end: `${mm}-17`,
      category: 'festas', region: 'Norte', description: '', source: 'curated',
    },
    {
      id: 'sbento', name: 'Romaria de S. Bento', date_start: `${mm}-20`, date_end: `${mm}-20`,
      category: 'festas', region: 'Norte', description: '', source: 'curated',
    },
  ];
})();

// ─── expo-router ──────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
}));
jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── React Query — sensível à chave ───────────────────────────────────────────
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const isLive = Array.isArray(queryKey) && queryKey[0] === 'agenda-live';
    return {
      data: isLive
        ? { events: mockEvents, sources: { database: mockEvents.length, viralagenda: 0 } }
        : [],
      isLoading: false,
      refetch: jest.fn(),
    };
  },
  useMutation: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// ─── Auth ─────────────────────────────────────────────────────────────────────
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null, isLoading: false, isAuthenticated: false,
    login: jest.fn(), logout: jest.fn(), sessionToken: null,
    isPremium: false, premiumTier: 'free',
    refreshUser: jest.fn(), refreshSubscription: jest.fn(),
  }),
}));

// ─── Tema ─────────────────────────────────────────────────────────────────────
// Escala 50–900 partilhada por todas as famílias da paleta (o ecrã indexa
// colors.gray[800], palette.terracotta[500], colors.mint[600], etc.)
const scale = (base: string) =>
  Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((k) => [k, base]));
const mockPalette = {
  gray: scale('#4A4A4A'),
  forest: scale('#2E5E4E'),
  terracotta: scale('#C49A6C'),
  ocean: scale('#0891B2'),
  rust: scale('#EF4444'),
  mint: scale('#6BBF9A'),
  white: '#FFFFFF',
  black: '#000000',
};
const mockColors = {
  ...mockPalette,
  background: { primary: '#FAF8F3', secondary: '#FFFFFF', tertiary: '#F7F4EE', dark: '#2E5E4E' },
  surface: '#FFFFFF', surfaceAlt: '#F7F4EE',
  textPrimary: '#1C1F1C', textSecondary: '#4A4A4A', textMuted: '#9A958A',
  accent: '#C49A6C', border: '#E5E0D5', card: '#FFFFFF',
  success: '#3FA66B', warning: '#E8A23A', error: '#C44536', info: '#2A6F97',
};
jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: mockColors, isDark: false, toggleTheme: jest.fn() }),
}));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: mockColors }),
  colors: mockColors,
  palette: mockPalette,
  withOpacity: (c: string) => c,
  getCategoryColor: () => '#000',
  getCategoryBg: () => '#fff',
  scrimPine: (o: number) => `rgba(14,30,26,${o})`,
  fontFamilies: { serif: 'serif', sans: 'System' },
  typography: {
    fontFamily: { sans: 'System', heading: 'System' },
    fontSize: { xs: 10, sm: 12, base: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 28 },
    fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  },
  spacing: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
  borders: { radius: { sm: 4, md: 8, lg: 12, xl: 16, '2xl': 20, full: 9999 } },
  shadows: { sm: {}, md: {}, lg: {}, xl: {} },
  gradients: { cardScrim: { colors: ['transparent', 'rgba(0,0,0,.5)'], locations: [0, 1] } },
}));

// ─── API ──────────────────────────────────────────────────────────────────────
jest.mock('../../src/services/api', () => {
  const noop = jest.fn(() => Promise.resolve([]));
  return {
    __esModule: true,
    default: { get: jest.fn(() => Promise.resolve({ data: [] })), post: jest.fn() },
    getAgendaLive: jest.fn(() => Promise.resolve({ events: [], sources: {} })),
    getUpcomingEvents: noop,
    getCalendarEvents: noop,
    getRegions: noop,
    getCategories: noop,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons', Ionicons: 'Ionicons' }));

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const monthName = MONTHS_PT[new Date().getMonth()];

const renderScreen = () => {
  const EventosScreen = require('../(tabs)/eventos').default; // eslint-disable-line @typescript-eslint/no-require-imports
  return render(<EventosScreen />);
};

describe('(tabs)/eventos — seleção de dia', () => {
  it('sem dia escolhido, não há lista do dia', () => {
    renderScreen();
    expect(screen.queryByText(new RegExp(`^Eventos a 17 de ${monthName}`))).toBeNull();
  });

  it('tocar num dia com eventos filtra a lista a esse dia', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText(/^Dia 17, 1 evento/));

    expect(screen.getByText(`Eventos a 17 de ${monthName}`)).toBeTruthy();
    expect(screen.getByText('Feira do Fumeiro')).toBeTruthy();
    // O evento do dia 20 não pertence ao dia 17
    expect(screen.queryByText('Romaria de S. Bento')).toBeNull();
  });

  it('o chip limpa a seleção e volta ao mês inteiro', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText(/^Dia 17, 1 evento/));
    fireEvent.press(screen.getByLabelText('Limpar dia selecionado, ver mês inteiro'));

    expect(screen.queryByText(new RegExp(`^Eventos a 17 de ${monthName}`))).toBeNull();
    expect(screen.queryByText('Feira do Fumeiro')).toBeNull();
  });

  it('um segundo toque no mesmo dia desselecciona', () => {
    renderScreen();
    const day17 = screen.getByLabelText(/^Dia 17, 1 evento/);
    fireEvent.press(day17);
    fireEvent.press(day17);

    expect(screen.queryByText(new RegExp(`^Eventos a 17 de ${monthName}`))).toBeNull();
  });

  it('trocar de dia troca a lista', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText(/^Dia 17, 1 evento/));
    fireEvent.press(screen.getByLabelText(/^Dia 20, 1 evento/));

    expect(screen.getByText(`Eventos a 20 de ${monthName}`)).toBeTruthy();
    expect(screen.getByText('Romaria de S. Bento')).toBeTruthy();
    expect(screen.queryByText('Feira do Fumeiro')).toBeNull();
  });

  it('dias sem eventos não são selecionáveis', () => {
    renderScreen();
    // Dia 3 não tem eventos: o botão existe mas está desativado
    const day3 = screen.getByLabelText('Dia 3');
    expect(day3.props.accessibilityState?.disabled ?? day3.props.disabled).toBeTruthy();
  });

  it('mudar de mês limpa a seleção', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText(/^Dia 17, 1 evento/));
    fireEvent.press(screen.getByLabelText('Mês seguinte'));

    expect(screen.queryByText(/^Eventos a 17 de/)).toBeNull();
  });
  it('em inglês o mês mantém a maiúscula e vem antes do dia', async () => {
    await act(async () => { await changeLanguage('en'); });
    try {
      renderScreen();
      const monthEn = new Date().toLocaleString('en', { month: 'long' });
      fireEvent.press(screen.getByLabelText(/^Day 17, 1 event/));
      expect(screen.getByText(`Events on ${monthEn} 17`)).toBeTruthy();
      expect(screen.getByLabelText('Clear selected day, show the whole month')).toBeTruthy();
    } finally {
      await act(async () => { await changeLanguage('pt'); });
    }
  });
});
