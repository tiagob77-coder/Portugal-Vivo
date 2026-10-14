/**
 * Anonymous impact tracking for the municipal dashboard (backend: municipal_api.py).
 *
 * - No user id, no IP, no third parties: events go to POST /impact/events.
 * - The visitor id is a random value that rotates every calendar month, so
 *   "unique visitors per month" is meaningful but months cannot be linked.
 * - Events are queued and flushed in batches (max 50) every FLUSH_MS or when
 *   the queue reaches BATCH_SIZE. Failures are dropped silently — tracking
 *   must never break the UI.
 * - Users can opt out in Definições → Privacidade (setImpactTrackingEnabled).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Localization from 'expo-localization';
import api from './api/client';

export type ImpactEventType =
  | 'poi_view'
  | 'audio_play'
  | 'audio_complete'
  | 'route_view'
  | 'route_start'
  | 'directions'
  | 'share'
  | 'favorite'
  | 'qr_scan'
  | 'profile_view';

export interface ImpactEventInput {
  event_type: ImpactEventType;
  poi_id?: string;
  route_id?: string;
  /** Municipality slug or name — only for profile_view / qr_scan without a POI */
  municipality?: string;
  /** qr | share_link | map | feed | search … */
  source?: string;
}

interface QueuedEvent extends ImpactEventInput {
  session_id: string;
  platform: 'ios' | 'android' | 'web';
  locale?: string;
}

export const IMPACT_OPT_OUT_KEY = 'pv_impact_optout';
const SESSION_KEY = 'pv_impact_visitor';
const BATCH_SIZE = 20;
const MAX_BATCH = 50;
const FLUSH_MS = 10000;

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cachedSession: { id: string; month: string } | null = null;
let optedOut: boolean | null = null;

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function randomId(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

async function getVisitorId(): Promise<string> {
  const month = currentMonth();
  if (cachedSession?.month === month) return cachedSession.id;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (stored?.month === month && typeof stored.id === 'string') {
      cachedSession = stored;
      return stored.id;
    }
  } catch {
    // corrupted / unavailable storage → new id below
  }
  cachedSession = { id: randomId(), month };
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(cachedSession));
  } catch {
    // keep the in-memory id for this run
  }
  return cachedSession.id;
}

function deviceLocale(): string | undefined {
  try {
    return Localization.getLocales()[0]?.languageTag || undefined;
  } catch {
    return undefined;
  }
}

function platform(): 'ios' | 'android' | 'web' {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
}

export async function isImpactTrackingEnabled(): Promise<boolean> {
  if (optedOut === null) {
    try {
      optedOut = (await AsyncStorage.getItem(IMPACT_OPT_OUT_KEY)) === '1';
    } catch {
      optedOut = false;
    }
  }
  return !optedOut;
}

export async function setImpactTrackingEnabled(enabled: boolean): Promise<void> {
  optedOut = !enabled;
  if (!enabled) queue = [];
  try {
    if (enabled) await AsyncStorage.removeItem(IMPACT_OPT_OUT_KEY);
    else await AsyncStorage.setItem(IMPACT_OPT_OUT_KEY, '1');
  } catch {
    // preference stays in memory for this run
  }
}

export async function flushImpactEvents(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (queue.length) {
    const batch = queue.splice(0, MAX_BATCH);
    try {
      await api.post('/impact/events', { events: batch });
    } catch {
      // offline or server error: drop the batch (anonymous stats, best effort)
    }
  }
}

function scheduleFlush(): void {
  if (queue.length >= BATCH_SIZE) {
    void flushImpactEvents();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushImpactEvents();
    }, FLUSH_MS);
  }
}

/** Queue an anonymous impact event. Never throws. */
export async function trackImpact(event: ImpactEventInput): Promise<void> {
  try {
    if (!(await isImpactTrackingEnabled())) return;
    if (!event.poi_id && !event.route_id && !event.municipality) return;
    queue.push({
      ...event,
      session_id: await getVisitorId(),
      platform: platform(),
      locale: deviceLocale(),
    });
    scheduleFlush();
  } catch {
    // tracking must never break the UI
  }
}

/** Test helper — resets module state. */
export function __resetImpactTrackingForTests(): void {
  queue = [];
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  cachedSession = null;
  optedOut = null;
}
