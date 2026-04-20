/**
 * PWA Install Prompt - Shows a banner to install the app on supported browsers
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette } from '../theme/colors';

const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const slideAnim = useState(new Animated.Value(100))[0];

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if user dismissed recently
    const checkDismissed = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
        if (dismissed) {
          const dismissedAt = parseInt(dismissed, 10);
          if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;
        }
      } catch (_e) { /* ignore */ }

      // Listen for beforeinstallprompt
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowPrompt(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      };

      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    };

    checkDismissed();
  }, [slideAnim]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = async () => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowPrompt(false));

    try {
      await AsyncStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (_e) { /* ignore */ }
  };

  if (!showPrompt) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="get-app" size={28} color={palette.gray[50]} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Instalar Portugal Vivo</Text>
          <Text style={styles.subtitle}>Acesso rápido e funciona offline</Text>
        </View>
        <TouchableOpacity style={styles.installButton} onPress={handleInstall}>
          <Text style={styles.installButtonText}>Instalar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
          <MaterialIcons name="close" size={20} color="#8A8A8A" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: palette.forest[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: palette.gray[50],
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  installButton: {
    backgroundColor: palette.terracotta[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  installButtonText: {
    color: palette.gray[800],
    fontSize: 13,
    fontWeight: '700',
  },
  dismissButton: {
    padding: 6,
    marginLeft: 4,
  },
});
