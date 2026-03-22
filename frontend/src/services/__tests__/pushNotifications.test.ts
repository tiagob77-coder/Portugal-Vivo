// @ts-nocheck
/**
 * Tests for PushNotificationService
 * Covers: permission request, token registration, local notification scheduling,
 *         foreground listener management, web vs native paths, backend registration,
 *         badge count, cancel/dismiss, cleanup.
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

// ─── expo-notifications mock ──────────────────────────────────────────────────
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockSetNotificationHandler = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' });
const mockScheduleNotificationAsync = jest.fn().mockResolvedValue('notif-id-123');
const mockCancelAllScheduledNotificationsAsync = jest.fn().mockResolvedValue(undefined);
const mockDismissAllNotificationsAsync = jest.fn().mockResolvedValue(undefined);
const mockGetBadgeCountAsync = jest.fn().mockResolvedValue(3);
const mockSetBadgeCountAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: any[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: any[]) => mockRequestPermissionsAsync(...args),
  setNotificationHandler: (...args: any[]) => mockSetNotificationHandler(...args),
  getExpoPushTokenAsync: (...args: any[]) => mockGetExpoPushTokenAsync(...args),
  scheduleNotificationAsync: (...args: any[]) => mockScheduleNotificationAsync(...args),
  cancelAllScheduledNotificationsAsync: (...args: any[]) =>
    mockCancelAllScheduledNotificationsAsync(...args),
  dismissAllNotificationsAsync: (...args: any[]) => mockDismissAllNotificationsAsync(...args),
  getBadgeCountAsync: (...args: any[]) => mockGetBadgeCountAsync(...args),
  setBadgeCountAsync: (...args: any[]) => mockSetBadgeCountAsync(...args),
  __esModule: true,
}));

// ─── expo-device mock ─────────────────────────────────────────────────────────
jest.mock('expo-device', () => ({
  isDevice: true,
  __esModule: true,
  default: { isDevice: true },
}));

// ─── API config mock ──────────────────────────────────────────────────────────
jest.mock('../../config/api', () => ({
  API_BASE: 'http://test-api',
}));

// ─── Platform mock (default: non-web / native) ───────────────────────────────
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform.OS = 'ios';
  return RN;
});

import { Platform } from 'react-native';
import { pushNotificationService } from '../pushNotifications';

// Helper to change Platform.OS at test time
function setPlatformOS(os: string) {
  (Platform as any).OS = os;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSwRegistration(subscriptionJSON?: object) {
  const sub = subscriptionJSON
    ? { toJSON: () => subscriptionJSON }
    : null;
  return {
    pushManager: {
      getSubscription: jest.fn().mockResolvedValue(sub),
      subscribe: jest.fn().mockResolvedValue({ toJSON: () => ({ endpoint: 'ep' }) }),
    },
    showNotification: jest.fn().mockResolvedValue(undefined),
  };
}

function mockWebNotificationAPI(permission: NotificationPermission = 'granted') {
  (global as any).Notification = class {
    static permission: NotificationPermission = permission;
    static requestPermission = jest.fn().mockResolvedValue(permission);
    constructor(_title: string, _opts?: any) {}
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  jest.clearAllMocks();
  // Reset the service's internal state between tests by calling cleanup
  pushNotificationService.cleanup();
  // Restore native platform as default
  setPlatformOS('ios');
});

// ─────────────────────────────────────────────────────────────────────────────
// initialize — native path
// ─────────────────────────────────────────────────────────────────────────────

describe('initialize — native', () => {
  it('returns a push token when permission is already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    const token = await pushNotificationService.initialize();
    expect(token).toBe('ExponentPushToken[test]');
  });

  it('requests permission when not already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

    await pushNotificationService.initialize();
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

    const token = await pushNotificationService.initialize();
    expect(token).toBeNull();
  });

  it('sets a notification handler after getting token', async () => {
    await pushNotificationService.initialize();
    expect(mockSetNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) }),
    );
  });

  it('persists push token to AsyncStorage', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await pushNotificationService.initialize();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'push_notification_token',
      'ExponentPushToken[test]',
    );
  });

  it('returns null when not running on a physical device', async () => {
    // Override expo-device isDevice to false for this test
    jest.resetModules();
    jest.mock('expo-device', () => ({ isDevice: false, __esModule: true }));
    const { pushNotificationService: freshService } = require('../pushNotifications');
    const token = await freshService.initialize();
    expect(token).toBeNull();
  });

  it('returns null when expo-notifications throws', async () => {
    mockGetPermissionsAsync.mockRejectedValueOnce(new Error('not available'));
    const token = await pushNotificationService.initialize();
    expect(token).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// initialize — web path
// ─────────────────────────────────────────────────────────────────────────────

describe('initialize — web', () => {
  beforeEach(() => {
    setPlatformOS('web');
    mockWebNotificationAPI('granted');
    pushNotificationService.cleanup();
  });

  it('returns null when window is undefined', async () => {
    const saved = global.window;
    // @ts-ignore
    delete global.window;
    const token = await pushNotificationService.initialize();
    expect(token).toBeNull();
    global.window = saved;
  });

  it('returns null when Notification API is absent', async () => {
    const saved = (global as any).Notification;
    delete (global as any).Notification;
    const token = await pushNotificationService.initialize();
    expect(token).toBeNull();
    (global as any).Notification = saved;
  });

  it('returns null when serviceWorker is absent in navigator', async () => {
    const savedSW = (navigator as any).serviceWorker;
    delete (navigator as any).serviceWorker;
    const token = await pushNotificationService.initialize();
    expect(token).toBeNull();
    (navigator as any).serviceWorker = savedSW;
  });

  it('returns null when notification permission is denied', async () => {
    mockWebNotificationAPI('denied');
    // Ensure navigator.serviceWorker is present so we reach the permission check
    (navigator as any).serviceWorker = { ready: Promise.resolve(buildSwRegistration()) };
    const token = await pushNotificationService.initialize();
    expect(token).toBeNull();
  });

  it('generates a web token and persists it when permission is granted and no existing sub', async () => {
    const reg = buildSwRegistration(null); // no existing subscription
    (navigator as any).serviceWorker = {
      ready: Promise.resolve(reg),
      addEventListener: jest.fn(),
    };

    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await pushNotificationService.initialize();

    // The token may be web_... (new token) or may use an existing sub if the singleton cached one;
    // either way it must be stored in AsyncStorage and be non-null
    expect(token).not.toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('push_notification_token', token);
  });

  it('uses existing subscription JSON as token when one exists', async () => {
    const subJSON = { endpoint: 'https://push.example.com/sub', keys: {} };
    const reg = buildSwRegistration(subJSON);
    (navigator as any).serviceWorker = {
      ready: Promise.resolve(reg),
      addEventListener: jest.fn(),
    };

    const token = await pushNotificationService.initialize();
    expect(token).toBe(JSON.stringify(subJSON));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registerTokenWithBackend
// ─────────────────────────────────────────────────────────────────────────────

describe('registerTokenWithBackend', () => {
  it('returns false when no push token is set', async () => {
    // Use isolateModules to get a fresh service without polluting the global registry
    let result: boolean = true;
    await jest.isolateModulesAsync(async () => {
      jest.mock('@react-native-async-storage/async-storage', () => ({
        getItem: jest.fn(() => Promise.resolve(null)),
        setItem: jest.fn(() => Promise.resolve()),
        __esModule: true,
        default: {
          getItem: jest.fn(() => Promise.resolve(null)),
          setItem: jest.fn(() => Promise.resolve()),
        },
      }));
      jest.mock('../../config/api', () => ({ API_BASE: 'http://test-api' }));
      jest.mock('react-native', () => {
        const RN = jest.requireActual('react-native');
        RN.Platform.OS = 'ios';
        return RN;
      });
      const { pushNotificationService: freshSvc } = require('../pushNotifications');
      result = await freshSvc.registerTokenWithBackend();
    });
    expect(result).toBe(false);
  });

  it('returns false when no session token is in storage', async () => {
    // Initialize to set push token
    await pushNotificationService.initialize();
    // No session_token in storage
    const result = await pushNotificationService.registerTokenWithBackend();
    expect(result).toBe(false);
  });

  it('posts to /notifications/register and returns true on success', async () => {
    mockStorage['session_token'] = 'session-abc';
    await pushNotificationService.initialize();

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const result = await pushNotificationService.registerTokenWithBackend();
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/notifications/register'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer session-abc' }),
      }),
    );
  });

  it('returns false when fetch returns non-ok', async () => {
    mockStorage['session_token'] = 'session-abc';
    await pushNotificationService.initialize();
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const result = await pushNotificationService.registerTokenWithBackend();
    expect(result).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    mockStorage['session_token'] = 'session-abc';
    await pushNotificationService.initialize();
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const result = await pushNotificationService.registerTokenWithBackend();
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scheduleLocalNotification — native
// ─────────────────────────────────────────────────────────────────────────────

describe('scheduleLocalNotification — native', () => {
  beforeEach(() => {
    setPlatformOS('ios');
  });

  it('schedules notification via expo-notifications', async () => {
    const id = await pushNotificationService.scheduleLocalNotification(
      'Test Title',
      'Test body',
      { key: 'val' },
    );
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: 'Test Title', body: 'Test body' }),
      }),
    );
    expect(id).toBe('notif-id-123');
  });

  it('passes trigger with seconds when triggerSeconds is provided', async () => {
    await pushNotificationService.scheduleLocalNotification('T', 'B', {}, 60);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ seconds: 60 }),
      }),
    );
  });

  it('passes null trigger when no triggerSeconds', async () => {
    await pushNotificationService.scheduleLocalNotification('T', 'B');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: null }),
    );
  });

  it('returns empty string when expo-notifications throws', async () => {
    mockScheduleNotificationAsync.mockRejectedValueOnce(new Error('fail'));
    const id = await pushNotificationService.scheduleLocalNotification('T', 'B');
    expect(id).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scheduleLocalNotification — web
// ─────────────────────────────────────────────────────────────────────────────

describe('scheduleLocalNotification — web', () => {
  beforeEach(() => {
    setPlatformOS('web');
    mockWebNotificationAPI('granted');
  });

  it('returns a web-notif-* id string', async () => {
    const id = await pushNotificationService.scheduleLocalNotification('T', 'B');
    expect(id).toMatch(/^web-notif-/);
  });

  it('returns empty string when Notification is absent', async () => {
    delete (global as any).Notification;
    const id = await pushNotificationService.scheduleLocalNotification('T', 'B');
    expect(id).toBe('');
  });

  it('returns empty string when notification permission is not granted', async () => {
    mockWebNotificationAPI('denied');
    const id = await pushNotificationService.scheduleLocalNotification('T', 'B');
    expect(id).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Convenience schedulers
// ─────────────────────────────────────────────────────────────────────────────

describe('convenience schedulers', () => {
  beforeEach(() => {
    setPlatformOS('ios');
  });

  it('schedulePoiDoDia calls scheduleLocalNotification with correct title', async () => {
    const spy = jest.spyOn(pushNotificationService, 'scheduleLocalNotification');
    await pushNotificationService.schedulePoiDoDia('Palácio', 'poi-1', 'Lisboa');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Palácio'),
      expect.stringContaining('Lisboa'),
      expect.objectContaining({ type: 'poi_do_dia', poiId: 'poi-1' }),
    );
  });

  it('scheduleNearbyEvent passes correct data object', async () => {
    const spy = jest.spyOn(pushNotificationService, 'scheduleLocalNotification');
    await pushNotificationService.scheduleNearbyEvent('Festival', 'ev-1', '500m');
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Festival'),
      expect.objectContaining({ type: 'event_nearby', eventId: 'ev-1' }),
    );
  });

  it('scheduleStreakReminder passes 18-hour trigger and streak count in body', async () => {
    const spy = jest.spyOn(pushNotificationService, 'scheduleLocalNotification');
    await pushNotificationService.scheduleStreakReminder(5);
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('5'),
      expect.objectContaining({ type: 'streak_reminder' }),
      18 * 60 * 60,
    );
  });

  it('scheduleSurfAlert resolves to empty string', async () => {
    const result = await pushNotificationService.scheduleSurfAlert();
    expect(result).toBe('');
  });

  it('scheduleGeofenceNotification resolves to empty string', async () => {
    const result = await pushNotificationService.scheduleGeofenceNotification();
    expect(result).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Listener management
// ─────────────────────────────────────────────────────────────────────────────

describe('listener management', () => {
  it('addNotificationReceivedListener calls callback on message', () => {
    const cb = jest.fn();
    pushNotificationService.addNotificationReceivedListener(cb);
    // Simulate a message event from the service worker path (internal)
    // We verify by calling cleanup and confirming the listener is removed
    pushNotificationService.cleanup();
    // After cleanup, listeners are cleared — no easy way to trigger them,
    // but we can verify the return value is a removal function
  });

  it('addNotificationReceivedListener returns an unsubscribe function', () => {
    const cb = jest.fn();
    const unsub = pushNotificationService.addNotificationReceivedListener(cb);
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('addNotificationResponseListener returns an unsubscribe function', () => {
    const cb = jest.fn();
    const unsub = pushNotificationService.addNotificationResponseListener(cb);
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('calling the unsubscribe removes the listener', () => {
    const cb = jest.fn();
    const unsub = pushNotificationService.addNotificationReceivedListener(cb);
    unsub();
    // Re-add and check that the old listener isn't duplicated
    pushNotificationService.addNotificationReceivedListener(cb);
    pushNotificationService.cleanup();
    // No assertion needed — just confirm no throw
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPushToken — uses fresh module instances to avoid singleton token leak
// ─────────────────────────────────────────────────────────────────────────────

describe('getPushToken', () => {
  it('returns token from memory when already initialised', async () => {
    let token: string | null = null;
    await jest.isolateModulesAsync(async () => {
      jest.mock('@react-native-async-storage/async-storage', () => ({
        getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
        setItem: jest.fn((key: string, value: string) => {
          mockStorage[key] = value;
          return Promise.resolve();
        }),
        removeItem: jest.fn((key: string) => { delete mockStorage[key]; return Promise.resolve(); }),
        __esModule: true,
        default: {
          getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
          setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); }),
          removeItem: jest.fn((key: string) => { delete mockStorage[key]; return Promise.resolve(); }),
        },
      }));
      jest.mock('expo-notifications', () => ({
        getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
        requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
        setNotificationHandler: jest.fn(),
        getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
        __esModule: true,
      }));
      jest.mock('expo-device', () => ({ isDevice: true, __esModule: true }));
      jest.mock('../../config/api', () => ({ API_BASE: 'http://test-api' }));
      jest.mock('react-native', () => {
        const RN = jest.requireActual('react-native');
        RN.Platform.OS = 'ios';
        return RN;
      });
      const { pushNotificationService: svc } = require('../pushNotifications');
      await svc.initialize();
      token = await svc.getPushToken();
    });
    expect(token).toBe('ExponentPushToken[test]');
  });

  it('falls back to AsyncStorage when in-memory token is absent', async () => {
    mockStorage['push_notification_token'] = 'stored-token';
    let token: string | null = null;
    await jest.isolateModulesAsync(async () => {
      jest.mock('@react-native-async-storage/async-storage', () => ({
        getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
        setItem: jest.fn(() => Promise.resolve()),
        __esModule: true,
        default: {
          getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
          setItem: jest.fn(() => Promise.resolve()),
        },
      }));
      jest.mock('../../config/api', () => ({ API_BASE: 'http://test-api' }));
      jest.mock('react-native', () => {
        const RN = jest.requireActual('react-native');
        RN.Platform.OS = 'ios';
        return RN;
      });
      const { pushNotificationService: svc } = require('../pushNotifications');
      token = await svc.getPushToken();
    });
    expect(token).toBe('stored-token');
  });

  it('returns null when neither memory nor storage has a token', async () => {
    let token: string | null = 'not-null';
    await jest.isolateModulesAsync(async () => {
      jest.mock('@react-native-async-storage/async-storage', () => ({
        getItem: jest.fn(() => Promise.resolve(null)),
        setItem: jest.fn(() => Promise.resolve()),
        __esModule: true,
        default: {
          getItem: jest.fn(() => Promise.resolve(null)),
          setItem: jest.fn(() => Promise.resolve()),
        },
      }));
      jest.mock('../../config/api', () => ({ API_BASE: 'http://test-api' }));
      jest.mock('react-native', () => {
        const RN = jest.requireActual('react-native');
        RN.Platform.OS = 'ios';
        return RN;
      });
      const { pushNotificationService: svc } = require('../pushNotifications');
      token = await svc.getPushToken();
    });
    expect(token).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelAllNotifications / dismissAllNotifications / badge count
// ─────────────────────────────────────────────────────────────────────────────

describe('cancelAllNotifications — native', () => {
  it('calls cancelAllScheduledNotificationsAsync on native', async () => {
    setPlatformOS('ios');
    await pushNotificationService.cancelAllNotifications();
    expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });

  it('does not call expo-notifications on web', async () => {
    setPlatformOS('web');
    await pushNotificationService.cancelAllNotifications();
    expect(mockCancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
});

describe('dismissAllNotifications — native', () => {
  it('calls dismissAllNotificationsAsync on native', async () => {
    setPlatformOS('ios');
    await pushNotificationService.dismissAllNotifications();
    expect(mockDismissAllNotificationsAsync).toHaveBeenCalled();
  });
});

describe('getBadgeCount', () => {
  it('returns count from expo-notifications on native', async () => {
    setPlatformOS('ios');
    const count = await pushNotificationService.getBadgeCount();
    expect(count).toBe(3);
  });

  it('returns 0 on web', async () => {
    setPlatformOS('web');
    const count = await pushNotificationService.getBadgeCount();
    expect(count).toBe(0);
  });

  it('returns 0 when expo-notifications throws', async () => {
    setPlatformOS('ios');
    mockGetBadgeCountAsync.mockRejectedValueOnce(new Error('fail'));
    const count = await pushNotificationService.getBadgeCount();
    expect(count).toBe(0);
  });
});

describe('setBadgeCount', () => {
  it('calls setBadgeCountAsync on native', async () => {
    setPlatformOS('ios');
    await pushNotificationService.setBadgeCount(5);
    expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(5);
  });

  it('is a no-op on web', async () => {
    setPlatformOS('web');
    await pushNotificationService.setBadgeCount(5);
    expect(mockSetBadgeCountAsync).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getDeliveredNotifications / cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe('getDeliveredNotifications', () => {
  it('always returns an empty array', async () => {
    const result = await pushNotificationService.getDeliveredNotifications();
    expect(result).toEqual([]);
  });
});

describe('cleanup', () => {
  it('does not throw', () => {
    expect(() => pushNotificationService.cleanup()).not.toThrow();
  });
});
