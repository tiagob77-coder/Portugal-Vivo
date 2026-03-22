// @ts-nocheck
/**
 * Tests for Background Tasks Service
 * Covers: task registration (native/web), web proximity polling,
 *         stopWebProximityPolling, error handling, expo-task-manager mocking
 */

// ─── In-memory AsyncStorage mock ─────────────────────────────────────────────
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

// ─── expo-task-manager mock ───────────────────────────────────────────────────
const mockDefineTask = jest.fn();
const mockIsTaskRegisteredAsync = jest.fn().mockResolvedValue(false);
const mockUnregisterTaskAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-task-manager', () => ({
  defineTask: (...args: any[]) => mockDefineTask(...args),
  isTaskRegisteredAsync: (...args: any[]) => mockIsTaskRegisteredAsync(...args),
  unregisterTaskAsync: (...args: any[]) => mockUnregisterTaskAsync(...args),
  __esModule: true,
  default: {
    defineTask: (...args: any[]) => mockDefineTask(...args),
    isTaskRegisteredAsync: (...args: any[]) => mockIsTaskRegisteredAsync(...args),
    unregisterTaskAsync: (...args: any[]) => mockUnregisterTaskAsync(...args),
  },
}));

// ─── expo-background-fetch mock ───────────────────────────────────────────────
const mockRegisterTaskAsync = jest.fn().mockResolvedValue(undefined);
const mockUnregisterTaskAsync2 = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: (...args: any[]) => mockRegisterTaskAsync(...args),
  unregisterTaskAsync: (...args: any[]) => mockUnregisterTaskAsync2(...args),
  BackgroundFetchResult: { NewData: 1, NoData: 2, Failed: 3 },
  __esModule: true,
  default: {
    registerTaskAsync: (...args: any[]) => mockRegisterTaskAsync(...args),
    unregisterTaskAsync: (...args: any[]) => mockUnregisterTaskAsync2(...args),
  },
}));

// ─── pushNotificationService mock ─────────────────────────────────────────────
const mockScheduleLocalNotification = jest.fn().mockResolvedValue('notif-id');

