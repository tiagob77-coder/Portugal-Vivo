/**
 * Painel Municipal — Layout com sidebar (web) / bottom tabs (mobile)
 * Guarda autenticação e verifica o acesso municipal (GET /municipal/me/subscription):
 *   401 → /auth · 403 → organização parceira aprovada (museu, associação) abre o
 *   painel em modo parceiro (Dashboard + POIs), senão estado "Sem acesso" ·
 *   outros erros → tentar novamente.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, ScrollView, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { useRouter, usePathname, Slot, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api/client';
import {
  getMySubscription,
  getMyProfile,
  getApiErrorStatus,
  getApiErrorMessage,
  prettifyMunicipalitySlug,
  SUBSCRIPTION_STATUS_LABELS,
  type MySubscriptionResponse,
} from '../../src/services/api/municipal';

// ─── Navegação ────────────────────────────────────────────────────────────────

interface NavItem {
  route: string;
  label: string;
  icon: string;
  /** Shown directly in the mobile bottom bar; the rest go under "Mais". */
  mobile?: boolean;
  /** Needs a municipal tenant role (hidden for partner organisations). */
  municipalOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { route: '/municipio',              label: 'Dashboard',      icon: 'dashboard',   mobile: true },
  { route: '/municipio/impacto',      label: 'Impacto',        icon: 'insights',    mobile: true, municipalOnly: true },
  { route: '/municipio/pois',         label: 'POIs',           icon: 'place',       mobile: true },
  { route: '/municipio/importar',     label: 'Importar',       icon: 'upload-file', municipalOnly: true },
  { route: '/municipio/eventos',      label: 'Eventos',        icon: 'event', municipalOnly: true },
  { route: '/municipio/perfil',       label: 'Página pública', icon: 'public', municipalOnly: true },
  { route: '/municipio/plano',        label: 'Plano',          icon: 'workspace-premium', mobile: true, municipalOnly: true },
  { route: '/municipio/utilizadores', label: 'Equipa',         icon: 'group', municipalOnly: true },
];

const PARTNER_NAV_ITEMS = NAV_ITEMS.filter(i => !i.municipalOnly);

interface PartnerProfile {
  name?: string;
  approved?: boolean;
}

const SIDEBAR_W = 220;
const ACCENT    = '#2E5E4E';
const SIDEBAR_BG = '#1E293B';
const SIDEBAR_TEXT = '#CBD5E1';

const isActiveRoute = (pathname: string, route: string) =>
  route === '/municipio' ? pathname === '/municipio' : pathname.startsWith(route);

// ─── Sidebar (web) ────────────────────────────────────────────────────────────

