/**
 * Background Tasks — Native-only background fetch with web fallback
 *
 * Native: Uses expo-task-manager + expo-background-fetch for proximity checks
 * Web: Uses in-session interval polling when the tab is active
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';
import { pushNotificationService } from './pushNotifications';

export const PROXIMITY_CHECK_TASK = 'PT_VIVO_PROXIMITY_CHECK';
const PROXIMITY_RADIUS_KM = 2.0;
const SESSION_INTERVAL_MS = 10 * 60 * 1000; // 10 min when tab is active (web)

// ─── registration helpers ─────────────────────────────────────────────────────

/** Register native background fetch task (no-op on web). */
export async function registerBackgroundTasks(): Promise<void> {
  if (Platform.OS === 'web') return;
  // Native implementation - defer to native build
  console.log('[BackgroundTasks] Native background tasks not available in web build');
}

/** Unregister background task (called on logout or notifications disabled). */
export async function unregisterBackgroundTasks(): Promise<void> {
  if (Platform.OS === 'web') return;
  // Native implementation - defer to native build
  console.log('[BackgroundTasks] Native background tasks not available in web build');
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