jest.mock('../pushNotifications', () => ({
  pushNotificationService: {
    scheduleLocalNotification: (...args: any[]) => mockScheduleLocalNotification(...args),
  },
  __esModule: true,
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { Platform } from 'react-native';
import {
  PROXIMITY_CHECK_TASK,
  registerBackgroundTasks,
  unregisterBackgroundTasks,
  startWebProximityPolling,
  stopWebProximityPolling,
} from '../backgroundTasks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reset geolocation mock to a default resolved position */
function mockGeolocation(lat = 38.7, lng = -9.1) {
  (global.navigator as any).geolocation = {
    getCurrentPosition: jest.fn((success) =>
      success({ coords: { latitude: lat, longitude: lng } }),
    ),
    watchPosition: jest.fn(() => 42),
    clearWatch: jest.fn(),
  };
}

/** Set up a fetch mock that returns a proximity response */
function mockFetchNearby(
  notifications: { title: string; body: string; poi_id: string }[] = [],
) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ notifications }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('PROXIMITY_CHECK_TASK', () => {
  it('exports the expected task name string', () => {
    expect(PROXIMITY_CHECK_TASK).toBe('PT_VIVO_PROXIMITY_CHECK');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registerBackgroundTasks / unregisterBackgroundTasks
// ─────────────────────────────────────────────────────────────────────────────

describe('registerBackgroundTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  it('is a no-op on web and resolves without error', async () => {
    (Platform as any).OS = 'web';
    await expect(registerBackgroundTasks()).resolves.toBeUndefined();
  });

  it('resolves without error on native (deferred native build)', async () => {
    (Platform as any).OS = 'ios';
    await expect(registerBackgroundTasks()).resolves.toBeUndefined();
  });
});

describe('unregisterBackgroundTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is a no-op on web and resolves without error', async () => {
    (Platform as any).OS = 'web';
    await expect(unregisterBackgroundTasks()).resolves.toBeUndefined();
  });

  it('resolves without error on native (deferred native build)', async () => {
    (Platform as any).OS = 'ios';
    await expect(unregisterBackgroundTasks()).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startWebProximityPolling / stopWebProximityPolling
// ─────────────────────────────────────────────────────────────────────────────

describe('startWebProximityPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.useFakeTimers();
    (Platform as any).OS = 'web';
    mockGeolocation();
    mockFetchNearby();
  });

  afterEach(() => {
    stopWebProximityPolling(); // ensure interval is always cleared
    jest.useRealTimers();
  });

  it('is a no-op when Platform.OS is not "web"', () => {
    (Platform as any).OS = 'ios';
    const spy = jest.spyOn(global, 'setInterval');
    startWebProximityPolling();
    expect(spy).not.toHaveBeenCalled();
  });

  it('calls navigator.geolocation.getCurrentPosition on first run', () => {
    mockGeolocation();
    startWebProximityPolling();
    expect((global.navigator as any).geolocation.getCurrentPosition).toHaveBeenCalled();
  });

  it('sets up an interval for repeated checks', () => {
    const spy = jest.spyOn(global, 'setInterval');
    startWebProximityPolling();
    expect(spy).toHaveBeenCalled();
  });

  it('clears previous interval before starting a new one', () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    startWebProximityPolling(); // first call — no previous interval to clear
    startWebProximityPolling(); // second call — should clear the first
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe('stopWebProximityPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (Platform as any).OS = 'web';
    mockGeolocation();
    mockFetchNearby();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears the interval and does not throw when no interval is active', () => {
    expect(() => stopWebProximityPolling()).not.toThrow();
  });

  it('stops the interval after start', () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    startWebProximityPolling();
    stopWebProximityPolling();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('is idempotent — calling stop twice does not throw', () => {
    startWebProximityPolling();
    expect(() => {
      stopWebProximityPolling();
      stopWebProximityPolling();
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Web proximity check — fetch & notification scheduling
// ─────────────────────────────────────────────────────────────────────────────

describe('web proximity check — notification scheduling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.useFakeTimers();
    (Platform as any).OS = 'web';
  });

  afterEach(() => {
    stopWebProximityPolling();
    jest.useRealTimers();
  });

  it('calls scheduleLocalNotification when the backend returns notifications', async () => {
    mockStorage['session_token'] = 'tok-123';
    mockStorage['user_id'] = 'u-1';
    mockGeolocation(38.7, -9.1);
    mockFetchNearby([{ title: 'Castelo', body: 'Estás perto!', poi_id: 'poi-99' }]);

    startWebProximityPolling();

    // Flush promises: each await inside the geolocation callback needs a microtask tick
    // (session_token, user_id, fetch, json, scheduleLocalNotification)
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(mockScheduleLocalNotification).toHaveBeenCalledWith(
      'Castelo',
      'Estás perto!',
      expect.objectContaining({ type: 'poi_nearby', poiId: 'poi-99' }),
    );
  });

  it('does not call scheduleLocalNotification when backend returns no notifications', async () => {
    mockGeolocation();
    mockFetchNearby([]); // empty

    startWebProximityPolling();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockScheduleLocalNotification).not.toHaveBeenCalled();
  });

  it('skips proximity check when navigator.geolocation is unavailable', () => {
    (global.navigator as any).geolocation = undefined;

    // Should not throw
    expect(() => startWebProximityPolling()).not.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles a failed fetch gracefully (no unhandled rejection)', async () => {
    mockGeolocation();
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    startWebProximityPolling();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // No notification should have been scheduled
    expect(mockScheduleLocalNotification).not.toHaveBeenCalled();
  });

  it('handles a non-ok fetch response gracefully', async () => {
    mockGeolocation();
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    startWebProximityPolling();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockScheduleLocalNotification).not.toHaveBeenCalled();
  });
});
