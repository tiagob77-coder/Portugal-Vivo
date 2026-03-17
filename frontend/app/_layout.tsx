import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider } from 'react-i18next';
import { View, ActivityIndicator, Platform } from 'react-native';
import i18n, { initI18n } from '../src/i18n';
import OfflineBanner from '../src/components/OfflineBanner';
import InstallPrompt from '../src/components/InstallPrompt';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { registerServiceWorker } from '../src/services/pwaRegistration';
import { initMonitoring, captureException } from '../src/utils/monitoring';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

function ThemedStack() {
  const { colors, isDark } = useTheme();
  const _router = useRouter();

  // Register PWA service worker on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      registerServiceWorker().catch(() => {});
    }
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="heritage/[id]" 
          options={{ presentation: 'card', animation: 'slide_from_bottom' }} 
        />
        <Stack.Screen 
          name="route/[id]" 
          options={{ presentation: 'card', animation: 'slide_from_bottom' }} 
        />
        <Stack.Screen 
          name="settings/language" 
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }} 
        />
        <Stack.Screen 
          name="search" 
          options={{ presentation: 'card', animation: 'slide_from_bottom' }} 
        />
        <Stack.Screen
          name="category/[id]"
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="evento/[id]"
          options={{ presentation: 'card', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [isI18nReady, setIsI18nReady] = useState(false);

  useEffect(() => {
    initMonitoring();
    const init = async () => {
      await initI18n();
      setIsI18nReady(true);
    };
    init();
  }, []);

  if (!isI18nReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a0f0a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#C65D3B" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Head>
        <title>Portugal Vivo — Descubra o Património Cultural de Portugal</title>
        <meta name="description" content="Explore mais de 3000 pontos de interesse cultural, termas, praias fluviais, castelos, miradouros e gastronomia em Portugal. Planeie roteiros com IA." />
        <meta property="og:title" content="Portugal Vivo — Património Cultural de Portugal" />
        <meta property="og:description" content="Descubra o melhor de Portugal: heritage, natureza, gastronomia e aventura. Roteiros inteligentes com IA." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://portugal-vivo.app" />
        <meta property="og:image" content="https://portugal-vivo.app/og-image.jpg" />
        <meta property="og:locale" content="pt_PT" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://portugal-vivo.app" />
      </Head>
      <ErrorBoundary onError={(error, info) => captureException(error, { componentStack: info.componentStack })}>
        <I18nextProvider i18n={i18n}>
          <SafeAreaProvider>
            <ThemeProvider>
              <QueryClientProvider client={queryClient}>
                <AuthProvider>
                  <ThemedStack />
                  <OfflineBanner />
                  {Platform.OS === 'web' && <InstallPrompt />}
                </AuthProvider>
              </QueryClientProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </I18nextProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
