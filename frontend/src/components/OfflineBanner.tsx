import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import offlineCache from '../services/offlineCache'; // eslint-disable-line import/no-named-as-default

export default function OfflineBanner() {
  const { colors: _colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'online' | 'offline' | 'back-online' | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const prevOnline = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected ?? true;
      if (!isOnline && prevOnline.current) {
        setStatus('offline');
        showBanner();
        offlineCache.getPendingActionCount().then(setPendingCount);
      } else if (isOnline && !prevOnline.current) {
        setStatus('back-online');
        showBanner();
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          hideBanner();
          setTimeout(() => setStatus(null), 300);
        }, 3000);
      }
      prevOnline.current = isOnline;
    });
    return () => { unsub(); if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showBanner = () => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };
  const hideBanner = () => {
    Animated.timing(slideAnim, { toValue: -60, duration: 250, useNativeDriver: true }).start();
  };

  if (!status) return null;

  const isOffline = status === 'offline';
  const bg = isOffline ? '#F59E0B' : '#22C55E';
  const icon = isOffline ? 'cloud-off' : 'cloud-done';
  const text = isOffline
    ? `Modo Offline${pendingCount > 0 ? ` - ${pendingCount} ações pendentes` : ' - dados locais'}`
    : 'De volta online';

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bg, paddingTop: insets.top + 4, transform: [{ translateY: slideAnim }] }]}
      data-testid="offline-banner"
    >
      <MaterialIcons name={icon as any} size={16} color="#FFF" />
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingBottom: 6, gap: 6,
  },
  text: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
