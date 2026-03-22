import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import { SurfConditionsWidget } from '../SurfConditionsWidget';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('../../services/api', () => ({
  getAllSpotsConditions: jest.fn(),
  getSurfSpotConditions: jest.fn(),
}));

jest.mock('../../theme', () => ({
  palette: {
    white: '#FFFFFF',
    gray: { 400: '#94A3B8' },
    forest: { 600: '#1E4D40' },
  },
  stateColors: {
    surf: {
      excellent: '#22C55E',
      good: '#3B82F6',
      fair: '#F59E0B',
      poor: '#EF4444',
      flat: '#6B7280',
    },
  },
}));

const mockUseQuery = useQuery as jest.Mock;

const mockAllSpotsData = {
  spots: [
    {
      spot: { name: 'Peniche' },
      surf_quality: 'good',
      wave_height_m: 1.8,
      wave_period_s: 10,
      wave_direction: 'NW',
    },
  ],
};

const mockSpecificSpotData = {
  spot: { name: 'Nazaré' },
  current: {
    surf_quality: 'excellent',
    wave_height_m: 3.2,
    wave_period_s: 14,
    wave_direction_cardinal: 'W',
  },
};

describe('SurfConditionsWidget', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it('shows loading indicator while fetching', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { UNSAFE_getByType } = render(<SurfConditionsWidget />);
    const { ActivityIndicator } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('returns null on error', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false, error: new Error('API error') });
    const { toJSON } = render(<SurfConditionsWidget />);
    expect(toJSON()).toBeNull();
  });

  it('returns null when data is null and not loading', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false, error: null });
    const { toJSON } = render(<SurfConditionsWidget />);
    expect(toJSON()).toBeNull();
  });

  it('renders all spots mode with spot name and wave height', () => {
    mockUseQuery.mockReturnValue({ data: mockAllSpotsData, isLoading: false, error: null });
    render(<SurfConditionsWidget />);

    expect(screen.getByText('Peniche')).toBeTruthy();
    expect(screen.getByText('1.8')).toBeTruthy();
    expect(screen.getByText('Bom')).toBeTruthy();
  });

  it('renders specific spot mode with spot name and wave data', () => {
    mockUseQuery.mockReturnValue({ data: mockSpecificSpotData, isLoading: false, error: null });
    render(<SurfConditionsWidget spotId="nazare" />);

    expect(screen.getByText('Nazaré')).toBeTruthy();
    expect(screen.getByText('3.2')).toBeTruthy();
    expect(screen.getByText('Excelente')).toBeTruthy();
  });

  it('renders wave direction for all-spots mode', () => {
    mockUseQuery.mockReturnValue({ data: mockAllSpotsData, isLoading: false, error: null });
    render(<SurfConditionsWidget />);
    expect(screen.getByText('NW')).toBeTruthy();
  });

  it('renders "Condições de Surf" title', () => {
    mockUseQuery.mockReturnValue({ data: mockAllSpotsData, isLoading: false, error: null });
    render(<SurfConditionsWidget />);
    expect(screen.getByText('Condições de Surf')).toBeTruthy();
  });

  it('renders Open-Meteo source in footer', () => {
    mockUseQuery.mockReturnValue({ data: mockAllSpotsData, isLoading: false, error: null });
    render(<SurfConditionsWidget />);
    expect(screen.getByText('Dados em tempo real • Open-Meteo')).toBeTruthy();
  });

  it('renders stat labels — Altura, Período, Direção', () => {
    mockUseQuery.mockReturnValue({ data: mockAllSpotsData, isLoading: false, error: null });
    render(<SurfConditionsWidget />);
    expect(screen.getByText('Altura')).toBeTruthy();
    expect(screen.getByText('Período')).toBeTruthy();
    expect(screen.getByText('Direção')).toBeTruthy();
  });

  it('renders compact mode with wave height and quality label', () => {
    mockUseQuery.mockReturnValue({ data: mockAllSpotsData, isLoading: false, error: null });
    render(<SurfConditionsWidget compact />);
    expect(screen.getByText('1.8m')).toBeTruthy();
    expect(screen.getByText('Bom')).toBeTruthy();
  });

  it('calls onPress callback when widget is pressed', () => {
    mockUseQuery.mockReturnValue({ data: mockAllSpotsData, isLoading: false, error: null });
    const onPress = jest.fn();
    render(<SurfConditionsWidget onPress={onPress} />);
    fireEvent.press(screen.getByText('Condições de Surf'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders null when spots array is empty', () => {
    mockUseQuery.mockReturnValue({
      data: { spots: [] },
      isLoading: false,
      error: null,
    });
    const { toJSON } = render(<SurfConditionsWidget />);
    expect(toJSON()).toBeNull();
  });

  it('renders "fair" quality label', () => {
    mockUseQuery.mockReturnValue({
      data: {
        spots: [
          { spot: { name: 'Caparica' }, surf_quality: 'fair', wave_height_m: 0.8, wave_period_s: 6, wave_direction: 'SW' },
        ],
      },
      isLoading: false,
      error: null,
    });
    render(<SurfConditionsWidget />);
    expect(screen.getByText('Razoável')).toBeTruthy();
  });
});
