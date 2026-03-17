/**
 * Geofencing Service - Cross-platform proximity monitoring
 * Web: Uses browser Geolocation API + Web Notifications
 * Native: Uses expo-location watchPositionAsync
 * Both: Calls backend proximity API for POI detection
 */
import { Platform } from 'react-native';

import { API_URL as API_BASE } from '../config/api';

let ExpoLocation: any = null;
if (Platform.OS !== 'web') {
  try {
    ExpoLocation = require('expo-location'); // eslint-disable-line @typescript-eslint/no-require-imports
  } catch {}
}
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min per POI
const POSITION_CHECK_MS = 15000; // Check every 15s

export interface ProximityAlert {
  poi_id: string;
  poi_name: string;
  category: string;
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
  region: string;
  iq_score: number | null;
  distance_km: number;
  distance_m: number;
  image_url?: string;
  description?: string;
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
      const res = await fetch(`${API_BASE}/api/proximity/alerts?lat=${lat}&lng=${lng}`);
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
        this.showBrowserNotifications(newAlerts);
        this.onAlertCallback?.(newAlerts);
      }
    } catch {}
  }

  private async fetchNearby(lat: number, lng: number) {
    try {
      const res = await fetch(
        `${API_BASE}/api/proximity/nearby?lat=${lat}&lng=${lng}&radius_km=3&limit=10`
      );
      if (!res.ok) return;
      const data = await res.json();
      this.nearbyPois = data.pois || [];
      this.onNearbyCallback?.(this.nearbyPois, data.total || 0);
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
