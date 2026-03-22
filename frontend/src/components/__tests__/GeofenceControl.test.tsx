import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { GeofenceControl } from '../GeofenceControl';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/geofencing', () => ({
  geofenceService: {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(),
  },
}));

jest.mock('../../theme', () => ({
  palette: {
    gray: { 50: '#FAF8F3', 100: '#F0EDE6' },
    forest: { 500: '#2E5E4E' },
  },
}));

import { geofenceService } from '../../services/geofencing';

const mockGeofenceService = geofenceService as jest.Mocked<typeof geofenceService>;

describe('GeofenceControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and subtitle', () => {
    render(<GeofenceControl />);
    expect(screen.getByText('Proximidade')).toBeTruthy();
    expect(screen.getByText('Alerta quando perto de POIs raros')).toBeTruthy();
  });

  it('renders a Switch in the off state initially', () => {
    const { UNSAFE_getByType } = render(<GeofenceControl />);
    const { Switch } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const sw = UNSAFE_getByType(Switch);
    expect(sw.props.value).toBe(false);
  });

  it('calls geofenceService.start when switch is turned on', async () => {
    const { UNSAFE_getByType } = render(<GeofenceControl />);
    const { Switch } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const sw = UNSAFE_getByType(Switch);
    // Simulate toggling on
    await fireEvent(sw, 'valueChange', true);
    expect(mockGeofenceService.start).toHaveBeenCalledTimes(1);
  });

  it('calls geofenceService.stop when switch is turned off', async () => {
    mockGeofenceService.start.mockResolvedValueOnce(undefined as any);
    const { UNSAFE_getByType } = render(<GeofenceControl />);
    const { Switch } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports

    // Turn on
    await act(async () => {
      fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    });
    // The switch is now enabled — turn off
    await act(async () => {
      fireEvent(UNSAFE_getByType(Switch), 'valueChange', false);
    });
    expect(mockGeofenceService.stop).toHaveBeenCalledTimes(1);
  });

  it('calls onPOIsLoad callback when geofence service triggers onNearby', async () => {
    const onPOIsLoad = jest.fn();
    mockGeofenceService.start.mockImplementationOnce(async ({ onNearby }) => {
      onNearby?.([], 0);
    });

    const { UNSAFE_getByType } = render(<GeofenceControl onPOIsLoad={onPOIsLoad} />);
    const { Switch } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const sw = UNSAFE_getByType(Switch);

    await fireEvent(sw, 'valueChange', true);
    expect(onPOIsLoad).toHaveBeenCalledTimes(1);
  });

  it('renders without crashing when no props provided', () => {
    expect(() => render(<GeofenceControl />)).not.toThrow();
  });
});
