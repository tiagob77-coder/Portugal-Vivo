/**
 * Painel Municipal — Layout com sidebar (web) / bottom tabs (mobile)
 * Guarda autenticação e verifica role de tenant.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, usePathname, Slot, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

// ─── Navegação ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { route: '/municipio',          label: 'Dashboard',    icon: 'dashboard' },
  { route: '/municipio/pois',     label: 'POIs',         icon: 'place' },
  { route: '/municipio/importar', label: 'Importar',     icon: 'upload-file' },
  { route: '/municipio/eventos',  label: 'Eventos',      icon: 'event' },
  { route: '/municipio/utilizadores', label: 'Equipa',   icon: 'group' },
] as const;

const SIDEBAR_W = 220;
const ACCENT    = '#2E5E4E';
const SIDEBAR_BG = '#1E293B';
const SIDEBAR_TEXT = '#CBD5E1';
const SIDEBAR_HOVER = 'rgba(255,255,255,0.07)';

// ─── Sidebar (web) ────────────────────────────────────────────────────────────

function Sidebar({ municipioName }: { municipioName: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (route: string) =>
    route === '/municipio' ? pathname === '/municipio' : pathname.startsWith(route);

  return (
    <View style={sb.container}>
      {/* Logo */}
      <View style={sb.logoRow}>
        <View style={sb.logoIcon}>
          <MaterialIcons name="location-city" size={20} color="#fff" />
        </View>
        <View>
          <Text style={sb.logoTitle}>Portugal Vivo</Text>
          <Text style={sb.logoSub} numberOfLines={1}>{municipioName}</Text>
        </View>
      </View>

      {/* Nav */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.route}
              style={[sb.navItem, active && sb.navItemActive]}
              onPress={() => router.push(item.route as any)}
            >
              <MaterialIcons
                name={item.icon as any}
                size={18}
                color={active ? '#fff' : SIDEBAR_TEXT}
              />
              <Text style={[sb.navLabel, active && sb.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Rodapé */}
      <TouchableOpacity style={sb.logoutBtn} onPress={logout}>
        <MaterialIcons name="logout" size={16} color={SIDEBAR_TEXT} />
        <Text style={sb.logoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Bottom nav (mobile) ──────────────────────────────────────────────────────

function BottomNav({ municipioName }: { municipioName: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();

  const isActive = (route: string) =>
    route === '/municipio' ? pathname === '/municipio' : pathname.startsWith(route);

  // Mobile shows only 4 main items
  const mobileItems = NAV_ITEMS.slice(0, 4);

  return (
    <View style={[bn.container, { paddingBottom: insets.bottom + 4 }]}>
      {mobileItems.map(item => {
        const active = isActive(item.route);
        return (
          <TouchableOpacity
            key={item.route}
            style={bn.item}
            onPress={() => router.push(item.route as any)}
          >
            <MaterialIcons
              name={item.icon as any}
              size={22}
              color={active ? ACCENT : '#94A3B8'}
            />
            <Text style={[bn.label, active && bn.labelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Layout principal ─────────────────────────────────────────────────────────

export default function MunicipioLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [municipioName, setMunicipioName] = useState('Município');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login' as any);
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!isAuthenticated) return null;

  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ flex: 1, flexDirection: isWeb ? 'row' : 'column', backgroundColor: '#F8FAFC' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sidebar (web) */}
      {isWeb && <Sidebar municipioName={municipioName} />}

      {/* Conteúdo */}
      <View style={{ flex: 1, paddingTop: isWeb ? 0 : insets.top }}>
        <Slot />
      </View>

      {/* Bottom nav (mobile) */}
      {!isWeb && <BottomNav municipioName={municipioName} />}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const sb = StyleSheet.create({
  container: {
    width: SIDEBAR_W,
    backgroundColor: SIDEBAR_BG,
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 12,
    flexDirection: 'column',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28, paddingHorizontal: 4 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  logoTitle: { fontSize: 13, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.3 },
  logoSub: { fontSize: 10, color: '#64748B', maxWidth: 130 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    marginBottom: 2,
  },
  navItemActive: { backgroundColor: ACCENT },
  navLabel: { fontSize: 13, fontWeight: '600', color: SIDEBAR_TEXT },
  navLabelActive: { color: '#FFFFFF' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 8,
  },
  logoutText: { fontSize: 13, color: SIDEBAR_TEXT },
});

const bn = StyleSheet.create({
  container: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  item: { flex: 1, alignItems: 'center', paddingTop: 10, gap: 3 },
  label: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  labelActive: { color: ACCENT, fontWeight: '700' },
});