function Sidebar({ municipioName, planLabel, items }: { municipioName: string; planLabel: string | null; items: NavItem[] }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

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

      {!!planLabel && (
        <TouchableOpacity style={sb.planChip} onPress={() => router.push('/municipio/plano')}>
          <MaterialIcons name="workspace-premium" size={12} color="#A7F3D0" />
          <Text style={sb.planChipText} numberOfLines={1}>{planLabel}</Text>
        </TouchableOpacity>
      )}

      {/* Nav */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {items.map(item => {
          const active = isActiveRoute(pathname, item.route);
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

function BottomNav({ items }: { items: NavItem[] }) {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);

  const mobileItems = items.filter(i => i.mobile);
  const moreItems = items.filter(i => !i.mobile);
  const moreActive = moreItems.some(i => isActiveRoute(pathname, i.route));

  const go = (route: string) => {
    setMoreOpen(false);
    router.push(route as any);
  };

  return (
    <View style={[bn.container, { paddingBottom: insets.bottom + 4 }]}>
      {mobileItems.map(item => {
        const active = isActiveRoute(pathname, item.route);
        return (
          <TouchableOpacity
            key={item.route}
            style={bn.item}
            onPress={() => go(item.route)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
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
      <TouchableOpacity
        style={bn.item}
        onPress={() => setMoreOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Mais opções"
      >
        <MaterialIcons name="more-horiz" size={22} color={moreActive ? ACCENT : '#94A3B8'} />
        <Text style={[bn.label, moreActive && bn.labelActive]}>Mais</Text>
      </TouchableOpacity>

      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={bn.backdrop} onPress={() => setMoreOpen(false)}>
          <View style={[bn.sheet, { paddingBottom: insets.bottom + 12 }]}>
            {moreItems.map(item => {
              const active = isActiveRoute(pathname, item.route);
              return (
                <TouchableOpacity key={item.route} style={bn.sheetItem} onPress={() => go(item.route)}>
                  <MaterialIcons name={item.icon as any} size={20} color={active ? ACCENT : '#475569'} />
                  <Text style={[bn.sheetLabel, active && { color: ACCENT }]}>{item.label}</Text>
                  <MaterialIcons name="chevron-right" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Estados de acesso ────────────────────────────────────────────────────────

function CenteredSpinner() {
  return (
    <View style={st.center}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={ACCENT} />
    </View>
  );
}

function NoAccessState({ message }: { message?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.center, { paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={st.iconCircle}>
        <MaterialIcons name="lock" size={36} color={ACCENT} />
      </View>
      <Text style={st.title}>Sem acesso ao painel municipal</Text>
      <Text style={st.subtitle}>
        O painel municipal está disponível para equipas de câmaras municipais parceiras do Portugal Vivo.
        Se trabalha num município, peça ao administrador da sua câmara para o adicionar à equipa.
      </Text>
      {!!message && <Text style={st.detail}>{message}</Text>}
      <TouchableOpacity style={st.primaryBtn} onPress={() => router.replace('/(tabs)/profile' as any)}>
        <MaterialIcons name="arrow-back" size={18} color="#fff" />
        <Text style={st.primaryBtnText}>Voltar à app</Text>
      </TouchableOpacity>
    </View>
  );
}

function AccessErrorState({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  return (
    <View style={[st.center, { paddingHorizontal: 24 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <MaterialIcons name="cloud-off" size={44} color="#94A3B8" />
      <Text style={st.title}>Não foi possível verificar o acesso</Text>
      <Text style={st.subtitle}>Verifique a ligação à internet e tente novamente.</Text>
      <TouchableOpacity style={st.primaryBtn} onPress={onRetry}>
        <MaterialIcons name="refresh" size={18} color="#fff" />
        <Text style={st.primaryBtnText}>Tentar novamente</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.linkBtn} onPress={() => router.replace('/(tabs)/profile' as any)}>
        <Text style={st.linkBtnText}>Voltar à app</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Layout principal ─────────────────────────────────────────────────────────

export default function MunicipioLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = user?.user_id ?? null;

  const access = useQuery<MySubscriptionResponse>({
    queryKey: ['municipal-subscription', userId],
    queryFn: getMySubscription,
    enabled: isAuthenticated,
    retry: false,
  });
  const accessStatus = getApiErrorStatus(access.error);

  // Approved partner organisations (museums, associations) are not municipal
  // tenants: /municipal/me/* answers 403, but /partner/* serves their territory.
  const partnerQuery = useQuery<PartnerProfile>({
    queryKey: ['partner-profile', userId],
    queryFn: async () => (await api.get('/partner/profile')).data,
    enabled: isAuthenticated && accessStatus === 403,
    retry: false,
  });
  const partnerMode = accessStatus === 403 && partnerQuery.data?.approved === true;

  const profileQuery = useQuery({
    queryKey: ['municipal-profile', userId],
    queryFn: getMyProfile,
    enabled: isAuthenticated && !!access.data,
    retry: false,
  });

  const mustLogin = (!isLoading && !isAuthenticated) || accessStatus === 401;

  useEffect(() => {
    if (mustLogin) {
      router.replace('/auth');
    }
  }, [mustLogin, router]);

  if (isLoading || mustLogin || (isAuthenticated && access.isLoading)
      || (accessStatus === 403 && partnerQuery.isLoading)) {
    return <CenteredSpinner />;
  }

  const isWeb = Platform.OS === 'web';

  if (partnerMode) {
    return (
      <View style={{ flex: 1, flexDirection: isWeb ? 'row' : 'column', backgroundColor: '#F8FAFC' }}>
        <Stack.Screen options={{ headerShown: false }} />
        {isWeb && (
          <Sidebar municipioName={partnerQuery.data?.name || 'Parceiro'} planLabel="Parceiro" items={PARTNER_NAV_ITEMS} />
        )}
        <View style={{ flex: 1, paddingTop: isWeb ? 0 : insets.top }}>
          <Slot />
        </View>
        {!isWeb && <BottomNav items={PARTNER_NAV_ITEMS} />}
      </View>
    );
  }

  if (accessStatus === 403 || accessStatus === 400) {
    return <NoAccessState message={getApiErrorMessage(access.error, '')} />;
  }

  if (access.error || !access.data) {
    return <AccessErrorState onRetry={() => access.refetch()} />;
  }

  const sub = access.data;
  const municipioName =
    profileQuery.data?.profile?.display_name ||
    prettifyMunicipalitySlug(sub.municipality_id) ||
    'Município';
  const planLabel = sub.plan && sub.subscription
    ? `${sub.plan.name} · ${SUBSCRIPTION_STATUS_LABELS[sub.subscription.status] ?? sub.subscription.status}`
    : 'Sem plano ativo';

  return (
    <View style={{ flex: 1, flexDirection: isWeb ? 'row' : 'column', backgroundColor: '#F8FAFC' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sidebar (web) */}
      {isWeb && <Sidebar municipioName={municipioName} planLabel={planLabel} items={NAV_ITEMS} />}

      {/* Conteúdo */}
      <View style={{ flex: 1, paddingTop: isWeb ? 0 : insets.top }}>
        <Slot />
      </View>

      {/* Bottom nav (mobile) */}
      {!isWeb && <BottomNav items={NAV_ITEMS} />}
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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingHorizontal: 4 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  logoTitle: { fontSize: 13, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.3 },
  logoSub: { fontSize: 10, color: '#64748B', maxWidth: 130 },
  planChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(46,94,78,0.35)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 18, marginLeft: 4, maxWidth: SIDEBAR_W - 32,
  },
  planChipText: { fontSize: 11, fontWeight: '600', color: '#D1FAE5' },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingTop: 8, paddingHorizontal: 8,
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  sheetLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B' },
});

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', gap: 12 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#E6EFEC',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21, maxWidth: 440 },
  detail: { fontSize: 12, color: '#94A3B8', textAlign: 'center', fontStyle: 'italic' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  linkBtn: { paddingVertical: 8 },
  linkBtnText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
});
