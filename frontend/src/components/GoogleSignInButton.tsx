/**
 * Google Sign-In Button
 * Uses Google One Tap on web, Google Sign-In on native
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_BASE } from '../config/api';

interface GoogleSignInButtonProps {
  onSuccess: (data: { user: any; session_token: string }) => void;
  onError?: (error: string) => void;
  style?: any;
}

export default function GoogleSignInButton({ onSuccess, onError, style }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string>('');

  useEffect(() => {
    // Fetch Google Client ID from backend
    fetch(`${API_BASE}/auth/google/client-id`)
      .then(res => res.json())
      .then(data => {
        if (data.client_id) {
          setClientId(data.client_id);
          if (Platform.OS === 'web') {
            loadGoogleScript(data.client_id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadGoogleScript = (cid: string) => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('google-signin-script')) return;

    const script = document.createElement('script');
    script.id = 'google-signin-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).google?.accounts) {
        (window as any).google.accounts.id.initialize({
          client_id: cid,
          callback: handleGoogleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      }
    };
    document.head.appendChild(script);
  };

  const handleGoogleCallback = async (response: any) => {
    if (!response.credential) {
      onError?.('Google sign-in cancelado');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro no login com Google');
      }

      const data = await res.json();
      onSuccess(data);
    } catch (err: any) {
      onError?.(err.message || 'Erro no login com Google');
    } finally {
      setLoading(false);
    }
  };

  const handlePress = async () => {
    if (Platform.OS === 'web') {
      // Trigger Google One Tap or popup
      if ((window as any).google?.accounts) {
        (window as any).google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to popup
            (window as any).google.accounts.id.renderButton(
              document.createElement('div'),
              { theme: 'filled_black', size: 'large' }
            );
            // Use popup flow
            (window as any).google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: 'email profile',
              callback: async (tokenResponse: any) => {
                if (tokenResponse.access_token) {
                  setLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/auth/google`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ access_token: tokenResponse.access_token }),
                      credentials: 'include',
                    });
                    if (!res.ok) throw new Error('Login failed');
                    const data = await res.json();
                    onSuccess(data);
                  } catch (err: any) {
                    onError?.(err.message);
                  } finally {
                    setLoading(false);
                  }
                }
              },
            }).requestAccessToken();
          }
        });
      } else {
        onError?.('Google Sign-In não disponível');
      }
    } else {
      // Native: use expo-auth-session or expo-web-browser
      onError?.('Google Sign-In nativo requer build de desenvolvimento');
    }
  };

  if (!clientId) return null;

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FAF8F3" />
      ) : (
        <>
          <View style={styles.googleIcon}>
            <Text style={styles.googleG}>G</Text>
          </View>
          <Text style={styles.buttonText}>Entrar com Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  buttonText: {
    color: '#1C1F1C',
    fontSize: 15,
    fontWeight: '600',
  },
});
