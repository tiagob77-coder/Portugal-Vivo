/**
 * Geofencing Service - Cross-platform proximity monitoring
 * Web: Uses browser Geolocation API + Web Notifications
 * Native: Uses expo-location watchPositionAsync
 * Both: Calls backend proximity API for POI detection
 */
import { Platform } from 'react-native';

import { API_URL as API_BASE } from '../config/api';
import { loadInterestModules } from '../config/modules';

let ExpoLocation: any = null;
if (Platform.OS !== 'web') {
  try {
    ExpoLocation = require('expo-location'); // eslint-disable-line @typescript-eslint/no-require-imports
  } catch {}
}
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min per POI
const POSITION_CHECK_MS = 15000; // Check every 15s
const MODULE_ALERT_RADIUS_M = 1200; // fire a module-interest alert within this range

export interface ProximityAlert {
  poi_id: string;
  poi_name: string;
  category: string;
  module?: string;
  iq_score: number | null;
  distance_m: number;
  alert_type: string;
  message: string;
  timestamp: number;
}

export interface NearbyPOI {
  id: string;
  name: string;
  category: string;
  module?: string;
  region: string;
  iq_score: number | null;
  distance_km: number;
  distance_m: number;
  image_url?: string;
  description?: string;
}

/**
 * Pure helper: derive module-interest alerts from nearby POIs. A POI fires an
 * alert when its `module` is in the user's interest set, it is within
 * `radiusM`, and it is past the per-POI cooldown. Exported for testing.
 */
export function buildModuleAlerts(
  pois: NearbyPOI[],
  enabledModules: string[],
  radiusM: number,
  cooldowns: Map<string, number>,
  cooldownMs: number,
  now: number,
): ProximityAlert[] {
  if (!enabledModules.length) return [];
  const wanted = new Set(enabledModules);
  const out: ProximityAlert[] = [];
  for (const poi of pois) {
    if (!poi.module || !wanted.has(poi.module)) continue;
    if (poi.distance_m > radiusM) continue;
    const last = cooldowns.get(poi.id) || 0;
    if (now - last <= cooldownMs) continue;
    out.push({
      poi_id: poi.id,
      poi_name: poi.name,
      category: poi.category,
      module: poi.module,
      iq_score: poi.iq_score ?? null,
      distance_m: poi.distance_m,
      alert_type: 'module',
      message: `${poi.name} a ${poi.distance_m} m`,
      timestamp: now,
    });
  }
  return out;
}

interface NearbyResult {
  pois: NearbyPOI[];
  total: number;
}

type AlertCallback = (alerts: ProximityAlert[]) => void;
type LocationCallback = (lat: number, lng: number) => void;
type NearbyCallback = (pois: NearbyPOI[], total: number) => void;

class GeofenceService {
  private watchId: number | null = null;
  private nativeSubscription: any = null;
  private alertCooldowns: Map<string, number> = new Map();
  private onAlertCallback: AlertCallback | null = null;
  private onLocationCallback: LocationCallback | null = null;
  private onNearbyCallback: NearbyCallback | null = null;
  private isActive = false;
  private lastLat = 0;
  private lastLng = 0;
  private notificationPermission: NotificationPermission | 'unsupported' = 'unsupported';
  private alertHistory: ProximityAlert[] = [];
  private nearbyPois: NearbyPOI[] = [];
  private enabledModules: string[] = [];

  /** Update the user's interest modules live (e.g. from settings). */
  setEnabledModules(modules: string[]) {
    this.enabledModules = Array.isArray(modules) ? modules.filter(Boolean) : [];
  }

