/**
 * Tests for the anonymous impact tracking client (src/services/impactTracking.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory AsyncStorage so persistence across module "restarts" can be tested.
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) =>
      Promise.resolve(Object.prototype.hasOwnProperty.call(mockStorage, key) ? mockStorage[key] : null),
    ),
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

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ status: 202, data: {} })) },
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'pt-PT' }]),
}));

/* eslint-disable import/first */
import api from '../api/client';
import {
  trackImpact,
  flushImpactEvents,
  isImpactTrackingEnabled,
  setImpactTrackingEnabled,
  IMPACT_OPT_OUT_KEY,
  __resetImpactTrackingForTests,
} from '../impactTracking';
/* eslint-enable import/first */

const mockPost = api.post as jest.Mock;
const VISITOR_KEY = 'pv_impact_visitor';

type PostedEvent = {
  event_type: string;
  poi_id?: string;
  route_id?: string;
  municipality?: string;
  source?: string;
  session_id: string;
  platform: string;
  locale?: string;
};

/** All events posted so far, across every batch. */
function postedEvents(): PostedEvent[] {
  return mockPost.mock.calls.flatMap((call) => (call[1] as { events: PostedEvent[] }).events);
}

describe('impactTracking', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2026-10-14T12:00:00Z'));
    __resetImpactTrackingForTests();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    jest.clearAllMocks();
  });

  afterEach(() => {
    __resetImpactTrackingForTests();
    jest.useRealTimers();
  });

  describe('batching', () => {
    it('queues events and posts them as one batch to /impact/events after the flush interval', async () => {
      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' });
      await trackImpact({ event_type: 'audio_play', poi_id: 'poi-1' });
      await trackImpact({ event_type: 'route_view', route_id: 'route-9', source: 'feed' });

      expect(mockPost).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10000);

      expect(mockPost).toHaveBeenCalledTimes(1);
      const [url, body] = mockPost.mock.calls[0];
      expect(url).toBe('/impact/events');
      expect(body.events).toHaveLength(3);
      expect(body.events[0]).toEqual(
        expect.objectContaining({
          event_type: 'poi_view',
          poi_id: 'poi-1',
          platform: 'ios',
          locale: 'pt-PT',
          session_id: expect.any(String),
        }),
      );
      expect(body.events[2]).toEqual(
        expect.objectContaining({ event_type: 'route_view', route_id: 'route-9', source: 'feed' }),
      );
      // Same anonymous visitor for every event of the batch
      const sessionIds = new Set(body.events.map((e: PostedEvent) => e.session_id));
      expect(sessionIds.size).toBe(1);
    });

    it('never sends user identifiers — only the anonymous fields', async () => {
      await trackImpact({ event_type: 'share', poi_id: 'poi-2' });
      await flushImpactEvents();

      const [event] = postedEvents();
      expect(Object.keys(event).sort()).toEqual(
        ['event_type', 'locale', 'platform', 'poi_id', 'session_id'].sort(),
      );
    });

    it('flushes immediately once 20 events are queued', async () => {
      for (let i = 0; i < 19; i++) {
        await trackImpact({ event_type: 'poi_view', poi_id: `poi-${i}` });
      }
      expect(mockPost).not.toHaveBeenCalled();

      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-19' });

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost.mock.calls[0][0]).toBe('/impact/events');
      expect(mockPost.mock.calls[0][1].events).toHaveLength(20);

      // The pending interval timer was cleared — nothing else is sent later.
      await flushImpactEvents();
      jest.advanceTimersByTime(20000);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('flushImpactEvents sends pending events right away and empties the queue', async () => {
      await trackImpact({ event_type: 'directions', poi_id: 'poi-3' });
      await flushImpactEvents();
      expect(mockPost).toHaveBeenCalledTimes(1);

      await flushImpactEvents();
      jest.advanceTimersByTime(10000);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('validation', () => {
    it('ignores events without poi_id, route_id or municipality', async () => {
      await trackImpact({ event_type: 'share' });
      await trackImpact({ event_type: 'qr_scan', source: 'qr' });
      await flushImpactEvents();
      jest.advanceTimersByTime(10000);

      expect(mockPost).not.toHaveBeenCalled();
    });

    it('accepts municipality-only events (e.g. profile_view)', async () => {
      await trackImpact({ event_type: 'profile_view', municipality: 'sintra' });
      await flushImpactEvents();

      expect(postedEvents()).toEqual([
        expect.objectContaining({ event_type: 'profile_view', municipality: 'sintra' }),
      ]);
    });
  });

  describe('opt-out', () => {
    it('is enabled by default', async () => {
      await expect(isImpactTrackingEnabled()).resolves.toBe(true);
    });

    it('drops events and persists the opt-out flag', async () => {
      await setImpactTrackingEnabled(false);

      expect(mockStorage[IMPACT_OPT_OUT_KEY]).toBe('1');
      await expect(isImpactTrackingEnabled()).resolves.toBe(false);

      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' });
      await flushImpactEvents();
      jest.advanceTimersByTime(10000);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('discards events that were already queued when the user opts out', async () => {
      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' });
      await setImpactTrackingEnabled(false);
      await flushImpactEvents();

      expect(mockPost).not.toHaveBeenCalled();
    });

    it('remembers the opt-out after an app restart', async () => {
      await setImpactTrackingEnabled(false);
      __resetImpactTrackingForTests(); // simulates a cold start (in-memory state gone)

      await expect(isImpactTrackingEnabled()).resolves.toBe(false);
      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' });
      await flushImpactEvents();
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('re-enabling removes the flag and resumes tracking', async () => {
      await setImpactTrackingEnabled(false);
      await setImpactTrackingEnabled(true);

      expect(mockStorage[IMPACT_OPT_OUT_KEY]).toBeUndefined();
      await expect(isImpactTrackingEnabled()).resolves.toBe(true);

      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' });
      await flushImpactEvents();
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('visitor id', () => {
    async function sessionIdOfNextEvent(): Promise<string> {
      mockPost.mockClear();
      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' });
      await flushImpactEvents();
      return postedEvents()[0].session_id;
    }

    it('is stable within the same month, including across app restarts', async () => {
      const first = await sessionIdOfNextEvent();

      jest.setSystemTime(new Date('2026-10-30T23:00:00Z'));
      const sameMonth = await sessionIdOfNextEvent();

      __resetImpactTrackingForTests(); // cold start: id must come from storage
      const afterRestart = await sessionIdOfNextEvent();

      expect(first).toBeTruthy();
      expect(sameMonth).toBe(first);
      expect(afterRestart).toBe(first);
      expect(JSON.parse(mockStorage[VISITOR_KEY])).toEqual({ id: first, month: '2026-10' });
    });

    it('rotates when the calendar month changes', async () => {
      const october = await sessionIdOfNextEvent();

      jest.setSystemTime(new Date('2026-11-01T00:05:00Z'));
      const november = await sessionIdOfNextEvent();

      expect(november).toBeTruthy();
      expect(november).not.toBe(october);
      expect(JSON.parse(mockStorage[VISITOR_KEY])).toEqual({ id: november, month: '2026-11' });

      // …and stays stable for the rest of the new month
      jest.setSystemTime(new Date('2026-11-20T10:00:00Z'));
      await expect(sessionIdOfNextEvent()).resolves.toBe(november);
    });

    it('ignores a stored id from a previous month after a restart', async () => {
      mockStorage[VISITOR_KEY] = JSON.stringify({ id: 'old-visitor', month: '2026-09' });

      const id = await sessionIdOfNextEvent();

      expect(id).not.toBe('old-visitor');
      expect(JSON.parse(mockStorage[VISITOR_KEY]).month).toBe('2026-10');
    });
  });

  describe('resilience', () => {
    it('does not throw when the POST fails, and drops the failed batch', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network Error'));

      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' });
      await expect(flushImpactEvents()).resolves.toBeUndefined();
      expect(mockPost).toHaveBeenCalledTimes(1);

      // Failed batch is not retried
      await flushImpactEvents();
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the interval flush fails', async () => {
      mockPost.mockRejectedValueOnce(new Error('500'));

      await trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' });
      expect(() => jest.advanceTimersByTime(10000)).not.toThrow();
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('still tracks with an in-memory id when storage is unavailable', async () => {
      const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
      storage.getItem.mockRejectedValue(new Error('storage unavailable'));
      storage.setItem.mockRejectedValue(new Error('storage unavailable'));
      try {
        await expect(trackImpact({ event_type: 'poi_view', poi_id: 'poi-1' })).resolves.toBeUndefined();
        await flushImpactEvents();
        expect(postedEvents()).toEqual([
          expect.objectContaining({ poi_id: 'poi-1', session_id: expect.any(String) }),
        ]);
      } finally {
        storage.getItem.mockReset();
        storage.setItem.mockReset();
        storage.getItem.mockImplementation((key: string) =>
          Promise.resolve(Object.prototype.hasOwnProperty.call(mockStorage, key) ? mockStorage[key] : null),
        );
        storage.setItem.mockImplementation((key: string, value: string) => {
          mockStorage[key] = value;
          return Promise.resolve();
        });
      }
    });
  });
});
