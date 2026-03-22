import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import OfflineManager from '../OfflineManager';

// ── Mocks ────────────────────────────────────────────────────────────────────

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

// Mock PressableScale as a simple TouchableOpacity
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

const mockOfflineStorage = {
  isOffline: jest.fn().mockResolvedValue(false),
  getOfflineRegions: jest.fn().mockResolvedValue([]),
  getStorageUsage: jest.fn().mockResolvedValue(0),
  downloadRegion: jest.fn().mockResolvedValue(undefined),
  deleteRegion: jest.fn().mockResolvedValue(undefined),
  checkForUpdates: jest.fn().mockResolvedValue([]),
};

jest.mock('../../services/offlineStorage', () => ({
  __esModule: true,
  default: mockOfflineStorage,
}));

const mockAxiosGet = jest.fn().mockResolvedValue({ data: { regions: [] } });
jest.mock('axios', () => ({
  get: (...args: any[]) => mockAxiosGet(...args),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OfflineManager', () => {
  beforeEach(() => {
    mockOfflineStorage.isOffline.mockReset().mockResolvedValue(false);
    mockOfflineStorage.getOfflineRegions.mockReset().mockResolvedValue([]);
    mockOfflineStorage.getStorageUsage.mockReset().mockResolvedValue(0);
    mockOfflineStorage.downloadRegion.mockReset().mockResolvedValue(undefined);
    mockOfflineStorage.deleteRegion.mockReset().mockResolvedValue(undefined);
    mockOfflineStorage.checkForUpdates.mockReset().mockResolvedValue([]);
    mockAxiosGet.mockReset().mockResolvedValue({ data: { regions: [] } });
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

  it('shows offline notice when device is offline', async () => {
    mockOfflineStorage.isOffline.mockResolvedValue(true);
    const { getByText } = render(<OfflineManager />);
    await waitFor(() =>
      expect(getByText('You are offline. Showing downloaded data only.')).toBeTruthy()
    );
  });

  it('shows downloaded regions when they exist', async () => {
    mockOfflineStorage.getOfflineRegions.mockResolvedValue([
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
    ]);

    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('Algarve')).toBeTruthy());
    expect(getByText('Downloaded')).toBeTruthy();
  });

  it('shows available regions from API', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        regions: [
          {
            id: 'norte',
            name: 'Norte',
            poi_count: 100,
            routes_count: 10,
            events_count: 5,
            estimated_size_mb: 12,
          },
        ],
      },
    });

    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('Norte')).toBeTruthy());
    expect(getByText('Available Regions')).toBeTruthy();
  });

  it('shows empty state when no regions are downloaded or available', async () => {
    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('No regions available')).toBeTruthy());
  });

  it('shows region download stats when regions are downloaded', async () => {
    mockOfflineStorage.getOfflineRegions.mockResolvedValue([
      {
        regionId: 'madeira',
        regionName: 'Madeira',
        poiCount: 20,
        routesCount: 3,
        eventsCount: 2,
        sizeBytes: 512 * 1024,
        downloadedAt: new Date().toISOString(),
        version: '1',
      },
    ]);

    const { getByText } = render(<OfflineManager />);
    await waitFor(() => expect(getByText('Madeira')).toBeTruthy());
    expect(getByText('1 region(s) downloaded')).toBeTruthy();
  });
});