  getEnabledModules(): string[] {
    return this.enabledModules;
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (!('Notification' in window)) {
        this.notificationPermission = 'unsupported';
        return false;
      }
      const perm = await Notification.requestPermission();
      this.notificationPermission = perm;
      return perm === 'granted';
    }
    // Native: location permission is enough for in-app alerts
    return true;
  }

  async start(callbacks?: {
    onAlert?: AlertCallback;
    onLocation?: LocationCallback;
    onNearby?: NearbyCallback;
  }) {
    if (this.isActive) return;
    this.onAlertCallback = callbacks?.onAlert || null;
    this.onLocationCallback = callbacks?.onLocation || null;
    this.onNearbyCallback = callbacks?.onNearby || null;
    this.enabledModules = await loadInterestModules();
    this.isActive = true;

    if (Platform.OS === 'web') {
      await this.requestNotificationPermission();
      this.startWebWatch();
    } else {
      await this.startNativeWatch();
    }
  }

  stop() {
    this.isActive = false;
    if (Platform.OS === 'web') {
      if (this.watchId !== null) {
        navigator.geolocation?.clearWatch(this.watchId);
        this.watchId = null;
      }
    } else if (this.nativeSubscription) {
      this.nativeSubscription.remove();
      this.nativeSubscription = null;
    }
  }

  private async startNativeWatch() {
    if (!ExpoLocation) return;
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      this.nativeSubscription = await ExpoLocation.watchPositionAsync(
        {
          accuracy: ExpoLocation.Accuracy.Balanced,
          timeInterval: POSITION_CHECK_MS,
          distanceInterval: 50,
        },
        (location: any) => {
          this.handlePosition(location.coords.latitude, location.coords.longitude);
        },
      );
    } catch {}
  }

  private startWebWatch() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => this.handlePosition(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true },
    );

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: POSITION_CHECK_MS, timeout: 20000 },
    );
  }

  private async handlePosition(lat: number, lng: number) {
    if (!this.isActive) return;
    this.lastLat = lat;
    this.lastLng = lng;
    this.onLocationCallback?.(lat, lng);
    await Promise.all([
      this.checkAlerts(lat, lng),
      this.fetchNearby(lat, lng),
    ]);
  }

  private async checkAlerts(lat: number, lng: number) {
    try {
      const modulesParam = this.enabledModules.length
        ? `&modules=${encodeURIComponent(this.enabledModules.join(','))}`
        : '';
      const res = await fetch(
        `${API_BASE}/api/proximity/alerts?lat=${lat}&lng=${lng}${modulesParam}`,
      );
      if (!res.ok) return;
      const data = await res.json();

      const now = Date.now();
      const newAlerts: ProximityAlert[] = [];

      for (const alert of data.alerts || []) {
        const lastTime = this.alertCooldowns.get(alert.poi_id) || 0;
        if (now - lastTime > ALERT_COOLDOWN_MS) {
          const fullAlert: ProximityAlert = { ...alert, timestamp: now };
          newAlerts.push(fullAlert);
          this.alertCooldowns.set(alert.poi_id, now);
          this.alertHistory.unshift(fullAlert);
        }
      }

      // Keep history manageable
      if (this.alertHistory.length > 50) {
        this.alertHistory = this.alertHistory.slice(0, 50);
      }

      if (newAlerts.length > 0) {
        this.dispatchNotifications(newAlerts);
        this.onAlertCallback?.(newAlerts);
      }
    } catch {}
  }

  private async fetchNearby(lat: number, lng: number) {
    try {
      const res = await fetch(
        `${API_BASE}/api/proximity/nearby?lat=${lat}&lng=${lng}&radius_km=3&limit=25`
      );
      if (!res.ok) return;
      const data = await res.json();
      this.nearbyPois = data.pois || [];
      this.onNearbyCallback?.(this.nearbyPois, data.total || 0);
      this.emitModuleAlerts();
    } catch {}
  }

  /** Generate and dispatch alerts for POIs in the user's interest modules. */
  private emitModuleAlerts() {
    const now = Date.now();
    const moduleAlerts = buildModuleAlerts(
      this.nearbyPois,
      this.enabledModules,
      MODULE_ALERT_RADIUS_M,
      this.alertCooldowns,
      ALERT_COOLDOWN_MS,
      now,
    );
    if (moduleAlerts.length === 0) return;

    for (const alert of moduleAlerts) {
      this.alertCooldowns.set(alert.poi_id, now);
      this.alertHistory.unshift(alert);
    }
    if (this.alertHistory.length > 50) {
      this.alertHistory = this.alertHistory.slice(0, 50);
    }
    this.dispatchNotifications(moduleAlerts);
    this.onAlertCallback?.(moduleAlerts);
  }

  /** Route notifications to the right channel per platform (mobile-first). */
  private dispatchNotifications(alerts: ProximityAlert[]) {
    if (Platform.OS === 'web') {
      this.showBrowserNotifications(alerts);
      return;
    }
    // Native: schedule local notifications via expo-notifications (degrades to
    // no-op in Expo Go). Lazy require avoids load-time coupling in tests.
    try {
      const { pushNotificationService } = require('./pushNotifications'); // eslint-disable-line @typescript-eslint/no-require-imports
      for (const alert of alerts.slice(0, 3)) {
        pushNotificationService.scheduleLocalNotification(
          alert.poi_name,
          alert.message,
          { type: 'geofence_nearby', poiId: alert.poi_id },
        );
      }
    } catch {}
  }

  private showBrowserNotifications(alerts: ProximityAlert[]) {
    if (this.notificationPermission !== 'granted') return;

    for (const alert of alerts.slice(0, 3)) {
      const icon = alert.alert_type === 'rare' ? '\uD83C\uDF1F' : '\uD83D\uDCCD';
      try {
        new Notification(`${icon} ${alert.poi_name}`, {
          body: alert.message,
          tag: `poi-${alert.poi_id}`,
          icon: '/favicon.ico',
          silent: false,
        });
      } catch {}
    }
  }

  async getNearby(lat: number, lng: number, radiusKm = 5, minIq = 0): Promise<NearbyResult> {
    try {
      const res = await fetch(
        `${API_BASE}/api/proximity/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}&min_iq=${minIq}`
      );
      if (!res.ok) return { pois: [], total: 0 };
      return await res.json();
    } catch {
      return { pois: [], total: 0 };
    }
  }

  getAlertHistory(): ProximityAlert[] {
    return this.alertHistory;
  }

  getNearbyPois(): NearbyPOI[] {
    return this.nearbyPois;
  }

  getLastPosition() {
    return { lat: this.lastLat, lng: this.lastLng };
  }

  isRunning() {
    return this.isActive;
  }

  hasNotificationPermission(): boolean {
    return this.notificationPermission === 'granted';
  }

  clearHistory() {
    this.alertHistory = [];
    this.alertCooldowns.clear();
  }
}

export const geofenceService = new GeofenceService();
export default geofenceService;
