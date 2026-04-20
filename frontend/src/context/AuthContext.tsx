import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { exchangeSession, getCurrentUser, logout as apiLogout, getSubscriptionStatus } from '../services/api';
import { User } from '../types';
import { eventBus } from '../services/eventBus';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionToken: string | null;
  premiumTier: string;
  isPremium: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const AUTH_URL = 'https://auth.emergentagent.com';
const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === 'true' || process.env.NODE_ENV === 'development';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [premiumTier, setPremiumTier] = useState<string>('free');

  const processSessionId = useCallback(async (url: string) => {
    try {
      // Extract session_id from URL (hash or query)
      let sessionId: string | null = null;
      
      if (url.includes('#session_id=')) {
        sessionId = url.split('#session_id=')[1]?.split('&')[0];
      } else if (url.includes('?session_id=')) {
        sessionId = url.split('?session_id=')[1]?.split('&')[0];
      }

      if (sessionId) {
        setIsLoading(true);
        const userData = await exchangeSession(sessionId);
        setUser(userData);

        // Store token
        const token = (userData as any).session_token || sessionId;
        setSessionToken(token);
        await AsyncStorage.setItem('session_token', token);
        const uid = (userData as any).id || (userData as any).user_id;
        if (uid) await AsyncStorage.setItem('user_id', uid);
        eventBus.emit('user.login', { userId: uid });
      }
    } catch (error) {
      console.error('Error processing session:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('session_token');
        if (storedToken) {
          setSessionToken(storedToken);
          const userData = await getCurrentUser(storedToken);
          setUser(userData);
          const uid = (userData as any).id || (userData as any).user_id;
          if (uid) await AsyncStorage.setItem('user_id', uid);
        }
      } catch (_error) {
        // Session expired or invalid - clear stored token
        await AsyncStorage.removeItem('session_token');
      } finally {
        setIsLoading(false);
      }
    };

    // Check initial URL for session_id (cold start)
    const checkInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && (initialUrl.includes('session_id=') || initialUrl.includes('#session_id='))) {
        await processSessionId(initialUrl);
      } else {
        await checkExistingSession();
      }
    };

    // Web platform: check hash
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        processSessionId(window.location.href);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        checkExistingSession();
      }
    } else {
      checkInitialUrl();
    }

    // Listen for deep links (hot links)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('session_id=')) {
        processSessionId(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [processSessionId]);

  const login = async () => {
    try {
      setIsLoading(true);
      
      // Platform-specific redirect URL
      const redirectUrl = Platform.OS === 'web'
        ? `${BACKEND_URL}/`
        : Linking.createURL('/');

      const authUrl = `${AUTH_URL}/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          await processSessionId(result.url);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (_error) {
      // Logout API error is non-critical - proceed with local cleanup
    }
    setUser(null);
    setSessionToken(null);
    await AsyncStorage.removeItem('session_token');
    await AsyncStorage.removeItem('user_id');
    eventBus.emit('user.logout');
  };

  const refreshSubscription = async () => {
    if (user && (user as any).id) {
      try {
        const status = await getSubscriptionStatus((user as any).id);
        setPremiumTier(status.tier || 'free');
      } catch (_error) {
        setPremiumTier('free');
      }
    }
  };

  const refreshUser = async () => {
    if (sessionToken) {
      try {
        const userData = await getCurrentUser(sessionToken);
        setUser(userData);
        // Also refresh subscription status
        if ((userData as any)?.id) {
          try {
            const status = await getSubscriptionStatus((userData as any).id);
            setPremiumTier(status.tier || 'free');
          } catch (_e) { /* ignore */ }
        }
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        sessionToken,
        premiumTier,
        isPremium: DEV_MODE || premiumTier === 'premium' || premiumTier === 'annual' || premiumTier === 'dev',
        login,
        logout,
        refreshUser,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
