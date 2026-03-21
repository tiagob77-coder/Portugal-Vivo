import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import ProximityMonitor from '../../src/components/ProximityMonitor';
import ErrorBoundary from '../../src/components/ErrorBoundary';

// Load Cormorant Garamond globally on web + PWA setup
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const existing = document.querySelector('link[href*="Cormorant+Garamond"]');
  if (!existing) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
  // PWA Manifest
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/manifest.json';
    document.head.appendChild(manifest);
    // Theme color meta tag
    const theme = document.createElement('meta');
    theme.name = 'theme-color';
    theme.content = '#2E5E4E';
    document.head.appendChild(theme);
    // Apple touch icon
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = '/assets/images/icon.png';
    document.head.appendChild(appleIcon);
    // Apple mobile web app capable
    const appleMeta = document.createElement('meta');
    appleMeta.name = 'apple-mobile-web-app-capable';
    appleMeta.content = 'yes';
    document.head.appendChild(appleMeta);
  }
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  // Inject tab fade transition CSS
  const styleExists = document.querySelector('style[data-tab-transition]');
  if (!styleExists) {
    const style = document.createElement('style');
    style.setAttribute('data-tab-transition', 'true');
    style.textContent = `
      [data-testid="tab-content-wrapper"] > div {
        animation: tabFadeIn 200ms ease-out;
      }
      @keyframes tabFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} data-testid="tab-content-wrapper">
      <ProximityMonitor />
      <ErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom || 8,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 2,
          },
          ...(Platform.OS !== 'web' ? { animation: 'fade' } : {}),
        }}
      >
        {/* ── 4 visible tabs ── */}
        <Tabs.Screen
          name="descobrir"
          options={{
            title: 'Descobrir',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="auto-awesome" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="mapa"
          options={{
            title: 'Explorar',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="explore" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="experienciar"
          options={{
            title: 'Viver',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="local-activity" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Eu',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="person" size={22} color={color} />
            ),
          }}
        />

        {/* ── Hidden — not ready yet, accessible via deep links ── */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="planeador" options={{ href: null }} />
        <Tabs.Screen name="eventos" options={{ href: null }} />
        <Tabs.Screen name="community" options={{ href: null }} />
        <Tabs.Screen name="coleccoes" options={{ href: null }} />
        <Tabs.Screen name="beachcams" options={{ href: null }} />
        <Tabs.Screen name="transportes" options={{ href: null }} />
        <Tabs.Screen name="routes" options={{ href: null }} />
        <Tabs.Screen name="map" options={{ href: null }} />
      </Tabs>
      </ErrorBoundary>
    </View>
  );
}
