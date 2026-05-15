/**
 * CookieBanner — informative consent strip shown to first-time visitors.
 *
 * The Portugal Vivo backend issues exactly one cookie: ``session_token``,
 * which is strictly necessary for authentication and therefore exempt
 * from the ePrivacy / RGPD opt-in requirement. There is no analytics
 * cookie, no advertising cookie, no third-party tracker. The banner is
 * therefore *informative* rather than *blocking*: it tells the user what
 * we use, links to the Privacy Policy, and dismisses on acknowledgement.
 *
 * Consent is persisted to AsyncStorage so the strip stays gone after the
 * first dismissal. If the user clears storage or visits from a fresh
 * device it appears again — that is intentional, it is the same trade-off
 * as every other consent banner on the web.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const STORAGE_KEY = 'pv:cookie-consent:v1';

export default function CookieBanner() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Defer the check off the render cycle so the banner never blocks
    // first paint. If AsyncStorage reads fail (corruption, quota), we
    // err on the side of showing the banner — better duplicate than
    // never-shown.
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) setVisible(true);
      })
      .catch(() => setVisible(true));
  }, []);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Silent — the worst case is the banner reappears next session.
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.wrapper} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <MaterialIcons name="cookie" size={22} color="#C49A6C" style={styles.icon} />
        <View style={styles.copy}>
          <Text style={styles.title}>Cookies estritamente necessários</Text>
          <Text style={styles.body}>
            Usamos apenas um cookie de sessão para o manter ligado. Não temos cookies de
            publicidade nem de tracking.{' '}
            <Text
              style={styles.link}
              onPress={() => router.push('/privacy' as any)}
              accessibilityRole="link"
            >
              Saber mais
            </Text>
            .
          </Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Aceitar e fechar aviso de cookies"
        >
          <Text style={styles.buttonText}>Aceitar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: 'rgba(26, 15, 10, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 154, 108, 0.4)',
    zIndex: 10000,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 1024,
    alignSelf: 'center',
    width: '100%',
  },
  icon: { marginRight: 4 },
  copy: { flex: 1 },
  title: {
    color: '#FAF8F3',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 17,
  },
  link: {
    color: '#C49A6C',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#C49A6C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#1a0f0a',
    fontWeight: '700',
    fontSize: 13,
  },
});
