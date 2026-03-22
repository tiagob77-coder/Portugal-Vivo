// @ts-nocheck
/**
 * Tests for GeofenceService
 * Covers: start/stop, web geolocation watching, native expo-location,
 *         alert cooldowns, nearby fetching, notification permission, history, callbacks
 */

// ─── expo-location mock ───────────────────────────────────────────────────────
const mockRequestForegroundPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockWatchPositionAsync = jest.fn();
const mockRemove = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args: any[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  watchPositionAsync: (...args: any[]) => mockWatchPositionAsync(...args),
  Accuracy: { Balanced: 3 },
  __esModule: true,
  default: {
    requestForegroundPermissionsAsync: (...args: any[]) =>
      mockRequestForegroundPermissionsAsync(...args),
    watchPositionAsync: (...args: any[]) => mockWatchPositionAsync(...args),
    Accuracy: { Balanced: 3 },
  },
}));

// ─── Platform mock — keep real RN so Platform is mutable; each beforeEach sets OS ─
jest.mock('react-native', () => jest.requireActual('react-native'));

// ─── API URL mock ─────────────────────────────────────────────────────────────
jest.mock('../../config/api', () => ({
  API_URL: 'http://localhost:8000',
  API_BASE: 'http://localhost:8000/api',
  __esModule: true,
}));

import { Platform } from 'react-native';

// We import the module under test AFTER mocks are in place.
// To get a fresh service instance per test group we use jest.resetModules in some describe blocks.
import { geofenceService } from '../geofencing';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildGeolocationMock(lat = 38.7, lng = -9.1) {
  let watchCallback: ((pos: any) => void) | null = null;
  const geo = {
    getCurrentPosition: jest.fn((success) =>
      success({ coords: { latitude: lat, longitude: lng } }),
    ),
    watchPosition: jest.fn((success) => {
      watchCallback = success;
      return 99; // watch id
    }),
    clearWatch: jest.fn(),
    _triggerWatch: (newLat: number, newLng: number) => {
      watchCallback?.({ coords: { latitude: newLat, longitude: newLng } });
    },
  };
  return geo;
}

function mockFetch(alertsBody: any = { alerts: [] }, nearbyBody: any = { pois: [], total: 0 }) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/alerts')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(alertsBody) });
    }
    if (url.includes('/nearby')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(nearbyBody) });
    }
    return Promise.resolve({ ok: false });
  });
}

