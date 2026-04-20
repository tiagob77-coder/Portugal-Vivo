import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { useQuery } from '@tanstack/react-query';
import { WeatherWidget } from '../WeatherWidget';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/api', () => ({
  getWeatherForecast: jest.fn(),
  getWeatherAlerts: jest.fn(),
}));

jest.mock('../../theme', () => ({
  colors: {
    terracotta: { 100: '#fee2e2', 300: '#fca5a5', 500: '#ef4444', 600: '#dc2626' },
    ocean: { 500: '#3b82f6' },
    gray: { 400: '#9ca3af', 500: '#6b7280', 700: '#374151', 800: '#1f2937' },
    mint: { 100: '#d1fae5' },
    background: { secondary: '#f3f4f6' },
  },
  typography: { fontSize: { xs: 12, sm: 14, xl: 20 } },
  spacing: { 2: 8, 3: 12, 4: 16 },
  borders: { radius: { lg: 12, xl: 16 } },
  shadows: { md: {} },
}));

const mockUseQuery = useQuery as jest.Mock;

const mockForecastData = {
  forecasts: [
    {
      weather_type: 1,
      weather_description: 'Céu limpo',
      temp_min: 18,
      temp_max: 28,
      precipitation_prob: 10,
    },
  ],
};

const mockAlertsData = {
  alerts: [],
};

describe('WeatherWidget', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it('shows ActivityIndicator when loading', () => {
    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'weather-forecast') {
        return { data: undefined, isLoading: true };
      }
      return { data: mockAlertsData };
    });

    const { UNSAFE_getByType } = render(<WeatherWidget />);
    const { ActivityIndicator } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('returns null when no forecast data is available', () => {
    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'weather-forecast') {
        return { data: { forecasts: [] }, isLoading: false };
      }
      return { data: mockAlertsData };
    });

    const { toJSON } = render(<WeatherWidget />);
    expect(toJSON()).toBeNull();
  });

  it('renders temperature range and weather description on success', () => {
    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'weather-forecast') {
        return { data: mockForecastData, isLoading: false };
      }
      return { data: mockAlertsData };
    });

    render(<WeatherWidget location="lisboa" />);

    expect(screen.getByText('18° - 28°')).toBeTruthy();
    expect(screen.getByText('Céu limpo')).toBeTruthy();
    expect(screen.getByText('Lisboa')).toBeTruthy();
    expect(screen.getByText('IPMA')).toBeTruthy();
  });

  it('shows alert row when weather alerts exist', () => {
    const alertsWithWarning = {
      alerts: [{ level: 'yellow', title: 'Aviso de calor' }],
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'weather-forecast') {
        return { data: mockForecastData, isLoading: false };
      }
      return { data: alertsWithWarning };
    });

    render(<WeatherWidget />);
    expect(screen.getByText('Aviso de calor')).toBeTruthy();
  });

  it('shows rain probability when above 30%', () => {
    const rainyForecast = {
      forecasts: [
        {
          weather_type: 9,
          weather_description: 'Chuva',
          temp_min: 12,
          temp_max: 16,
          precipitation_prob: 80,
        },
      ],
    };

    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'weather-forecast') {
        return { data: rainyForecast, isLoading: false };
      }
      return { data: mockAlertsData };
    });

    render(<WeatherWidget />);
    expect(screen.getByText('80% probabilidade de chuva')).toBeTruthy();
  });
});
