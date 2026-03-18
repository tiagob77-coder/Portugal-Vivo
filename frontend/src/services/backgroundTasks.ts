/**
 * Background Tasks — expo-task-manager + expo-background-fetch
 *
 * Registers a proximity check task that runs every 15 minutes in the
 * background (native only). When the user is within 2 km of a high-value
 * heritage POI they haven't been notified about recently, a local
 * notification is triggered via pushNotificationService.
 *
 * Web: falls back to an in-session interval when the tab is active.
 */
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';
import { pushNotificationService } from './pushNotifications';

export const PROXIMITY_CHECK_TASK = 'PT_VIVO_PROXIMITY_CHECK';
const PROXIMITY_RADIUS_KM = 2.0;
const SESSION_INTERVAL_MS = 10 * 60 * 1000; // 10 min when tab is active (web)

// ─── task definition (must be at module top level) ───────────────────────────

TaskManager.defineTask(PROXIMITY_CHECK_TASK, async () => {
  try {
    // Dynamic import to avoid bundling Location on web
    const Location = require('expo-location'); // eslint-disable-line @typescript-eslint/no-require-imports
    const BackgroundFetch = require('expo-background-fetch'); // eslint-disable-line @typescript-eslint/no-require-imports

    const location = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (!location) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { latitude, longitude } = location.coords;
    const sessionToken = await AsyncStorage.getItem('session_token');
    const userId = await AsyncStorage.getItem('user_id');

    const response = await fetch(`${API_BASE}/notifications/smart/check-nearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        lat: latitude,
        lng: longitude,
        radius_km: PROXIMITY_RADIUS_KM,
        user_id: userId,
      }),
    });

    if (!response.ok) return BackgroundFetch.BackgroundFetchResult.Failed;

    const data: { notifications: Array<{ title: string; body: string; poi_id: string }> } =
      await response.json();

    if (data.notifications?.length > 0) {
      const notif = data.notifications[0];
      await pushNotificationService.scheduleLocalNotification(
        notif.title,
        notif.body,
        { type: 'poi_nearby', poiId: notif.poi_id },
      );
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (_e) {
    try {
      const BackgroundFetch = require('expo-background-fetch'); // eslint-disable-line @typescript-eslint/no-require-imports
      return BackgroundFetch.BackgroundFetchResult.Failed;
    } catch (_ee) {
      return 2; // BackgroundFetchResult.Failed numeric fallback
    }
  }
});

// ─── registration helpers ─────────────────────────────────────────────────────

/** Register native background fetch task (no-op on web). */
export async function registerBackgroundTasks(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const BackgroundFetch = require('expo-background-fetch'); // eslint-disable-line @typescript-eslint/no-require-imports

    const status = await BackgroundFetch.getStatusAsync();
    // BackgroundFetchStatus: 1=Restricted, 2=Denied, 3=Available
    if (status !== 3) return;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(PROXIMITY_CHECK_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(PROXIMITY_CHECK_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (_e) {
    // expo-background-fetch not available (Expo Go)
  }
}

/** Unregister background task (called on logout or notifications disabled). */
export async function unregisterBackgroundTasks(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(PROXIMITY_CHECK_TASK);
    if (isRegistered) {
      const BackgroundFetch = require('expo-background-fetch'); // eslint-disable-line @typescript-eslint/no-require-imports
      await BackgroundFetch.unregisterTaskAsync(PROXIMITY_CHECK_TASK);
    }
  } catch (_e) { /* ignore */ }
}

// ─── web fallback: in-session proximity polling ──────────────────────────────

let webIntervalId: ReturnType<typeof setInterval> | null = null;

async function runWebProximityCheck(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    const sessionToken = await AsyncStorage.getItem('session_token');
    const userId = await AsyncStorage.getItem('user_id');

    try {
      const response = await fetch(`${API_BASE}/notifications/smart/check-nearby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          lat: latitude,
          lng: longitude,
          radius_km: PROXIMITY_RADIUS_KM,
          user_id: userId,
        }),
      });

      if (!response.ok) return;

      const data: { notifications: Array<{ title: string; body: string; poi_id: string }> } =
        await response.json();

      if (data.notifications?.length > 0) {
        const notif = data.notifications[0];
        await pushNotificationService.scheduleLocalNotification(
          notif.title,
          notif.body,
          { type: 'poi_nearby', poiId: notif.poi_id },
        );
      }
    } catch (_e) { /* ignore */ }
  });
}

/** Start in-session proximity polling for web (clears previous interval). */
export function startWebProximityPolling(): void {
  if (Platform.OS !== 'web') return;
  if (webIntervalId) clearInterval(webIntervalId);
  runWebProximityCheck(); // immediate first check
  webIntervalId = setInterval(runWebProximityCheck, SESSION_INTERVAL_MS);
}

/** Stop in-session proximity polling. */
export function stopWebProximityPolling(): void {
  if (webIntervalId) {
    clearInterval(webIntervalId);
    webIntervalId = null;
  }
}
