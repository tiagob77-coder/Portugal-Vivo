import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import { SafetyWidget } from '../SafetyWidget';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/api', () => ({
  getSafetyCheck: jest.fn(),
  getActiveFires: jest.fn(),
}));

jest.mock('../../theme', () => ({
  colors: {
    terracotta: { 100: '#FEF3E2', 500: '#C49A6C' },
    background: { secondary: '#F8FAFC' },
    gray: { 100: '#F1F5F9', 400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#374151' },
    mint: { 50: '#F0FDF4' },
  },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, md: 16, lg: 18 },
  },
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16 },
  borders: { radius: { lg: 12, xl: 16, full: 9999 } },
  shadows: { md: {} },
}));

const mockUseQuery = useQuery as jest.Mock;

describe('SafetyWidget', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it('shows loading indicator while fetching', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { UNSAFE_getByType } = render(<SafetyWidget />);
    const { ActivityIndicator } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders "Seguro" status for safe safety level', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'safe', message: 'Sem alertas na zona.' },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 0, active_count: 0 },
        isLoading: false,
      });

    render(<SafetyWidget />);
    expect(screen.getByText('Seguro')).toBeTruthy();
    expect(screen.getByText('Sem alertas')).toBeTruthy();
  });

  it('renders "Atenção" status for warning safety level', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'warning', message: 'Alertas ativos na área.' },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 2, active_count: 1 },
        isLoading: false,
      });

    render(<SafetyWidget />);
    expect(screen.getByText('Atenção')).toBeTruthy();
    expect(screen.getByText('Alertas ativos')).toBeTruthy();
  });

  it('renders "Perigo" status for danger safety level', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'danger', message: 'Perigo elevado.' },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 5, active_count: 3 },
        isLoading: false,
      });

    render(<SafetyWidget />);
    expect(screen.getByText('Perigo')).toBeTruthy();
    expect(screen.getByText('Riscos na área')).toBeTruthy();
  });

  it('renders fire count in stats', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'warning', message: null },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 3, active_count: 2 },
        isLoading: false,
      });

    render(<SafetyWidget />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('shows fire count text when totalFires > 0', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'safe', message: null },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 4, active_count: 2 },
        isLoading: false,
      });

    render(<SafetyWidget />);
    expect(screen.getByText('4 ocorrências em Portugal')).toBeTruthy();
    expect(screen.getByText('Fonte: Fogos.pt / Proteção Civil')).toBeTruthy();
  });

  it('shows singular "ocorrência" when totalFires is 1', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'safe', message: null },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 1, active_count: 1 },
        isLoading: false,
      });

    render(<SafetyWidget />);
    expect(screen.getByText('1 ocorrência em Portugal')).toBeTruthy();
  });

  it('renders safetyData message when present', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'safe', message: 'Zona tranquila. Boa visita!' },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 0, active_count: 0 },
        isLoading: false,
      });

    render(<SafetyWidget />);
    expect(screen.getByText('Zona tranquila. Boa visita!')).toBeTruthy();
  });

  it('calls onPress callback when widget is pressed', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'safe', message: null },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 0, active_count: 0 },
        isLoading: false,
      });

    const onPress = jest.fn();
    render(<SafetyWidget onPress={onPress} />);
    fireEvent.press(screen.getByText('Seguro'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders compact mode with just status label', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: { safety_level: 'safe', message: null },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 0, active_count: 0 },
        isLoading: false,
      });

    render(<SafetyWidget compact />);
    expect(screen.getByText('Seguro')).toBeTruthy();
  });

  it('shows weather alerts when present', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: {
          safety_level: 'warning',
          message: null,
          weather_alerts: [{ title: 'Aviso de calor intenso' }],
        },
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: { total: 0, active_count: 0 },
        isLoading: false,
      });

    render(<SafetyWidget />);
    expect(screen.getByText('Aviso de calor intenso')).toBeTruthy();
  });
});
