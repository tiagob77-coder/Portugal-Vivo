/**
 * Push Notifications Service
 * Handles push notification registration, permissions, and scheduling.
 * Works on both native (Expo) and web (Web Push API).
 * Gracefully degrades in Expo Go (no-ops).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';

const PUSH_TOKEN_KEY = 'push_notification_token';

type NotificationCallback = (notification: any) => void;

class PushNotificationService {
  private pushToken: string | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private receivedListeners: Set<NotificationCallback> = new Set();
  private responseListeners: Set<NotificationCallback> = new Set();

  /**
   * Initialize push notifications - request permissions and get token
   */
  async initialize(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return this.initializeWeb();
    }
    return this.initializeNative();
  }

  private async initializeWeb(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    if (!('Notification' in window)) return null;
    if (!('serviceWorker' in navigator)) return null;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;

      this.swRegistration = await navigator.serviceWorker.ready;

      let subscription = await this.swRegistration.pushManager.getSubscription();

      if (!subscription) {
        // Use a generated token for web push identification
        this.pushToken = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      } else {
        this.pushToken = JSON.stringify(subscription.toJSON());
      }

      await AsyncStorage.setItem(PUSH_TOKEN_KEY, this.pushToken);

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_RECEIVED') {
          this.receivedListeners.forEach(cb => cb(event.data.notification));
        }
      });

      return this.pushToken;
    } catch (error) {
      console.warn('Web push init failed:', error);
      return null;
    }
  }

  private async initializeNative(): Promise<string | null> {
    try {
      const Notifications = require('expo-notifications');
      const Device = require('expo-device');

      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return null;

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      const tokenData = await Notifications.getExpoPushTokenAsync();
      this.pushToken = tokenData.data;
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, this.pushToken);

      return this.pushToken;
    } catch (_error) {
      console.log('Push notifications not available in this environment');
      return null;
    }
  }

  /**
   * Register push token with backend
   */
  async registerTokenWithBackend(): Promise<boolean> {
    if (!this.pushToken) return false;

    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (!sessionToken) return false;

      const response = await fetch(`${API_BASE}/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          token: this.pushToken,
          platform: Platform.OS,
        }),
      });

      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  addNotificationReceivedListener(callback: NotificationCallback): () => void {
    this.receivedListeners.add(callback);
    return () => this.receivedListeners.delete(callback);
  }

  addNotificationResponseListener(callback: NotificationCallback): () => void {
    this.responseListeners.add(callback);
    return () => this.responseListeners.delete(callback);
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    triggerSeconds?: number
  ): Promise<string> {
    if (Platform.OS === 'web') {
      return this.scheduleWebNotification(title, body, data, triggerSeconds);
    }

    try {
      const Notifications = require('expo-notifications');
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, data, sound: 'default' },
        trigger: triggerSeconds ? { seconds: triggerSeconds } : null,
      });
      return id;
    } catch (_e) {
      return '';
    }
  }

  private async scheduleWebNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    triggerSeconds?: number
  ): Promise<string> {
    if (typeof window === 'undefined' || !('Notification' in window)) return '';
    if (Notification.permission !== 'granted') return '';

    const showNotif = () => {
      if (this.swRegistration) {
        this.swRegistration.showNotification(title, {
          body,
          icon: '/assets/images/icon-192.png',
          badge: '/assets/images/favicon.png',
          data: data || {},
          tag: `local-${Date.now()}`,
        } as NotificationOptions);
      } else {
        new Notification(title, { body, icon: '/assets/images/icon-192.png' });
      }
    };

    if (triggerSeconds) {
      setTimeout(showNotif, triggerSeconds * 1000);
    } else {
      showNotif();
    }

    return `web-notif-${Date.now()}`;
  }

  /**
   * Schedule POI do Dia notification
   */
  async schedulePoiDoDia(poiName: string, poiId: string, region: string): Promise<string> {
    return this.scheduleLocalNotification(
      `Descoberta do Dia: ${poiName}`,
      `Descobre este local em ${region}!`,
      { type: 'poi_do_dia', poiId },
    );
  }

  /**
   * Schedule nearby event notification
   */
  async scheduleNearbyEvent(eventName: string, eventId: string, distance: string): Promise<string> {
    return this.scheduleLocalNotification(
      `Evento perto de ti`,
      `${eventName} a ${distance}`,
      { type: 'event_nearby', eventId },
    );
  }

  /**
   * Schedule streak reminder
   */
  async scheduleStreakReminder(currentStreak: number): Promise<string> {
    return this.scheduleLocalNotification(
      `Mantém a tua streak!`,
      `Tens ${currentStreak} dias consecutivos. Visita um local hoje para continuar!`,
      { type: 'streak_reminder' },
      18 * 60 * 60,
    );
  }

  async scheduleSurfAlert(): Promise<string> {
    return '';
  }

  async scheduleGeofenceNotification(): Promise<string> {
    return '';
  }

  async cancelAllNotifications(): Promise<void> {
    if (Platform.OS !== 'web') {
      try {
        const Notifications = require('expo-notifications');
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch (_e) { /* ignore */ }
    }
  }

  async getPushToken(): Promise<string | null> {
    if (this.pushToken) return this.pushToken;
    return AsyncStorage.getItem(PUSH_TOKEN_KEY);
  }

  async getDeliveredNotifications(): Promise<any[]> {
    return [];
  }

  async dismissAllNotifications(): Promise<void> {
    if (Platform.OS !== 'web') {
      try {
        const Notifications = require('expo-notifications');
        await Notifications.dismissAllNotificationsAsync();
      } catch (_e) { /* ignore */ }
    }
  }

  async getBadgeCount(): Promise<number> {
    if (Platform.OS !== 'web') {
      try {
        const Notifications = require('expo-notifications');
        return await Notifications.getBadgeCountAsync();
      } catch (_e) { return 0; }
    }
    return 0;
  }

  async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS !== 'web') {
      try {
        const Notifications = require('expo-notifications');
        await Notifications.setBadgeCountAsync(count);
      } catch (_e) { /* ignore */ }
    }
  }

  cleanup(): void {
    this.receivedListeners.clear();
    this.responseListeners.clear();
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
