import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import { useQuery } from '@tanstack/react-query';
import { SurfForecastWidget } from '../SurfForecastWidget';

const mockUseQuery = useQuery as jest.Mock;

const mockSurfData = {
  spot: { name: 'Nazaré', type: 'beach_break' },
  current: {
    wave_height_m: 2.5,
    surf_quality: 'good',
    wave_direction_cardinal: 'NW',
  },
  forecast_3h: [
    { time: '2025-06-15T12:00:00Z', wave_height_m: 2.3, wave_direction: 'NW', wave_period_s: 12 },
    { time: '2025-06-15T15:00:00Z', wave_height_m: 2.1, wave_direction: 'W', wave_period_s: 11 },
  ],
};

describe('SurfForecastWidget', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it('shows loading state with ActivityIndicator and text', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { UNSAFE_getByType } = render(<SurfForecastWidget />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.getByText('A carregar previsão...')).toBeTruthy();
  });

  it('shows error UI when there is an error', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('API error'),
    });

    render(<SurfForecastWidget />);

    expect(screen.getByText('Não foi possível carregar a previsão')).toBeTruthy();
    expect(screen.getByText('Toque para tentar novamente')).toBeTruthy();
  });

  it('renders wave height, quality badge, and direction on success', () => {
    mockUseQuery.mockReturnValue({
      data: mockSurfData,
      isLoading: false,
      error: null,
    });

    render(<SurfForecastWidget />);

    // Current wave height
    expect(screen.getByText('2.5')).toBeTruthy();
    expect(screen.getByText('metros')).toBeTruthy();
    // Quality label for 'good'
    expect(screen.getByText('Bom')).toBeTruthy();
    // Direction (appears in current conditions and forecast, so use getAllByText)
    expect(screen.getAllByText('NW').length).toBeGreaterThanOrEqual(1);
    // Title
    expect(screen.getByText('Previsão Surf 24h')).toBeTruthy();
    // Footer
    expect(screen.getByText('Ver detalhes completos')).toBeTruthy();
  });

  it('renders spot selector with all spots', () => {
    mockUseQuery.mockReturnValue({
      data: mockSurfData,
      isLoading: false,
      error: null,
    });

    render(<SurfForecastWidget />);

    expect(screen.getByText('Nazaré')).toBeTruthy();
    expect(screen.getByText('Peniche')).toBeTruthy();
    expect(screen.getByText('Ericeira')).toBeTruthy();
    expect(screen.getByText('Sagres')).toBeTruthy();
    expect(screen.getByText('Caparica')).toBeTruthy();
  });

  it('renders forecast timeline items', () => {
    mockUseQuery.mockReturnValue({
      data: mockSurfData,
      isLoading: false,
      error: null,
    });

    render(<SurfForecastWidget />);

    // Forecast heights
    expect(screen.getByText('2.3m')).toBeTruthy();
    expect(screen.getByText('2.1m')).toBeTruthy();
    expect(screen.getByText('Próximas horas')).toBeTruthy();
  });
});
