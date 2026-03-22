// @ts-nocheck
/**
 * Tests for pwaRegistration service
 * Covers: service worker registration, online/offline detection,
 *         notification permission, push subscription (subscribeToPush),
 *         update detection, error handling.
 */

// ─── Platform mock (default web) ─────────────────────────────────────────────
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform.OS = 'web';
  return RN;
});

import { Platform } from 'react-native';
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
} from '../pwaRegistration';

function setPlatformOS(os: string) {
  (Platform as any).OS = os;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRegistration({
  updateFails = false,
}: { updateFails?: boolean } = {}) {
  return {
    update: jest.fn().mockImplementation(() =>
      updateFails ? Promise.reject(new Error('update failed')) : Promise.resolve()
    ),
    addEventListener: jest.fn(),
    pushManager: {
      getSubscription: jest.fn().mockResolvedValue(null),
      subscribe: jest.fn().mockResolvedValue({ endpoint: 'https://push.example.com' }),
    },
  };
}

function mockServiceWorker(reg: any) {
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: {
      register: jest.fn().mockResolvedValue(reg),
      addEventListener: jest.fn(),
      ready: Promise.resolve(reg),
    },
    writable: true,
    configurable: true,
  });
}

function mockNotification(permission: NotificationPermission = 'granted') {
  (global as any).Notification = class {
    static permission: NotificationPermission = permission;
    static requestPermission = jest.fn().mockResolvedValue(permission);
    constructor(_title: string, _opts?: any) {}
  };
}

function clearServiceWorker() {
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  setPlatformOS('web');
  // Reset window to global (simulate browser environment)
  if (typeof global.window === 'undefined') {
    global.window = global as any;
  }
});

afterEach(() => {
  jest.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// registerServiceWorker
// ─────────────────────────────────────────────────────────────────────────────

describe('registerServiceWorker', () => {
  it('returns null on non-web platform', async () => {
    setPlatformOS('ios');
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });

  it('returns null when serviceWorker is not in navigator', async () => {
    clearServiceWorker();
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });

  it('registers /sw.js with scope "/" and returns the registration object', async () => {
    const reg = buildRegistration();
    mockServiceWorker(reg);

    const result = await registerServiceWorker();

    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(result).toBe(reg);
  });

  it('returns null when navigator.serviceWorker.register throws', async () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockRejectedValue(new Error('Registration failed')),
        addEventListener: jest.fn(),
      },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });

  it('sets up a 30-minute update interval', async () => {
    const reg = buildRegistration();
    mockServiceWorker(reg);
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    await registerServiceWorker();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30 * 60 * 1000);
  });

  it('calls registration.update() when the 30-min interval fires', async () => {
    const reg = buildRegistration();
    mockServiceWorker(reg);

    await registerServiceWorker();

    jest.advanceTimersByTime(30 * 60 * 1000);
    expect(reg.update).toHaveBeenCalled();
  });

  it('silently swallows update() errors in the interval callback', async () => {
    const reg = buildRegistration({ updateFails: true });
    mockServiceWorker(reg);

    await registerServiceWorker();

    expect(() => jest.advanceTimersByTime(30 * 60 * 1000)).not.toThrow();
  });

  it('listens for the controllerchange event', async () => {
    const reg = buildRegistration();
    mockServiceWorker(reg);

    await registerServiceWorker();

    expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requestNotificationPermission
// ─────────────────────────────────────────────────────────────────────────────

describe('requestNotificationPermission', () => {
  it('returns "denied" on non-web platform', async () => {
    setPlatformOS('ios');
    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
  });

  it('returns "denied" when Notification API is absent', async () => {
    const saved = (global as any).Notification;
    delete (global as any).Notification;
    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
    (global as any).Notification = saved;
  });

  it('returns "granted" immediately when permission is already granted', async () => {
    mockNotification('granted');
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    // Should not call requestPermission if already granted
    expect((global as any).Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('returns "denied" immediately when permission is already denied', async () => {
    mockNotification('denied');
    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
    expect((global as any).Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('calls Notification.requestPermission() when status is default/prompt', async () => {
    (global as any).Notification = class {
      static permission: NotificationPermission = 'default';
      static requestPermission = jest.fn().mockResolvedValue('granted');
    };

    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect((global as any).Notification.requestPermission).toHaveBeenCalled();
  });

  it('returns denied when user dismisses the prompt (default result)', async () => {
    (global as any).Notification = class {
      static permission: NotificationPermission = 'default';
      static requestPermission = jest.fn().mockResolvedValue('denied');
    };

    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// subscribeToPush
// ─────────────────────────────────────────────────────────────────────────────

describe('subscribeToPush', () => {
  it('returns null when registration.pushManager is absent', async () => {
    const reg = { pushManager: undefined } as any;
    const result = await subscribeToPush(reg);
    expect(result).toBeNull();
  });

  it('returns existing subscription if one already exists', async () => {
    const existingSub = { endpoint: 'https://existing.push.com' };
    const reg = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(existingSub),
        subscribe: jest.fn(),
      },
    } as any;

    const result = await subscribeToPush(reg, 'vapid-key');
    expect(result).toBe(existingSub);
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('returns null when no existing sub and no vapidPublicKey is provided', async () => {
    const reg = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe: jest.fn(),
      },
    } as any;

    const result = await subscribeToPush(reg); // no vapidPublicKey
    expect(result).toBeNull();
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('creates a new subscription when no existing sub and vapidPublicKey is given', async () => {
    // atob must be available for urlBase64ToUint8Array
    global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

    const newSub = { endpoint: 'https://new.push.com' };
    const reg = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe: jest.fn().mockResolvedValue(newSub),
      },
    } as any;

    // A minimal valid base64url VAPID key
    const vapidKey = 'dGVzdC12YXBpZC1rZXktd2l0aC1hZGVxdWF0ZS1sZW5ndGgtMTIzNDU=';
    const result = await subscribeToPush(reg, vapidKey);

    expect(reg.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(result).toBe(newSub);
  });

  it('returns null when pushManager.subscribe throws', async () => {
    global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

    const reg = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe: jest.fn().mockRejectedValue(new Error('Subscribe failed')),
      },
    } as any;

    const vapidKey = 'dGVzdC12YXBpZC1rZXktd2l0aC1hZGVxdWF0ZS1sZW5ndGgtMTIzNDU=';
    const result = await subscribeToPush(reg, vapidKey);
    expect(result).toBeNull();
  });

  it('returns null when getSubscription throws', async () => {
    const reg = {
      pushManager: {
        getSubscription: jest.fn().mockRejectedValue(new Error('Permission denied')),
        subscribe: jest.fn(),
      },
    } as any;

    const result = await subscribeToPush(reg, 'some-key');
    expect(result).toBeNull();
  });
});
