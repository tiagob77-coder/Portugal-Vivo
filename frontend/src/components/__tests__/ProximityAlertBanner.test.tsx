import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import ProximityAlertBanner from '../ProximityAlertBanner';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../theme', () => ({
  typography: { fontSize: { md: 15, sm: 13 } },
  spacing: { 2: 8, 3: 12 },
  borders: { radius: { xl: 16 } },
  shadows: { xl: {} },
  palette: {
    white: '#FFFFFF',
    forest: { 400: '#5A7A50', 500: '#4A6741' },
    terracotta: { 500: '#C96A42' },
  },
  withOpacity: (_hex: string, opacity: number) => `rgba(0,0,0,${opacity})`,
}));

jest.mock('../../services/geofencing', () => ({}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeAlert = (overrides: Partial<any> = {}) => ({
  poi_id: 'poi-1',
  poi_name: 'Torre de Belém',
  message: 'Perto de si agora',
  distance_m: 150,
  alert_type: 'normal',
  iq_score: null,
  category: 'Monumento',
  timestamp: Date.now(),
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProximityAlertBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when alerts array is empty', () => {
    const { toJSON } = render(
      <ProximityAlertBanner alerts={[]} onDismiss={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders POI name and message for a normal alert', () => {
    const { getByText } = render(
      <ProximityAlertBanner alerts={[makeAlert()]} onDismiss={jest.fn()} />
    );
    expect(getByText('Torre de Belém')).toBeTruthy();
    expect(getByText('Perto de si agora')).toBeTruthy();
  });

  it('renders distance badge', () => {
    const { getByText } = render(
      <ProximityAlertBanner alerts={[makeAlert()]} onDismiss={jest.fn()} />
    );
    expect(getByText('150m')).toBeTruthy();
  });

  it('shows IQ score badge when iq_score is provided', () => {
    const { getByText } = render(
      <ProximityAlertBanner
        alerts={[makeAlert({ iq_score: 87.5 })]}
        onDismiss={jest.fn()}
      />
    );
    expect(getByText('IQ 88')).toBeTruthy();
  });

  it('shows RARO badge for rare alerts', () => {
    const { getByText } = render(
      <ProximityAlertBanner
        alerts={[makeAlert({ alert_type: 'rare' })]}
        onDismiss={jest.fn()}
      />
    );
    expect(getByText('RARO')).toBeTruthy();
  });

  it('shows counter when there are multiple alerts', () => {
    const alerts = [makeAlert(), makeAlert({ poi_id: 'poi-2', poi_name: 'Mosteiro dos Jerónimos' })];
    const { getByText } = render(
      <ProximityAlertBanner alerts={alerts} onDismiss={jest.fn()} />
    );
    expect(getByText('1/2')).toBeTruthy();
  });

  it('calls onDismiss after auto-dismiss timeout', () => {
    const onDismiss = jest.fn();
    render(
      <ProximityAlertBanner alerts={[makeAlert()]} onDismiss={onDismiss} />
    );

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    // After dismiss animation completes onDismiss is called
    // (animation duration 250ms; fast-forward past it too)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onDismiss).toHaveBeenCalled();
  });

  it('navigates to heritage page when banner is tapped', () => {
    const { getByText } = render(
      <ProximityAlertBanner alerts={[makeAlert({ poi_id: 'poi-abc' })]} onDismiss={jest.fn()} />
    );

    fireEvent.press(getByText('Torre de Belém'));

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockPush).toHaveBeenCalledWith('/heritage/poi-abc');
  });
});
