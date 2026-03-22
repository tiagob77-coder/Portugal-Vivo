import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import AnalyticsDashboard from '../AnalyticsDashboard';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../../config/api', () => ({
  API_BASE: 'http://localhost:8000',
}));

jest.mock('../../theme', () => ({
  stateColors: {
    surf: { poor: '#EF4444' },
  },
}));

const mockUseQuery = useQuery as jest.Mock;

const mockAnalyticsData = {
  overview: {
    total_users: 1250,
    total_pois: 340,
    total_routes: 88,
  },
  visits: {
    total: 5800,
    unique_visitors: 2100,
  },
  retention: {
    retention_rate_pct: 42,
  },
  user_growth: {
    new_users_period: 87,
    by_week: [
      { week: '2025-W01', count: 10 },
      { week: '2025-W02', count: 15 },
    ],
  },
  top_pois_favorited: [
    { poi_id: 'p1', name: 'Palácio da Pena', category: 'Monumento', favorites_count: 320 },
    { poi_id: 'p2', name: 'Mosteiro dos Jerónimos', category: 'Igreja', favorites_count: 280 },
  ],
  top_routes_shared: [
    { route_id: 'r1', name: 'Rota da Costa Vicentina', share_count: 45, view_count: 200 },
  ],
  category_engagement: [
    { category: 'Monumento', visits: 1200 },
    { category: 'Praia', visits: 900 },
  ],
  region_engagement: [
    { region: 'Algarve', visits: 800 },
    { region: 'Lisboa', visits: 700 },
  ],
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it('shows loading indicator when fetching data', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });

    const { UNSAFE_getByType } = render(<AnalyticsDashboard />);
    const { ActivityIndicator } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.getByText('A carregar métricas...')).toBeTruthy();
  });

  it('shows error state when query fails', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false, error: new Error('fail') });
    render(<AnalyticsDashboard />);
    expect(screen.getByText('Erro ao carregar analytics')).toBeTruthy();
  });

  it('returns null when data is undefined and not loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const { toJSON } = render(<AnalyticsDashboard />);
    expect(toJSON()).toBeNull();
  });

  it('renders overview section with metric cards', () => {
    mockUseQuery.mockReturnValue({ data: mockAnalyticsData, isLoading: false, error: null });
    render(<AnalyticsDashboard />);

    expect(screen.getByText('Visão Geral')).toBeTruthy();
    expect(screen.getByText('1250')).toBeTruthy();
    expect(screen.getByText('Utilizadores')).toBeTruthy();
    expect(screen.getByText('340')).toBeTruthy();
    expect(screen.getByText('POIs')).toBeTruthy();
    expect(screen.getByText('88')).toBeTruthy();
    expect(screen.getByText('Rotas')).toBeTruthy();
  });

  it('renders engagement section with visits', () => {
    mockUseQuery.mockReturnValue({ data: mockAnalyticsData, isLoading: false, error: null });
    render(<AnalyticsDashboard />);

    expect(screen.getByText('5800')).toBeTruthy();
    expect(screen.getByText('Visitas')).toBeTruthy();
    expect(screen.getByText('2100')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
    expect(screen.getByText('Retenção')).toBeTruthy();
  });

  it('renders user growth section', () => {
    mockUseQuery.mockReturnValue({ data: mockAnalyticsData, isLoading: false, error: null });
    render(<AnalyticsDashboard />);

    expect(screen.getByText('+87 novos')).toBeTruthy();
    expect(screen.getByText('Crescimento de Utilizadores')).toBeTruthy();
  });

  it('renders top POIs section', () => {
    mockUseQuery.mockReturnValue({ data: mockAnalyticsData, isLoading: false, error: null });
    render(<AnalyticsDashboard />);

    expect(screen.getByText('POIs Mais Favoritos')).toBeTruthy();
    expect(screen.getByText('Palácio da Pena')).toBeTruthy();
    expect(screen.getByText('Mosteiro dos Jerónimos')).toBeTruthy();
    expect(screen.getByText('#1')).toBeTruthy();
  });

  it('renders top routes section', () => {
    mockUseQuery.mockReturnValue({ data: mockAnalyticsData, isLoading: false, error: null });
    render(<AnalyticsDashboard />);

    expect(screen.getByText('Rotas Mais Partilhadas')).toBeTruthy();
    expect(screen.getByText('Rota da Costa Vicentina')).toBeTruthy();
  });

  it('renders category and region engagement', () => {
    mockUseQuery.mockReturnValue({ data: mockAnalyticsData, isLoading: false, error: null });
    render(<AnalyticsDashboard />);

    expect(screen.getByText('Engagement por Categoria')).toBeTruthy();
    expect(screen.getByText('Monumento')).toBeTruthy();
    expect(screen.getByText('Engagement por Região')).toBeTruthy();
    expect(screen.getByText('Algarve')).toBeTruthy();
  });

  it('renders period selector buttons', () => {
    mockUseQuery.mockReturnValue({ data: mockAnalyticsData, isLoading: false, error: null });
    render(<AnalyticsDashboard />);

    expect(screen.getByText('7 dias')).toBeTruthy();
    expect(screen.getByText('30 dias')).toBeTruthy();
    expect(screen.getByText('90 dias')).toBeTruthy();
  });

  it('changes period when period button is pressed', () => {
    mockUseQuery.mockReturnValue({ data: mockAnalyticsData, isLoading: false, error: null });
    render(<AnalyticsDashboard initialPeriod={30} />);

    // Shows engagement (30d) initially
    expect(screen.getByText('Engagement (30d)')).toBeTruthy();

    // Press 7 dias
    fireEvent.press(screen.getByText('7 dias'));
    expect(screen.getByText('Engagement (7d)')).toBeTruthy();
  });
});
