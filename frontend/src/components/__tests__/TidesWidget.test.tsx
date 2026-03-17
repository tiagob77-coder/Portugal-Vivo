import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Mock dependencies
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../config/api', () => ({
  API_URL: 'http://localhost:8000',
}));

import { useQuery } from '@tanstack/react-query';
import { TidesWidget } from '../TidesWidget';

const mockUseQuery = useQuery as jest.Mock;

const mockTideData = {
  source: 'stormglass',
  api_type: 'real',
  latitude: 39.6021,
  longitude: -9.071,
  station: 'Nazaré',
  current: {
    height_m: 2.35,
    state: 'rising',
  },
  next_high_tide: {
    type: 'high',
    datetime: '2025-06-15T14:30:00Z',
    height_m: 3.12,
  },
  next_low_tide: {
    type: 'low',
    datetime: '2025-06-15T20:45:00Z',
    height_m: 0.45,
  },
  moon_phase: 0.5,
  tide_type: 'spring',
  timestamp: '2025-06-15T10:00:00Z',
};

describe('TidesWidget', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it('shows ActivityIndicator when loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { UNSAFE_getByType } = render(
      <TidesWidget latitude={39.6} longitude={-9.07} />
    );

    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('returns null on error', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
    });

    const { toJSON } = render(
      <TidesWidget latitude={39.6} longitude={-9.07} />
    );

    expect(toJSON()).toBeNull();
  });

  it('returns null when data has no current field', () => {
    mockUseQuery.mockReturnValue({
      data: { source: 'test' },
      isLoading: false,
      error: null,
    });

    const { toJSON } = render(
      <TidesWidget latitude={39.6} longitude={-9.07} />
    );

    expect(toJSON()).toBeNull();
  });

  it('renders tide height, state label, and moon phase on success', () => {
    mockUseQuery.mockReturnValue({
      data: mockTideData,
      isLoading: false,
      error: null,
    });

    render(<TidesWidget latitude={39.6} longitude={-9.07} />);

    // Height value (formatted to 2 decimal places)
    expect(screen.getByText('2.35')).toBeTruthy();
    // Unit label
    expect(screen.getByText('metros')).toBeTruthy();
    // State label for 'rising'
    expect(screen.getByText('Subindo')).toBeTruthy();
    // Moon phase name (0.5 -> index 2 -> 'Lua Cheia')
    expect(screen.getByText('Lua Cheia')).toBeTruthy();
    // Station name
    expect(screen.getByText('Nazaré')).toBeTruthy();
    // Tide type label for spring
    expect(screen.getByText('Maré Viva')).toBeTruthy();
  });

  it('renders compact mode differently', () => {
    mockUseQuery.mockReturnValue({
      data: mockTideData,
      isLoading: false,
      error: null,
    });

    render(<TidesWidget latitude={39.6} longitude={-9.07} compact />);

    // Compact shows height with 1 decimal place
    expect(screen.getByText('2.4m')).toBeTruthy();
    // Compact shows state label
    expect(screen.getByText('Subindo')).toBeTruthy();
    // Full layout text should NOT be present
    expect(screen.queryByText('metros')).toBeNull();
    expect(screen.queryByText('Marés')).toBeNull();
  });

  it('renders station picker when showStationPicker is true', () => {
    mockUseQuery.mockReturnValue({
      data: mockTideData,
      isLoading: false,
      error: null,
    });

    render(
      <TidesWidget latitude={39.6} longitude={-9.07} showStationPicker />
    );

    // Station names from STATIONS array should appear
    expect(screen.getByText('Cascais')).toBeTruthy();
    expect(screen.getByText('Peniche')).toBeTruthy();
    expect(screen.getByText('Lisboa')).toBeTruthy();
  });

  it('does not render station picker by default', () => {
    mockUseQuery.mockReturnValue({
      data: mockTideData,
      isLoading: false,
      error: null,
    });

    render(<TidesWidget latitude={39.6} longitude={-9.07} />);

    // Station chips should not be present
    expect(screen.queryByText('Cascais')).toBeNull();
    expect(screen.queryByText('Peniche')).toBeNull();
  });
});
