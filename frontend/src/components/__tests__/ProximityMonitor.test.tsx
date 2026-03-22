import React from 'react';
import { render, act } from '@testing-library/react-native';
import ProximityMonitor from '../ProximityMonitor';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/geofencing', () => ({
  __esModule: true,
  default: {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../theme', () => ({
  typography: { fontSize: { md: 16, sm: 12 } },
  spacing: { 2: 8, 3: 12 },
  borders: { radius: { xl: 16 } },
  shadows: { xl: {} },
  palette: {
    white: '#FFFFFF',
    forest: { 400: '#47876F', 500: '#2E5E4E' },
    terracotta: { 500: '#C49A6C' },
  },
  withOpacity: (color: string, _opacity: number) => color,
}));

import geofenceService from '../../services/geofencing';
const mockGeofenceService = geofenceService as jest.Mocked<typeof geofenceService>;

describe('ProximityMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders null initially (no pending alerts)', () => {
    const { toJSON } = render(<ProximityMonitor />);
    expect(toJSON()).toBeNull();
  });

  it('does not start geofencing when enabled=false', () => {
    render(<ProximityMonitor enabled={false} />);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockGeofenceService.start).not.toHaveBeenCalled();
  });

  it('starts geofencing after 2s delay when enabled=true', async () => {
    render(<ProximityMonitor enabled={true} />);
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    expect(mockGeofenceService.start).toHaveBeenCalledTimes(1);
  });

  it('does not start twice when re-rendered with same props', async () => {
    const { rerender } = render(<ProximityMonitor enabled={true} />);
    await act(async () => {
      jest.advanceTimersByTime(2100);
    });
    rerender(<ProximityMonitor enabled={true} />);
    // Should still be called only once
    expect(mockGeofenceService.start).toHaveBeenCalledTimes(1);
  });

  it('renders alert banner when geofence service triggers alerts', async () => {
    let capturedOnAlert: ((alerts: any[]) => void) | undefined;
    mockGeofenceService.start.mockImplementationOnce(async ({ onAlert }) => {
      capturedOnAlert = onAlert;
    });

    const { queryByText } = render(<ProximityMonitor enabled={true} />);

    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

    const mockAlerts = [
      {
        poi_id: 'poi-1',
        poi_name: 'Torre de Belém',
        category: 'Monumento',
        iq_score: 87,
        distance_m: 150,
        alert_type: 'nearby',
        message: 'Está perto de Torre de Belém',
        timestamp: Date.now(),
      },
    ];

    await act(async () => {
      capturedOnAlert?.(mockAlerts);
    });

    expect(queryByText('Torre de Belém')).toBeTruthy();
  });

  it('renders without crashing with default props', () => {
    expect(() => render(<ProximityMonitor />)).not.toThrow();
  });
});