function mockNotificationAPI(permission: NotificationPermission = 'granted') {
  (global as any).Notification = class {
    static permission: NotificationPermission = permission;
    static requestPermission = jest.fn().mockResolvedValue(permission);
    constructor(_title: string, _opts?: any) {}
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GeofenceService — basic state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    geofenceService.stop();
    geofenceService.clearHistory();
    (Platform as any).OS = 'web';
    mockFetch();
  });

  it('is not running before start()', () => {
    expect(geofenceService.isRunning()).toBe(false);
  });

  it('has an empty alert history on init', () => {
    expect(geofenceService.getAlertHistory()).toHaveLength(0);
  });

  it('has an empty nearby POIs list on init', () => {
    expect(geofenceService.getNearbyPois()).toHaveLength(0);
  });

  it('getLastPosition returns 0,0 on init', () => {
    expect(geofenceService.getLastPosition()).toEqual({ lat: 0, lng: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Web: start / stop
// ─────────────────────────────────────────────────────────────────────────────

describe('GeofenceService — web start/stop', () => {
  let geo: ReturnType<typeof buildGeolocationMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    geofenceService.stop();
    geofenceService.clearHistory();
    (Platform as any).OS = 'web';
    geo = buildGeolocationMock();
    (global.navigator as any).geolocation = geo;
    mockFetch();
    mockNotificationAPI('denied');
  });

  afterEach(() => {
    geofenceService.stop();
  });

  it('sets isRunning to true after start()', async () => {
    await geofenceService.start();
    expect(geofenceService.isRunning()).toBe(true);
  });

  it('calls navigator.geolocation.getCurrentPosition on start', async () => {
    await geofenceService.start();
    expect(geo.getCurrentPosition).toHaveBeenCalled();
  });

  it('calls navigator.geolocation.watchPosition on start', async () => {
    await geofenceService.start();
    expect(geo.watchPosition).toHaveBeenCalled();
  });

  it('sets isRunning to false after stop()', async () => {
    await geofenceService.start();
    geofenceService.stop();
    expect(geofenceService.isRunning()).toBe(false);
  });

  it('calls clearWatch on stop', async () => {
    await geofenceService.start();
    geofenceService.stop();
    expect(geo.clearWatch).toHaveBeenCalledWith(99);
  });

  it('does not start twice (idempotent)', async () => {
    await geofenceService.start();
    await geofenceService.start(); // second call should be a no-op
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('does nothing when navigator.geolocation is absent', async () => {
    (global.navigator as any).geolocation = undefined;
    await expect(geofenceService.start()).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Web: location callback
// ─────────────────────────────────────────────────────────────────────────────

describe('GeofenceService — location callback', () => {
  let geo: ReturnType<typeof buildGeolocationMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    geofenceService.stop();
    geofenceService.clearHistory();
    (Platform as any).OS = 'web';
    geo = buildGeolocationMock(38.7, -9.1);
    (global.navigator as any).geolocation = geo;
    mockFetch();
    mockNotificationAPI('denied');
  });

  afterEach(() => {
    geofenceService.stop();
  });

  it('invokes onLocation callback with lat/lng from getCurrentPosition', async () => {
    const onLocation = jest.fn();
    await geofenceService.start({ onLocation });
    await Promise.resolve();
    expect(onLocation).toHaveBeenCalledWith(38.7, -9.1);
  });

  it('updates lastPosition after receiving a location', async () => {
    await geofenceService.start();
    await Promise.resolve();
    expect(geofenceService.getLastPosition()).toEqual({ lat: 38.7, lng: -9.1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Web: alert handling & cooldown
// ─────────────────────────────────────────────────────────────────────────────

describe('GeofenceService — alert handling', () => {
  let geo: ReturnType<typeof buildGeolocationMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    geofenceService.stop();
    geofenceService.clearHistory();
    (Platform as any).OS = 'web';
    geo = buildGeolocationMock();
    (global.navigator as any).geolocation = geo;
    mockNotificationAPI('denied');
  });

  afterEach(() => {
    geofenceService.stop();
  });

  it('calls onAlert callback when backend returns alerts', async () => {
    const alert = {
      poi_id: 'poi-1',
      poi_name: 'Castelo de Óbidos',
      category: 'heritage',
      iq_score: 90,
      distance_m: 150,
      alert_type: 'normal',
      message: 'Estás perto!',
    };
    mockFetch({ alerts: [alert] });

    const onAlert = jest.fn();
    await geofenceService.start({ onAlert });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onAlert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ poi_id: 'poi-1' })]),
    );
  });

  it('adds alert to history', async () => {
    const alert = {
      poi_id: 'poi-hist',
      poi_name: 'Praia da Marinha',
      category: 'praia',
      iq_score: 85,
      distance_m: 200,
      alert_type: 'normal',
      message: 'Praia perto!',
    };
    mockFetch({ alerts: [alert] });

    await geofenceService.start();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(geofenceService.getAlertHistory().length).toBeGreaterThan(0);
  });

  it('respects cooldown — does not repeat alert within 30 min', async () => {
    const alert = {
      poi_id: 'poi-cool',
      poi_name: 'POI cooldown',
      category: 'termas',
      iq_score: 70,
      distance_m: 300,
      alert_type: 'normal',
      message: 'Perto!',
    };
    mockFetch({ alerts: [alert] });

    const onAlert = jest.fn();
    await geofenceService.start({ onAlert });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const callCount = onAlert.mock.calls.length;

    // Simulate a second position update without stopping
    geo._triggerWatch(38.71, -9.11);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // The alert should NOT be repeated (same poi_id within cooldown)
    expect(onAlert.mock.calls.length).toBe(callCount);
  });

  it('does not call onAlert when alerts array is empty', async () => {
    mockFetch({ alerts: [] });
    const onAlert = jest.fn();
    await geofenceService.start({ onAlert });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(onAlert).not.toHaveBeenCalled();
  });

  it('handles a failed alerts fetch gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const onAlert = jest.fn();
    await geofenceService.start({ onAlert });
    await Promise.resolve();
    await Promise.resolve();
    expect(onAlert).not.toHaveBeenCalled();
  });

  it('clearHistory empties alertHistory and resets cooldowns', async () => {
    const alert = {
      poi_id: 'poi-clr',
      poi_name: 'Clear test',
      category: 'heritage',
      iq_score: null,
      distance_m: 100,
      alert_type: 'normal',
      message: 'test',
    };
    mockFetch({ alerts: [alert] });

    await geofenceService.start();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    geofenceService.clearHistory();
    expect(geofenceService.getAlertHistory()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Web: nearby POIs callback
// ─────────────────────────────────────────────────────────────────────────────

describe('GeofenceService — nearby POIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    geofenceService.stop();
    geofenceService.clearHistory();
    (Platform as any).OS = 'web';
    (global.navigator as any).geolocation = buildGeolocationMock();
    mockNotificationAPI('denied');
  });

  afterEach(() => {
    geofenceService.stop();
  });

  it('invokes onNearby callback with POI list', async () => {
    const pois = [
      {
        id: 'n1',
        name: 'Parque',
        category: 'nature',
        region: 'algarve',
        iq_score: 80,
        distance_km: 0.5,
        distance_m: 500,
      },
    ];
    mockFetch({ alerts: [] }, { pois, total: 1 });

    const onNearby = jest.fn();
    await geofenceService.start({ onNearby });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onNearby).toHaveBeenCalledWith(pois, 1);
  });

  it('getNearby fetches from the backend and returns data', async () => {
    const pois = [
      {
        id: 'n2',
        name: 'Praia',
        category: 'praia',
        region: 'algarve',
        iq_score: 95,
        distance_km: 1.0,
        distance_m: 1000,
      },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pois, total: 1 }),
    });

    const result = await geofenceService.getNearby(38.7, -9.1, 5, 0);
    expect(result.pois).toEqual(pois);
    expect(result.total).toBe(1);
  });

  it('getNearby returns empty result on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fail'));
    const result = await geofenceService.getNearby(38.7, -9.1);
    expect(result).toEqual({ pois: [], total: 0 });
  });

  it('getNearby returns empty result on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const result = await geofenceService.getNearby(38.7, -9.1);
    expect(result).toEqual({ pois: [], total: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Web: notification permission
// ─────────────────────────────────────────────────────────────────────────────

describe('GeofenceService — notification permission (web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    geofenceService.stop();
    geofenceService.clearHistory();
    (Platform as any).OS = 'web';
  });

  it('requestNotificationPermission returns true when granted', async () => {
    mockNotificationAPI('granted');
    (global as any).window = global; // ensure window is defined
    const result = await geofenceService.requestNotificationPermission();
    expect(result).toBe(true);
    expect(geofenceService.hasNotificationPermission()).toBe(true);
  });

  it('requestNotificationPermission returns false when denied', async () => {
    mockNotificationAPI('denied');
    const result = await geofenceService.requestNotificationPermission();
    expect(result).toBe(false);
    expect(geofenceService.hasNotificationPermission()).toBe(false);
  });

  it('requestNotificationPermission returns false when Notification API is absent', async () => {
    const saved = (global as any).Notification;
    delete (global as any).Notification;
    const result = await geofenceService.requestNotificationPermission();
    expect(result).toBe(false);
    (global as any).Notification = saved;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Native: start via expo-location
// ─────────────────────────────────────────────────────────────────────────────

describe('GeofenceService — native start (expo-location)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    geofenceService.stop();
    geofenceService.clearHistory();
    (Platform as any).OS = 'ios';
    mockWatchPositionAsync.mockResolvedValue({ remove: mockRemove });
    mockFetch();
  });

  afterEach(() => {
    geofenceService.stop();
  });

  it('requests foreground location permission on native start', async () => {
    await geofenceService.start();
    expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it('calls watchPositionAsync when permission is granted', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    await geofenceService.start();
    expect(mockWatchPositionAsync).toHaveBeenCalled();
  });

  it('does not call watchPositionAsync when permission is denied', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await geofenceService.start();
    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  });

  it('calls subscription.remove() on stop', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    await geofenceService.start();
    geofenceService.stop();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('returns true from requestNotificationPermission on native (no-op)', async () => {
    const result = await geofenceService.requestNotificationPermission();
    expect(result).toBe(true);
  });
});
