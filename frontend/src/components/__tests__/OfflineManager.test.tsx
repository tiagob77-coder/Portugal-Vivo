import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../theme', () => ({
  palette: {
    terracotta: { 500: '#C96A42' },
    gray: { 50: '#F8FAFC' },
  },
}));

jest.mock('../../config/api', () => ({
  API_BASE: 'http://localhost:8000/api',
}));

jest.mock('../PressableScale', () => {
  const { TouchableOpacity } = require('react-native');
  const React = require('react');
  return function PressableScale({ children, onPress, disabled, style }: any) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} style={style}>
        {children}
      </TouchableOpacity>
    );
  };
});

// Control values via module-level mutable references (prefixed with `mock` to
// satisfy jest.mock's hoisting constraint).
let mockIsOffline = false;
let mockDownloadedRegions: any[] = [];
let mockStorageUsage = 0;
let mockAvailableRegions: any[] = [];

jest.mock('../../services/offlineStorage', () => ({
  __esModule: true,
  default: {
    isOffline: jest.fn(() => Promise.resolve(mockIsOffline)),
    getOfflineRegions: jest.fn(() => Promise.resolve(mockDownloadedRegions)),
    getStorageUsage: jest.fn(() => Promise.resolve(mockStorageUsage)),
    downloadRegion: jest.fn().mockResolvedValue(undefined),
    deleteRegion: jest.fn().mockResolvedValue(undefined),
    checkForUpdates: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { regions: mockAvailableRegions } })),
}));

import OfflineManager from '../OfflineManager';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OfflineManager', () => {
  beforeEach(() => {
    mockIsOffline = false;
    mockDownloadedRegions = [];
    mockStorageUsage = 0;
    mockAvailableRegions = [];
  });

  it('renders the Offline Regions header after loading', async () => {
    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('Offline Regions')).toBeTruthy());
  });

  it('shows storage used label', async () => {
    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('Storage Used')).toBeTruthy());
  });

  it('shows 0 region(s) downloaded when no regions are downloaded', async () => {
    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('0 region(s) downloaded')).toBeTruthy());
  });

  it('shows empty state when no regions are downloaded or available', async () => {
    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('No regions available')).toBeTruthy());
  });

  it('shows the empty state subtitle text', async () => {
    const { getByText } = render(<OfflineManager />);
    await waitFor(() =>
      expect(
        getByText('Pull down to refresh and check for available regions.')
      ).toBeTruthy()
    );
  });

  it('shows offline notice when device is offline', async () => {
    mockIsOffline = true;
    const { getByText } = render(<OfflineManager />);
    await waitFor(() =>
      expect(getByText('You are offline. Showing downloaded data only.')).toBeTruthy()
    );
  });

  it('shows downloaded region name when a region is downloaded', async () => {
    mockDownloadedRegions = [
      {
        regionId: 'algarve',
        regionName: 'Algarve',
        poiCount: 42,
        routesCount: 5,
        eventsCount: 3,
        sizeBytes: 1024 * 1024,
        downloadedAt: new Date().toISOString(),
        version: '1',
      },
    ];

    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('Algarve')).toBeTruthy());
    expect(getByText('Downloaded')).toBeTruthy();
    expect(getByText('1 region(s) downloaded')).toBeTruthy();
  });

  it('shows available regions from API', async () => {
    mockAvailableRegions = [
      {
        id: 'norte',
        name: 'Norte',
        poi_count: 100,
        routes_count: 10,
        events_count: 5,
        estimated_size_mb: 12,
      },
    ];

    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('Norte')).toBeTruthy());
    expect(getByText('Available Regions')).toBeTruthy();
  });
});
