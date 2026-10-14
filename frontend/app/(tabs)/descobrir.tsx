import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
  ImageBackground, Animated, Platform, InteractionManager,
} from 'react-native';
import SmartImage from '../../src/components/SmartImage';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import SkeletonCard from '../../src/components/SkeletonCard';
import ErrorState from '../../src/components/ui/ErrorState';
import MicroStoryCard, { MicroStory } from '../../src/components/MicroStoryCard';
import {
  getDiscoveryFeed, getTrendingItems, getEncyclopediaUniverses,
  getPOIDoDia, DiscoveryFeedItem, TrendingItem, EncyclopediaUniverse,
  getWeatherForecast, getWeatherAlerts, getSafetyCheck, getActiveFires, getAllSpotsConditions,
  getSurprisePOI, getHojeFeed,
} from '../../src/services/api';
import HojeEmPortugalCard, { HojeData } from '../../src/components/HojeEmPortugalCard';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import { API_BASE } from '../../src/config/api';
import { typography, shadows, regionImages, gradients, heroPeriods, fontFamilies, scrimPine } from '../../src/theme';
import type { HeroPeriod } from '../../src/theme';
import { palette } from '../../src/theme/colors';
import { useTheme } from '../../src/context/ThemeContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { CONTENT_MAX_WIDTH } from '../../src/theme/breakpoints';
// OnboardingModal removed — handled by /onboarding screen

const serif = fontFamilies.serif;

const getGreeting = (): { greetingKey: string; period: HeroPeriod } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { greetingKey: 'discovery.goodMorning', period: 'morning' };
  if (hour >= 12 && hour < 19) return { greetingKey: 'discovery.goodAfternoon', period: 'afternoon' };
  return { greetingKey: 'discovery.goodEvening', period: 'evening' };
};

const REGIONS = [
  { id: 'norte', name: 'Norte', subtitleKey: 'coreTabs.discover.regions.norte', image: regionImages.norte },
  { id: 'centro', name: 'Centro', subtitleKey: 'coreTabs.discover.regions.centro', image: regionImages.centro },
  { id: 'lisboa', name: 'Lisboa', subtitleKey: 'coreTabs.discover.regions.lisboa', image: regionImages.lisboa },
  { id: 'alentejo', name: 'Alentejo', subtitleKey: 'coreTabs.discover.regions.alentejo', image: regionImages.alentejo },
  { id: 'algarve', name: 'Algarve', subtitleKey: 'coreTabs.discover.regions.algarve', image: regionImages.algarve },
  { id: 'acores', name: 'Açores', subtitleKey: 'coreTabs.discover.regions.acores', image: regionImages.acores },
  { id: 'madeira', name: 'Madeira', subtitleKey: 'coreTabs.discover.regions.madeira', image: regionImages.madeira },
];

const QUICK_ACTIONS = [
  { id: 'mapa', titleKey: 'tabs.map', icon: 'map', route: '/(tabs)/mapa' },
  { id: 'planeador', titleKey: 'tabs.planner', icon: 'edit-calendar', route: '/(tabs)/planeador' },
  { id: 'eventos', titleKey: 'tabs.events', icon: 'event', route: '/(tabs)/eventos' },
  { id: 'pesquisar', titleKey: 'common.search', icon: 'search', route: '/search' },
  { id: 'perto', titleKey: 'coreTabs.discover.quickActions.nearMe', icon: 'near-me', route: '/nearby' },
  { id: 'conquistas', titleKey: 'achievements.title', icon: 'military-tech', route: '/gamification' },
  { id: 'album', titleKey: 'coreTabs.discover.quickActions.album', icon: 'photo-album', route: '/album' },
  { id: 'ranking', titleKey: 'coreTabs.discover.quickActions.ranking', icon: 'leaderboard', route: '/leaderboard' },
  { id: 'transportes', titleKey: 'coreTabs.discover.quickActions.transport', icon: 'train', route: '/(tabs)/transportes' },
  { id: 'beachcams', titleKey: 'coreTabs.discover.quickActions.beachcams', icon: 'videocam', route: '/(tabs)/beachcams' },
  { id: 'coleccoes', titleKey: 'coreTabs.discover.quickActions.encyclopedia', icon: 'collections-bookmark', route: '/(tabs)/coleccoes' },
  { id: 'guia', titleKey: 'coreTabs.discover.quickActions.guide', icon: 'menu-book', route: null },
];

const PROFILE_LABELS: Record<string, { labelKey: string; icon: string; color: string }> = {
  aventureiro: { labelKey: 'coreTabs.discover.profiles.adventurer', icon: 'terrain', color: palette.forest[500] },
  gastronomo: { labelKey: 'coreTabs.discover.profiles.foodie', icon: 'restaurant', color: palette.rust[500] },
  cultural: { labelKey: 'coreTabs.discover.profiles.cultural', icon: 'account-balance', color: palette.filigrana[700] },
  familia: { labelKey: 'coreTabs.discover.profiles.family', icon: 'family-restroom', color: palette.mint[600] },
};

function DescobrerTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { width, contentMaxWidth } = useResponsive();
  // Largura útil da coluna (limitada para se manter "phone-shaped" em web/tablet).
  const colWidth = Math.min(width, contentMaxWidth);
  // Reflui as quick actions: 4 por linha em telemóveis pequenos, 6 caso contrário.
  const actionsPerRow = width < 360 ? 4 : 6;
  const actionButtonWidth = (colWidth - 56) / actionsPerRow;
  const discoveryCardWidth = Math.min(colWidth * 0.58, 280);
  const [token, setToken] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const [guiaOpen, setGuiaOpen] = useState(false);
  const [activePerfil, setActivePerfil] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [feedPage, setFeedPage] = useState(1);
  // Defer heavy below-the-fold sections until after first paint to cut TTI.
  const [deferredReady, setDeferredReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setDeferredReady(true));
    // Fallback so the sections always appear even if the interaction handle
    // doesn't fire in a given environment.
    const fallback = setTimeout(() => setDeferredReady(true), 800);
    return () => {
      task.cancel?.();
      clearTimeout(fallback);
    };
  }, []);
  const { data: missionsData } = useQuery({
    queryKey: ['missions-badge'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/missions/my`);
      if (!res.ok) return { missions: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const claimableMissions = (missionsData?.missions || []).filter((m: any) => m.completed && !m.claimed).length;
  const refreshSpin = useRef(new Animated.Value(0)).current;

  // Animated refresh spinner
  useEffect(() => {
    if (refreshing) {
      const spin = Animated.loop(
        Animated.timing(refreshSpin, { toValue: 1, duration: 800, useNativeDriver: true })
      );
      spin.start();
      return () => spin.stop();
    } else {
      refreshSpin.setValue(0);
    }
  }, [refreshing, refreshSpin]);

  const refreshRotate = refreshSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => { AsyncStorage.getItem('userToken').then(setToken); }, []);

  // Load profile preference (from URL param, window global, or AsyncStorage)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPerfil = params.get('perfil');
      if (urlPerfil && PROFILE_LABELS[urlPerfil]) {
        setActivePerfil(urlPerfil);
        return;
      }
      if ((window as any).__TRAVELER_PROFILE && PROFILE_LABELS[(window as any).__TRAVELER_PROFILE]) {
        setActivePerfil((window as any).__TRAVELER_PROFILE);
        return;
      }
    }
    AsyncStorage.getItem('traveler_profile').then((saved) => {
      if (saved && PROFILE_LABELS[saved]) setActivePerfil(saved);
    });
  }, []);

  // Widget data queries
  const { data: weatherData } = useQuery({
    queryKey: ['weather-forecast', 'lisboa'],
    queryFn: () => getWeatherForecast('lisboa'),
    staleTime: 30 * 60 * 1000,
  });
  const { data: alertsData } = useQuery({ queryKey: ['weather-alerts'], queryFn: getWeatherAlerts, staleTime: 15 * 60 * 1000 });
  const { data: safetyData } = useQuery({ queryKey: ['safety-check', 38.7223, -9.1393], queryFn: () => getSafetyCheck(38.7223, -9.1393), staleTime: 10 * 60 * 1000 });
  const { data: firesData } = useQuery({ queryKey: ['active-fires'], queryFn: () => getActiveFires(), staleTime: 5 * 60 * 1000 });
  const { data: surfData } = useQuery({ queryKey: ['surf-all'], queryFn: getAllSpotsConditions, staleTime: 5 * 60 * 1000 });
  const { data: hojeData, isLoading: hojeLoading } = useQuery<HojeData>({
    queryKey: ['hoje-feed'],
    queryFn: () => getHojeFeed(),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const [surprisePOI, setSurprisePOI] = useState<any>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);

  const handleSurprise = async () => {
    setSurpriseLoading(true);
    setSurprisePOI(null);
    try {
      const data = await getSurprisePOI(activePerfil || undefined);
      setSurprisePOI(data.item);
    } catch { /* ignore */ } finally {
      setSurpriseLoading(false);
    }
  };

  const { data: feedData, isLoading: feedLoading, isError: feedError, refetch: refetchFeed } = useQuery({
    queryKey: ['discovery-feed', token, activePerfil, activeCategory],
    queryFn: () => getDiscoveryFeed(
      undefined, undefined, 30,
      token || undefined,
      activePerfil || undefined,
      activeCategory !== 'todos' ? activeCategory : undefined
    ),
  });
  const { data: trendingData } = useQuery({
    queryKey: ['trending'],
    queryFn: () => getTrendingItems(10),
  });
  const { data: universesData } = useQuery({
    queryKey: ['encyclopedia-universes'],
    queryFn: getEncyclopediaUniverses,
  });
  const { data: poiDoDia } = useQuery({
    queryKey: ['poi-do-dia'],
    queryFn: getPOIDoDia,
    staleTime: 60 * 60 * 1000,
  });

  // Micro-stories: fetched from content strategy API
  const { data: microStoriesData } = useQuery({
    queryKey: ['micro-stories', activePerfil],
    queryFn: async () => {
      const body = {
        poi_ids: [],  // empty = random sample from backend
        cognitive_profile: activePerfil || undefined,
        limit: 6,
      };
      const res = await fetch(`${API_BASE}/content/micro-stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const onRefresh = async () => { setRefreshing(true); await refetchFeed(); setRefreshing(false); };
  const { greetingKey, period } = getGreeting();

  const groupedFeed = React.useMemo(() => {
    if (!feedData?.items) return {};
    const result: Record<string, any[]> = {};
    feedData.items.forEach((item: any) => {
      const section = item.section || 'for_you';
      if (!result[section]) result[section] = [];
      result[section].push(item);
    });
    return result;
  }, [feedData]);

  // Dynamic styles using theme colors
  const ds = {
    bg: { backgroundColor: colors.background },
    surface: { backgroundColor: colors.surface },
    surfaceAlt: { backgroundColor: colors.surfaceAlt },
    textPrimary: { color: colors.textPrimary },
    textSecondary: { color: colors.textSecondary },
    textMuted: { color: colors.textMuted },
    border: { borderColor: colors.border },
    accent: { color: colors.accent },
  };

  if (feedLoading && !feedData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
          <SkeletonCard variant="discovery" count={3} />
          <View style={{ marginTop: 16 }}><SkeletonCard variant="heritage" count={4} /></View>
        </View>
      </View>
    );
  }

  if (feedError && !feedData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ErrorState
          message={t('coreTabs.discover.loadError')}
          onRetry={() => refetchFeed()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, ds.bg]}>
      {Platform.OS === 'web' && (
        <Head>
          <title>{t('coreTabs.discover.headTitle')}</title>
          <meta name="description" content={t('coreTabs.discover.headDescription')} />
          <meta property="og:title" content={t('coreTabs.discover.ogTitle')} />
          <meta property="og:description" content={t('coreTabs.discover.ogDescription')} />
          <link rel="canonical" href="https://portugal-vivo.app/descobrir" />
        </Head>
      )}
      {/* OnboardingModal removed — onboarding screen handles first-time users */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            style={{ backgroundColor: 'transparent' }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Pull-to-Refresh Indicator */}
        {refreshing && (
          <View style={styles.refreshIndicator} data-testid="pull-to-refresh-indicator">
            <Animated.View style={{ transform: [{ rotate: refreshRotate }] }}>
              <MaterialIcons name="explore" size={24} color={colors.accent} />
            </Animated.View>
            <Text style={[styles.refreshText, { color: colors.textMuted }]}>{t('coreTabs.discover.refreshing')}</Text>
          </View>
        )}
        {/* Hero Header */}
        <View style={styles.header}>
          <ImageBackground source={{ uri: regionImages.hero }} style={styles.heroImage} imageStyle={styles.heroImageStyle}>
            <LinearGradient
              colors={isDark ? [...gradients.heroDark.colors] : [...heroPeriods[period].colors]}
              locations={isDark ? [...gradients.heroDark.locations] : [...heroPeriods[period].locations]}
              style={styles.heroGradient}
            >
              {/* Login button top-right */}
              <TouchableOpacity
                style={{ position: 'absolute', top: 12, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 }}
                onPress={() => router.push('/(tabs)/profile')}
                accessibilityLabel={token ? t('coreTabs.discover.openProfile') : t('coreTabs.discover.signIn')}
                accessibilityRole="button"
              >
                <MaterialIcons name={token ? 'account-circle' : 'login'} size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{token ? t('tabs.profile') : t('coreTabs.discover.signInShort')}</Text>
              </TouchableOpacity>
              <Text style={styles.greeting}>{t(greetingKey)}</Text>
              <Text style={styles.headerTitle}>{t('coreTabs.discover.heroTitle')}</Text>
              <Text style={styles.headerSubtitle}>{t('coreTabs.discover.heroSubtitle')}</Text>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* Quick Actions Grid */}
        <View style={[styles.quickActions, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} data-testid="quick-actions-grid">
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.actionButton, { width: actionButtonWidth }]}
              onPress={() => {
                if (action.id === 'guia') { setGuiaOpen(!guiaOpen); return; }
                if (action.route) router.push(action.route);
              }}
              data-testid={`action-${action.id}`}
              accessibilityLabel={action.id === 'guia' ? t('coreTabs.discover.openGuide') : t('coreTabs.shared.open', { name: t(action.titleKey) })}
              accessibilityRole="button"
              accessibilityState={action.id === 'guia' ? { expanded: guiaOpen } : undefined}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name={action.icon as any} size={20} color={colors.primary} />
                {action.id === 'conquistas' && claimableMissions > 0 && (
                  <View style={styles.actionBadge}><Text style={styles.actionBadgeText}>{claimableMissions}</Text></View>
                )}
              </View>
              <Text style={[styles.actionText, ds.textSecondary]} numberOfLines={1}>{t(action.titleKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Profile Banner */}
        {activePerfil && PROFILE_LABELS[activePerfil] && (
          <View
            style={[styles.profileBanner, { backgroundColor: PROFILE_LABELS[activePerfil].color + '15', borderColor: PROFILE_LABELS[activePerfil].color + '40' }]}
            data-testid="profile-banner"
          >
            <MaterialIcons name={PROFILE_LABELS[activePerfil].icon as any} size={22} color={PROFILE_LABELS[activePerfil].color} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.profileBannerTitle, { color: PROFILE_LABELS[activePerfil].color }]}>
                {t('coreTabs.discover.suggestionsFor', { profile: t(PROFILE_LABELS[activePerfil].labelKey) })}
              </Text>
              <Text style={[styles.profileBannerSub, { color: colors.textMuted }]}>
                {t('coreTabs.discover.profileFeed')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setActivePerfil(null)} data-testid="clear-profile-btn" accessibilityLabel={t('coreTabs.discover.removeProfileFilter')} accessibilityRole="button">
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Guia do Viajante Panel (expandable) */}
        {guiaOpen && (
          <View style={[styles.guiaPanel, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} data-testid="guia-viajante-panel">
            <View style={styles.guiaPanelHeader}>
              <MaterialIcons name="menu-book" size={18} color={colors.primary} />
              <Text style={[styles.guiaPanelTitle, { color: colors.textPrimary }]}>{t('coreTabs.discover.guide.title')}</Text>
              <TouchableOpacity onPress={() => setGuiaOpen(false)} data-testid="close-guia" accessibilityLabel={t('coreTabs.discover.guide.close')} accessibilityRole="button">
                <MaterialIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Informacoes Essenciais */}
            <View style={[styles.guiaSectionHeader, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="info" size={14} color={colors.accent} />
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>{t('coreTabs.discover.guide.essentials.title')}</Text>
            </View>
            {[
              { icon: 'language', label: t('coreTabs.discover.guide.essentials.language'), value: t('coreTabs.discover.guide.essentials.languageValue') },
              { icon: 'payments', label: t('coreTabs.discover.guide.essentials.currency'), value: 'Euro (EUR)' },
              { icon: 'schedule', label: t('coreTabs.discover.guide.essentials.timezone'), value: t('coreTabs.discover.guide.essentials.timezoneValue') },
              { icon: 'electrical-services', label: t('coreTabs.discover.guide.essentials.sockets'), value: t('coreTabs.discover.guide.essentials.socketsValue') },
              { icon: 'local-drink', label: t('coreTabs.discover.guide.essentials.tapWater'), value: t('coreTabs.discover.guide.essentials.tapWaterValue') },
              { icon: 'directions-car', label: t('coreTabs.discover.guide.essentials.driving'), value: t('coreTabs.discover.guide.essentials.drivingValue') },
            ].map((item, i) => (
              <View key={i} style={[styles.guiaRow, { borderTopColor: colors.borderLight }]}>
                <MaterialIcons name={item.icon as any} size={14} color={colors.textMuted} />
                <Text style={[styles.guiaLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.guiaValue, { color: colors.textPrimary }]}>{item.value}</Text>
              </View>
            ))}

            {/* Melhor Epoca */}
            <View style={[styles.guiaSectionHeader, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="wb-sunny" size={14} color={colors.accent} />
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>{t('coreTabs.discover.guide.bestTime.title')}</Text>
            </View>
            {[
              { icon: 'calendar-today', label: t('coreTabs.discover.guide.bestTime.spring'), value: t('coreTabs.discover.guide.bestTime.springValue') },
              { icon: 'wb-sunny', label: t('coreTabs.discover.guide.bestTime.summer'), value: t('coreTabs.discover.guide.bestTime.summerValue') },
              { icon: 'eco', label: t('coreTabs.discover.guide.bestTime.autumn'), value: t('coreTabs.discover.guide.bestTime.autumnValue') },
              { icon: 'ac-unit', label: t('coreTabs.discover.guide.bestTime.winter'), value: t('coreTabs.discover.guide.bestTime.winterValue') },
            ].map((item, i) => (
              <View key={i} style={[styles.guiaRow, { borderTopColor: colors.borderLight }]}>
                <MaterialIcons name={item.icon as any} size={14} color={colors.textMuted} />
                <Text style={[styles.guiaLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.guiaValue, { color: colors.textPrimary }]}>{item.value}</Text>
              </View>
            ))}

            {/* Custos */}
            <View style={[styles.guiaSectionHeader, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="euro" size={14} color={colors.accent} />
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>{t('coreTabs.discover.guide.costs.title')}</Text>
            </View>
            {[
              { icon: 'restaurant', label: t('coreTabs.discover.guide.costs.meal'), value: '8-15 EUR' },
              { icon: 'local-cafe', label: t('coreTabs.discover.guide.costs.coffee'), value: '1.50-2.50 EUR' },
              { icon: 'hotel', label: t('coreTabs.discover.guide.costs.hotel2'), value: t('coreTabs.discover.guide.costs.hotel2Value') },
              { icon: 'apartment', label: t('coreTabs.discover.guide.costs.hotel4'), value: t('coreTabs.discover.guide.costs.hotel4Value') },
              { icon: 'directions-bus', label: t('coreTabs.discover.guide.costs.publicTransport'), value: t('coreTabs.discover.guide.costs.publicTransportValue') },
              { icon: 'local-gas-station', label: t('coreTabs.discover.guide.costs.petrol'), value: t('coreTabs.discover.guide.costs.petrolValue') },
              { icon: 'local-bar', label: t('coreTabs.discover.guide.costs.beer'), value: '1.50-3 EUR' },
              { icon: 'favorite', label: t('coreTabs.discover.guide.costs.tips'), value: t('coreTabs.discover.guide.costs.tipsValue') },
            ].map((item, i) => (
              <View key={i} style={[styles.guiaRow, { borderTopColor: colors.borderLight }]}>
                <MaterialIcons name={item.icon as any} size={14} color={colors.textMuted} />
                <Text style={[styles.guiaLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.guiaValue, { color: colors.textPrimary }]}>{item.value}</Text>
              </View>
            ))}

            {/* Saude e Seguranca */}
            <View style={[styles.guiaSectionHeader, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="local-hospital" size={14} color={colors.error} />
              <Text style={[styles.guiaSectionTitle, { color: colors.error }]}>{t('coreTabs.discover.guide.health.title')}</Text>
            </View>
            {[
              { icon: 'emergency', label: t('coreTabs.discover.guide.health.emergency'), value: '112' },
              { icon: 'local-police', label: t('coreTabs.discover.guide.health.police'), value: '112 / 21 765 42 42' },
              { icon: 'fire-truck', label: t('coreTabs.discover.guide.health.firefighters'), value: '117' },
              { icon: 'local-hospital', label: 'Saude 24', value: '808 24 24 24' },
              { icon: 'health-and-safety', label: t('coreTabs.discover.guide.health.ehic'), value: t('coreTabs.discover.guide.health.ehicValue') },
              { icon: 'verified-user', label: t('coreTabs.discover.guide.health.safety'), value: t('coreTabs.discover.guide.health.safetyValue') },
              { icon: 'warning', label: t('coreTabs.discover.guide.health.caution'), value: t('coreTabs.discover.guide.health.cautionValue') },
            ].map((item, i) => (
              <View key={i} style={[styles.guiaRow, { borderTopColor: colors.borderLight }]}>
                <MaterialIcons name={item.icon as any} size={14} color={colors.textMuted} />
                <Text style={[styles.guiaLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.guiaValue, { color: colors.textPrimary }]}>{item.value}</Text>
              </View>
            ))}

            {/* Transportes */}
            <View style={[styles.guiaSectionHeader, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="directions-car" size={14} color={colors.accent} />
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>{t('coreTabs.discover.guide.transport.title')}</Text>
            </View>
            {[
              { icon: 'train', label: t('coreTabs.discover.guide.transport.trains'), value: t('coreTabs.discover.guide.transport.trainsValue') },
              { icon: 'directions-bus', label: t('coreTabs.discover.guide.transport.buses'), value: t('coreTabs.discover.guide.transport.busesValue') },
              { icon: 'subway', label: t('coreTabs.discover.guide.transport.metro'), value: t('coreTabs.discover.guide.transport.metroValue') },
              { icon: 'local-taxi', label: t('coreTabs.discover.guide.transport.taxi'), value: t('coreTabs.discover.guide.transport.taxiValue') },
              { icon: 'directions-boat', label: t('coreTabs.discover.guide.transport.ferries'), value: t('coreTabs.discover.guide.transport.ferriesValue') },
              { icon: 'flight', label: t('coreTabs.discover.guide.transport.flights'), value: t('coreTabs.discover.guide.transport.flightsValue') },
            ].map((item, i) => (
              <View key={i} style={[styles.guiaRow, { borderTopColor: colors.borderLight }]}>
                <MaterialIcons name={item.icon as any} size={14} color={colors.textMuted} />
                <Text style={[styles.guiaLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.guiaValue, { color: colors.textPrimary }]}>{item.value}</Text>
              </View>
            ))}

            {/* Cultura e Etiqueta */}
            <View style={[styles.guiaSectionHeader, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="people" size={14} color={colors.accent} />
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>{t('coreTabs.discover.guide.etiquette.title')}</Text>
            </View>
            {[
              { icon: 'waving-hand', label: t('coreTabs.discover.guide.etiquette.greeting'), value: t('coreTabs.discover.guide.etiquette.greetingValue') },
              { icon: 'schedule', label: t('coreTabs.discover.guide.etiquette.mealTimes'), value: t('coreTabs.discover.guide.etiquette.mealTimesValue') },
              { icon: 'store', label: t('coreTabs.discover.guide.etiquette.shopHours'), value: t('coreTabs.discover.guide.etiquette.shopHoursValue') },
              { icon: 'no-photography', label: t('coreTabs.discover.guide.etiquette.photos'), value: t('coreTabs.discover.guide.etiquette.photosValue') },
              { icon: 'smoking-rooms', label: t('coreTabs.discover.guide.etiquette.smoking'), value: t('coreTabs.discover.guide.etiquette.smokingValue') },
            ].map((item, i) => (
              <View key={i} style={[styles.guiaRow, { borderTopColor: colors.borderLight }]}>
                <MaterialIcons name={item.icon as any} size={14} color={colors.textMuted} />
                <Text style={[styles.guiaLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.guiaValue, { color: colors.textPrimary }]}>{item.value}</Text>
              </View>
            ))}

            {/* Documentacao */}
            <View style={[styles.guiaSectionHeader, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="badge" size={14} color={colors.accent} />
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>{t('coreTabs.discover.guide.documents.title')}</Text>
            </View>
            {[
              { icon: 'public', label: t('coreTabs.discover.guide.documents.eu'), value: t('coreTabs.discover.guide.documents.euValue') },
              { icon: 'flight-land', label: t('coreTabs.discover.guide.documents.nonEu'), value: t('coreTabs.discover.guide.documents.nonEuValue') },
              { icon: 'receipt-long', label: 'Tax Free', value: t('coreTabs.discover.guide.documents.taxFreeValue') },
            ].map((item, i) => (
              <View key={i} style={[styles.guiaRow, { borderTopColor: colors.borderLight }]}>
                <MaterialIcons name={item.icon as any} size={14} color={colors.textMuted} />
                <Text style={[styles.guiaLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.guiaValue, { color: colors.textPrimary }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Compact Info Widgets */}
        <View style={styles.widgetStrip}>
          {/* Weather */}
          <TouchableOpacity
            style={[styles.chipWidget, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            onPress={() => setExpandedWidget(expandedWidget === 'weather' ? null : 'weather')}
            activeOpacity={0.7}
            data-testid="weather-chip"
            accessibilityLabel={t('coreTabs.discover.weatherA11y')}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedWidget === 'weather' }}
          >
            <View style={styles.chipRow}>
              <MaterialIcons name="wb-sunny" size={16} color={colors.accent} />
              <Text style={[styles.chipText, { color: colors.textPrimary }]} numberOfLines={1}>
                {weatherData?.forecasts?.[0] ? `${Math.round(weatherData.forecasts[0].temp_min)}°-${Math.round(weatherData.forecasts[0].temp_max)}°` : '...'}
              </Text>
              <MaterialIcons name={expandedWidget === 'weather' ? 'expand-less' : 'expand-more'} size={16} color={colors.textMuted} />
            </View>
            {expandedWidget === 'weather' && weatherData?.forecasts?.[0] && (
              <View style={[styles.chipDetail, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.chipDetailText, { color: colors.textSecondary }]}>{weatherData.forecasts[0].weather_description}</Text>
                <Text style={[styles.chipDetailText, { color: colors.textSecondary }]}>Lisboa - IPMA</Text>
                {(alertsData?.alerts?.filter((a: any) => a.level !== 'green') || []).slice(0, 2).map((alert: any, i: number) => (
                  <View key={i} style={styles.chipAlertRow}>
                    <MaterialIcons name="warning" size={12} color={colors.warning} />
                    <Text style={[styles.chipAlertText, { color: colors.warning }]} numberOfLines={1}>{alert.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>

          {/* Safety */}
          <TouchableOpacity
            style={[styles.chipWidget, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            onPress={() => setExpandedWidget(expandedWidget === 'safety' ? null : 'safety')}
            activeOpacity={0.7}
            data-testid="safety-chip"
            accessibilityLabel={t('coreTabs.discover.safetyA11y')}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedWidget === 'safety' }}
          >
            <View style={styles.chipRow}>
              <MaterialIcons
                name={safetyData?.safety_level === 'danger' ? 'error' : safetyData?.safety_level === 'warning' ? 'warning' : 'check-circle'}
                size={16}
                color={safetyData?.safety_level === 'danger' ? colors.error : safetyData?.safety_level === 'warning' ? colors.warning : colors.success}
              />
              <Text style={[styles.chipText, { color: colors.textPrimary }]} numberOfLines={1}>
                {safetyData?.safety_level === 'danger' ? t('coreTabs.discover.safety.danger') : safetyData?.safety_level === 'warning' ? t('coreTabs.discover.safety.warning') : t('coreTabs.discover.safety.safe')}
              </Text>
              <MaterialIcons name={expandedWidget === 'safety' ? 'expand-less' : 'expand-more'} size={16} color={colors.textMuted} />
            </View>
            {expandedWidget === 'safety' && (
              <View style={[styles.chipDetail, { borderTopColor: colors.borderLight }]}>
                {safetyData?.message && <Text style={[styles.chipDetailText, { color: colors.textSecondary }]}>{safetyData.message}</Text>}
                {((firesData as any)?.active_count || 0) > 0 && (
                  <Text style={[styles.chipDetailText, { color: colors.textSecondary }]}>{t('coreTabs.discover.activeFires', { count: (firesData as any).active_count })}</Text>
                )}
                {safetyData?.weather_alerts?.slice(0, 2).map((alert: any, i: number) => (
                  <View key={i} style={styles.chipAlertRow}>
                    <MaterialIcons name="cloud" size={12} color={colors.warning} />
                    <Text style={[styles.chipAlertText, { color: colors.warning }]} numberOfLines={1}>{alert.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>

          {/* Surf */}
          <TouchableOpacity
            style={[styles.chipWidget, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            onPress={() => setExpandedWidget(expandedWidget === 'surf' ? null : 'surf')}
            activeOpacity={0.7}
            data-testid="surf-chip"
            accessibilityLabel={t('coreTabs.discover.surfA11y')}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedWidget === 'surf' }}
          >
            <View style={styles.chipRow}>
              <MaterialIcons name="waves" size={16} color={colors.secondary} />
              <Text style={[styles.chipText, { color: colors.textPrimary }]} numberOfLines={1}>
                {surfData?.spots?.[0] ? `${surfData.spots[0].wave_height_m?.toFixed(1)}m` : '...'}
              </Text>
              <MaterialIcons name={expandedWidget === 'surf' ? 'expand-less' : 'expand-more'} size={16} color={colors.textMuted} />
            </View>
            {expandedWidget === 'surf' && surfData?.spots?.[0] && (
              <View style={[styles.chipDetail, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.chipDetailText, { color: colors.textSecondary }]}>{surfData.spots[0].spot?.name || t('coreTabs.discover.bestSpot')}</Text>
                <View style={styles.surfStats}>
                  <Text style={[styles.surfStat, { color: colors.textPrimary }]}>{surfData.spots[0].wave_height_m?.toFixed(1)}m</Text>
                  <Text style={[styles.surfStatLabel, { color: colors.textMuted }]}>{t('coreTabs.discover.waveHeight')}</Text>
                  <Text style={[styles.surfStat, { color: colors.textPrimary }]}>{surfData.spots[0].wave_period_s?.toFixed(0)}s</Text>
                  <Text style={[styles.surfStatLabel, { color: colors.textMuted }]}>{t('coreTabs.discover.wavePeriod')}</Text>
                  <Text style={[styles.surfStat, { color: colors.textPrimary }]}>{surfData.spots[0].wave_direction || '--'}</Text>
                  <Text style={[styles.surfStatLabel, { color: colors.textMuted }]}>{t('coreTabs.discover.waveDirection')}</Text>
                </View>
                <Text style={[styles.chipDetailMuted, { color: colors.textMuted }]}>Open-Meteo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Hoje em Portugal */}
        <HojeEmPortugalCard
          data={hojeData}
          loading={hojeLoading}
          accentColor={colors.primary}
        />

        {/* POI do Dia */}
        {poiDoDia?.has_poi && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="auto-awesome" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, ds.textPrimary]}>{t('coreTabs.discover.poiOfDay')}</Text>
              </View>
              <Text style={[styles.seeAll, { color: colors.textMuted, fontSize: 11 }]}>{poiDoDia.category_label}</Text>
            </View>
            <TouchableOpacity
              style={[styles.poiDiaCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
              onPress={() => router.push(`/heritage/${poiDoDia.poi.id}`)}
              activeOpacity={0.85}
              data-testid="poi-do-dia-card"
              accessibilityLabel={t('coreTabs.shared.viewDetails', { name: poiDoDia.poi.name })}
              accessibilityRole="button"
            >
              <SmartImage
                uri={poiDoDia.poi.image_url}
                category={poiDoDia.poi.category}
                name={poiDoDia.poi.name}
                style={styles.poiDiaImage}
                contentFit="cover"
              />
              <View style={styles.poiDiaContent}>
                <View style={styles.poiDiaTop}>
                  <View style={[styles.poiDiaBadge, { backgroundColor: colors.premium + '18' }]}>
                    <MaterialIcons name="auto-awesome" size={12} color={colors.premium} />
                    <Text style={[styles.poiDiaBadgeText, { color: colors.premium }]}>{t('coreTabs.discover.iqHighlight')}</Text>
                  </View>
                  <View style={[styles.poiDiaScoreBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.poiDiaScoreVal, { color: colors.primary }]}>{poiDoDia.poi.iq_score}</Text>
                  </View>
                </View>
                <Text style={[styles.poiDiaName, { color: colors.textPrimary }]} numberOfLines={2}>{poiDoDia.poi.name}</Text>
                <Text style={[styles.poiDiaDesc, { color: colors.textSecondary }]} numberOfLines={2}>{poiDoDia.poi.description}</Text>
                <View style={styles.poiDiaBottom}>
                  <MaterialIcons name="place" size={14} color={colors.textMuted} />
                  <Text style={[styles.poiDiaInfoText, { color: colors.textMuted }]}>{poiDoDia.poi.region}</Text>
                  {poiDoDia.poi.rarity && (
                    <View style={[styles.poiDiaRarity, { backgroundColor: colors.accent + '18' }]}>
                      <Text style={[styles.poiDiaRarityText, { color: colors.accent }]}>{poiDoDia.poi.rarity}</Text>
                    </View>
                  )}
                  <MaterialIcons name="arrow-forward" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Regions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, ds.textPrimary]}>{t('coreTabs.discover.exploreByRegion')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/mapa')} accessibilityLabel={t('coreTabs.discover.viewMapA11y')} accessibilityRole="link">
              <Text style={[styles.seeAll, { color: colors.accent }]}>{t('coreTabs.discover.viewMap')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionsRow}>
            {REGIONS.map((region) => (
              <TouchableOpacity
                key={region.id}
                style={styles.regionCard}
                onPress={() => router.push(`/(tabs)/mapa?region=${region.id}&t=${Date.now()}`)}
                activeOpacity={0.9}
                data-testid={`region-card-${region.id}`}
                accessibilityLabel={t('coreTabs.discover.exploreRegionA11y', { name: region.name })}
                accessibilityRole="button"
              >
                <ImageBackground source={{ uri: region.image }} style={styles.regionImage} imageStyle={styles.regionImageStyle}>
                  <LinearGradient colors={['transparent', scrimPine(0.55)]} style={styles.regionGradient}>
                    <View style={styles.regionContent}>
                      <Text style={styles.regionName}>{region.name}</Text>
                      <Text style={styles.regionSubtitle}>{t(region.subtitleKey)}</Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Enciclopédia Viva */}
        {universesData && universesData.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="auto-awesome" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, ds.textPrimary]}>{t('coreTabs.discover.encyclopedia')}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/coleccoes')} accessibilityLabel={t('coreTabs.discover.viewAllEncyclopedia')} accessibilityRole="link">
                <Text style={[styles.seeAll, { color: colors.accent }]}>{t('coreTabs.discover.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.universesRow}>
              {universesData.map((universe: EncyclopediaUniverse) => (
                <TouchableOpacity
                  key={universe.id}
                  style={[styles.universeCard, { backgroundColor: (universe.color || colors.primary) + (isDark ? '20' : '10') }]}
                  onPress={() => router.push('/(tabs)/coleccoes')}
                  activeOpacity={0.8}
                  data-testid={`universe-card-${universe.id}`}
                  accessibilityLabel={t('coreTabs.shared.openUniverse', { name: universe.name })}
                  accessibilityRole="button"
                >
                  <View style={[styles.universeIcon, { backgroundColor: universe.color || colors.primary }]}>
                    <MaterialIcons name={(universe.icon || 'place') as any} size={22} color="#FFF" />
                  </View>
                  <Text style={[styles.universeName, ds.textPrimary]} numberOfLines={2}>{universe.name}</Text>
                  <Text style={[styles.universeCount, ds.textMuted]}>{t('coreTabs.units.places', { count: universe.item_count })}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Surpreende-me */}
        <TouchableOpacity
          style={[styles.surpriseCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={surprisePOI ? () => router.push(`/heritage/${surprisePOI.id}`) : handleSurprise}
          activeOpacity={0.85}
          data-testid="surprise-card"
          accessibilityLabel={surprisePOI ? t('coreTabs.shared.viewDetails', { name: surprisePOI.name }) : t('coreTabs.discover.surpriseA11y')}
          accessibilityRole="button"
        >
          {surpriseLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : surprisePOI ? (
            <>
              <SmartImage
                uri={surprisePOI.image_url}
                category={surprisePOI.category}
                name={surprisePOI.name}
                style={styles.surpriseThumb}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.accent, marginBottom: 2 }]}>{t('coreTabs.discover.hiddenPlace')}</Text>
                <Text style={[styles.surpriseTitle, ds.textPrimary]} numberOfLines={1}>{surprisePOI.name}</Text>
                <Text style={[{ fontSize: 12, color: colors.textMuted }]} numberOfLines={1}>{surprisePOI.region} · {surprisePOI.category}</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color={colors.textMuted} />
            </>
          ) : (
            <>
              <View style={[styles.surpriseIcon, { backgroundColor: colors.accent + '20' }]}>
                <MaterialIcons name="shuffle" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.surpriseTitle, ds.textPrimary]}>{t('coreTabs.discover.surpriseMe')}</Text>
                <Text style={[{ fontSize: 12, color: colors.textMuted }]}>{t('coreTabs.discover.surpriseSub')}</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color={colors.textMuted} />
            </>
          )}
        </TouchableOpacity>

        {/* Trending */}
        {trendingData?.items && trendingData.items.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="trending-up" size={18} color={colors.success} />
                <Text style={[styles.sectionTitle, ds.textPrimary]}>{t('coreTabs.discover.trending')}</Text>
              </View>
              <Text style={[styles.sectionPeriod, ds.textMuted]}>{t('coreTabs.discover.last7Days')}</Text>
            </View>
            <View style={styles.trendingList}>
              {trendingData.items.slice(0, 5).map((item: TrendingItem, index: number) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.trendingCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                  onPress={() => router.push(`/heritage/${item.id}`)}
                  activeOpacity={0.8}
                  data-testid={`trending-card-${item.id}`}
                  accessibilityLabel={t('coreTabs.shared.viewDetails', { name: item.name })}
                  accessibilityRole="button"
                >
                  <View style={[styles.trendingRank, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.trendingRankText, { color: colors.primary }]}>{index + 1}</Text>
                  </View>
                  <SmartImage uri={item.image_url} category={item.category} name={item.name} style={styles.trendingImage} contentFit="cover" />
                  <View style={styles.trendingInfo}>
                    <Text style={[styles.trendingTitle, ds.textPrimary]} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.trendingMeta}>
                      <MaterialIcons name="trending-up" size={14} color={colors.success} />
                      <Text style={{ fontSize: 12, color: colors.success }}>{t('coreTabs.units.visits', { count: item.trending_score })}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Category Filter Tabs */}
        {feedData?.items && feedData.items.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabsWrap}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {[
              { id: 'todos', label: t('coreTabs.discover.feedTabs.forYou'), icon: 'person' },
              { id: 'nearby', label: t('coreTabs.discover.feedTabs.nearby'), icon: 'near-me' },
              { id: 'stories', label: t('coreTabs.discover.feedTabs.stories'), icon: 'auto-stories' },
              { id: 'trails', label: t('coreTabs.discover.feedTabs.trails'), icon: 'directions-walk' },
              { id: 'events', label: t('coreTabs.discover.feedTabs.events'), icon: 'event' },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryTab,
                  { backgroundColor: activeCategory === cat.id ? colors.accent : colors.surface, borderColor: activeCategory === cat.id ? colors.accent : colors.borderLight },
                ]}
                onPress={() => { setActiveCategory(cat.id); setFeedPage(1); }}
                accessibilityLabel={t('coreTabs.discover.filterFeedBy', { name: cat.label })}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeCategory === cat.id }}
              >
                <MaterialIcons name={cat.icon as any} size={14} color={activeCategory === cat.id ? '#fff' : colors.textMuted} />
                <Text style={[styles.categoryTabText, { color: activeCategory === cat.id ? '#fff' : colors.textMuted }]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Discovery Feed */}
        {groupedFeed['for_you'] && groupedFeed['for_you'].length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="person" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, ds.textPrimary]}>{t('coreTabs.discover.forYou')}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {groupedFeed['for_you'].slice(0, 6 * feedPage).map((item: DiscoveryFeedItem) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.discoveryCard, { width: discoveryCardWidth, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                  onPress={() => router.push(`/heritage/${item.content_id}`)}
                  activeOpacity={0.8}
                  data-testid={`discovery-card-${item.content_id}`}
                  accessibilityLabel={t('coreTabs.shared.viewDetails', { name: item.content_data.name })}
                  accessibilityRole="button"
                >
                  <SmartImage uri={item.content_data.image_url} name={item.content_data.name} style={styles.discoveryImage} contentFit="cover" />
                  <View style={styles.discoveryContent}>
                    <Text style={[styles.discoveryTitle, ds.textPrimary]} numberOfLines={2}>{item.content_data.name}</Text>
                    <View style={[styles.reasonBadge, { backgroundColor: colors.primary + '12' }]}>
                      <MaterialIcons name="auto-awesome" size={12} color={colors.accent} />
                      <Text style={[styles.reasonText, ds.textSecondary]} numberOfLines={1}>{item.reason}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {groupedFeed['for_you'].length > 6 * feedPage && (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { borderColor: colors.borderLight }]}
                onPress={() => setFeedPage(p => p + 1)}
                accessibilityLabel={t('coreTabs.discover.loadMoreA11y')}
                accessibilityRole="button"
              >
                <Text style={[styles.loadMoreText, { color: colors.accent }]}>{t('coreTabs.discover.loadMore')}</Text>
                <MaterialIcons name="expand-more" size={18} color={colors.accent} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Micro-Stories */}
        {microStoriesData?.stories && microStoriesData.stories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="auto-stories" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, ds.textPrimary]}>{t('coreTabs.discover.microStories')}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/search')} accessibilityLabel={t('coreTabs.discover.moreMicroStoriesA11y')} accessibilityRole="link">
                <Text style={[styles.sectionLink, { color: colors.accent }]}>{t('common.seeMore')}</Text>
              </TouchableOpacity>
            </View>
            {microStoriesData.stories.map((story: MicroStory) => (
              <MicroStoryCard
                key={story.poi_id}
                story={story}
                onPress={() => router.push(`/heritage/${story.poi_id}`)}
                onQueroSaberMais={(id) => router.push(`/heritage/${id}`)}
              />
            ))}
          </View>
        )}

        {/* Linha do Tempo — quick access by region */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="history-edu" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, ds.textPrimary]}>{t('coreTabs.discover.timeline')}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {[
              { id: 'minho', label: 'Minho', emoji: '🏰' },
              { id: 'lisboa', label: 'Lisboa', emoji: '⚓' },
              { id: 'alentejo', label: 'Alentejo', emoji: '🫒' },
              { id: 'algarve', label: 'Algarve', emoji: '🌊' },
            ].map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.timelineChip, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                onPress={() => router.push(`/timeline/${r.id}`)}
                accessibilityLabel={t('coreTabs.discover.timelineA11y', { name: r.label })}
                accessibilityRole="button"
              >
                <Text style={styles.timelineEmoji}>{r.emoji}</Text>
                <Text style={[styles.timelineLabel, ds.textPrimary]}>{r.label}</Text>
                <MaterialIcons name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── Explorar em Profundidade ─── (deferred: below the fold) */}
        {deferredReady && (
        <>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="auto-awesome-mosaic" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, ds.textPrimary]}>{t('coreTabs.discover.deepDive.title')}</Text>
            </View>
          </View>
          {[
            {
              title: t('coreTabs.discover.deepDive.sea'),
              subtitle: t('coreTabs.discover.deepDive.seaSub'),
              icon: 'sailing' as const,
              color: palette.ocean[500],
              modules: [
                { name: t('coreTabs.discover.deepDive.modules.coast'), route: '/costa', icon: 'waves' as const, count: t('coreTabs.units.zones', { count: 10 }) },
                { name: t('coreTabs.discover.deepDive.modules.marine'), route: '/biodiversidade', icon: 'water' as const, count: t('coreTabs.units.spots', { count: 10 }) },
                { name: t('coreTabs.discover.deepDive.modules.maritime'), route: '/cultura-maritima', icon: 'anchor' as const, count: t('coreTabs.units.traditions', { count: 14 }) },
              ],
            },
            {
              title: t('coreTabs.discover.deepDive.nature'),
              subtitle: t('coreTabs.discover.deepDive.natureSub'),
              icon: 'eco' as const,
              color: palette.forest[500],
              modules: [
                { name: t('coreTabs.discover.deepDive.modules.flora'), route: '/flora', icon: 'local-florist' as const, count: t('coreTabs.units.species', { count: 8 }) },
                { name: t('coreTabs.discover.deepDive.modules.fauna'), route: '/fauna', icon: 'pets' as const, count: t('coreTabs.units.species', { count: 8 }) },
                { name: t('coreTabs.discover.deepDive.modules.infrastructure'), route: '/infraestrutura', icon: 'terrain' as const, count: t('coreTabs.units.places', { count: 14 }) },
              ],
            },
            {
              title: t('coreTabs.discover.deepDive.heritage'),
              subtitle: t('coreTabs.discover.deepDive.heritageSub'),
              icon: 'account-balance' as const,
              color: palette.terracotta[600],
              modules: [
                { name: t('coreTabs.discover.deepDive.modules.culturalRoutes'), route: '/rotas-culturais', icon: 'auto-awesome' as const, count: t('coreTabs.units.routes', { count: 22 }) },
                { name: t('coreTabs.discover.deepDive.modules.music'), route: '/musica', icon: 'music-note' as const, count: t('coreTabs.units.traditions', { count: 14 }) },
                { name: t('coreTabs.discover.deepDive.modules.prehistory'), route: '/prehistoria', icon: 'public' as const, count: t('coreTabs.units.sites', { count: 12 }) },
                { name: t('coreTabs.discover.deepDive.modules.economy'), route: '/economia', icon: 'storefront' as const, count: t('coreTabs.units.markets', { count: 5 }) },
                { name: t('coreTabs.discover.deepDive.modules.gastronomy'), route: '/gastronomia', icon: 'restaurant' as const, count: t('coreTabs.units.dishes', { count: 14 }) },
              ],
            },
          ].map((group) => (
            <View
              key={group.title}
              style={[{
                marginHorizontal: 16,
                marginBottom: 16,
                borderRadius: 16,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderLight,
                overflow: 'hidden',
              }]}
            >
              {/* Group header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: group.color + '18',
                  justifyContent: 'center', alignItems: 'center', marginRight: 12,
                }}>
                  <MaterialIcons name={group.icon} size={22} color={group.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }, ds.textPrimary]}>
                    {group.title}
                  </Text>
                  <Text style={[{ fontSize: 12, marginTop: 2 }, ds.textMuted]} numberOfLines={1}>
                    {group.subtitle}
                  </Text>
                </View>
              </View>
              {/* Module cards */}
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                {group.modules.map((mod, mi) => (
                  <TouchableOpacity
                    key={mod.route}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: 12, paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: mi % 2 === 0 ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent',
                    }}
                    onPress={() => router.push(mod.route)}
                    accessibilityLabel={t('coreTabs.shared.open', { name: mod.name })}
                    accessibilityRole="button"
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: group.color + '12',
                      justifyContent: 'center', alignItems: 'center', marginRight: 12,
                    }}>
                      <MaterialIcons name={mod.icon} size={18} color={group.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 14, fontWeight: '600' }, ds.textPrimary]}>{mod.name}</Text>
                      <Text style={[{ fontSize: 11, marginTop: 1 }, ds.textMuted]}>{mod.count}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Toolkit IA — for cultural agents */}
        <TouchableOpacity
          style={[styles.toolkitBanner, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={() => router.push('/content-toolkit')}
          accessibilityLabel={t('coreTabs.discover.toolkitA11y')}
          accessibilityRole="button"
        >
          <View style={[styles.toolkitIcon, { backgroundColor: (colors.primary || '#4A6741') + '18' }]}>
            <MaterialIcons name="auto-awesome" size={22} color={colors.primary || '#4A6741'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toolkitTitle, ds.textPrimary]}>{t('coreTabs.discover.toolkitTitle')}</Text>
            <Text style={[styles.toolkitSub, ds.textSecondary]}>
              {t('coreTabs.discover.toolkitSub')}
            </Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={14} color={colors.textMuted} />
        </TouchableOpacity>
        </>
        )}

        {/* Empty State */}
        {(!feedData?.items || feedData.items.length === 0) && !feedLoading && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="explore" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, ds.textPrimary]}>{t('coreTabs.discover.emptyTitle')}</Text>
            <Text style={[styles.emptySubtitle, ds.textMuted]}>{t('coreTabs.discover.emptySub')}</Text>
            <TouchableOpacity
              style={[styles.exploreButton, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/(tabs)/mapa')}
              data-testid="explore-button"
              accessibilityLabel={t('coreTabs.discover.viewMapA11y')}
              accessibilityRole="button"
            >
              <Text style={styles.exploreButtonText}>{t('coreTabs.discover.viewMap')}</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingText: { marginTop: 12, fontSize: typography.fontSize.base },
  scrollView: { flex: 1 },
  // Mobile-first: centra o feed e limita a largura em tablet/web.
  scrollContent: { paddingBottom: 20, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },

  // Pull-to-refresh indicator
  refreshIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 8,
  },
  refreshText: { fontSize: 13, fontWeight: '500' },

  // Hero
  header: { height: 200, marginBottom: -16 },
  heroImage: { flex: 1, justifyContent: 'flex-end' },
  heroImageStyle: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroGradient: { flex: 1, justifyContent: 'flex-end', padding: 20, paddingBottom: 32, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', fontFamily: serif },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  // Quick Actions
  quickActions: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 16,
    marginHorizontal: 16, borderRadius: 20,
    borderWidth: 1,
    ...shadows.lg,
  },
  actionButton: { alignItems: 'center', paddingVertical: 8 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' },

  // Profile Banner
  profileBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
  },
  profileBannerTitle: { fontSize: 14, fontWeight: '700', fontFamily: serif },
  profileBannerSub: { fontSize: 11, marginTop: 1 },

  // Widgets - compact chips
  widgetStrip: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 14, gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' },
  chipWidget: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', minWidth: 100, flex: 1 },
  chipRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  chipText: { fontSize: 13, fontWeight: '600', flex: 1 },
  chipDetail: { paddingHorizontal: 12, paddingBottom: 10, borderTopWidth: 1, paddingTop: 8, gap: 4 },
  chipDetailText: { fontSize: 12, lineHeight: 17 },
  chipDetailMuted: { fontSize: 10, marginTop: 2 },
  chipAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  chipAlertText: { fontSize: 11, flex: 1 },
  surfStats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  surfStat: { fontSize: 14, fontWeight: '700' },
  surfStatLabel: { fontSize: 10, marginRight: 6 },

  // Guia do Viajante panel
  guiaPanel: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  guiaPanelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  guiaPanelTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  guiaSectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 6, borderTopWidth: 1 },
  guiaSectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  guiaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, gap: 8, borderTopWidth: 0.5 },
  guiaLabel: { width: 140, fontSize: 11 },
  guiaValue: { flex: 1, fontSize: 11, fontWeight: '500' },

  // Section
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: serif },
  sectionPeriod: { fontSize: 12 },
  seeAll: { fontSize: 13, fontWeight: '600' },

  // Regions
  regionsRow: { paddingHorizontal: 16, gap: 12 },
  regionCard: { width: 150, height: 190, borderRadius: 18, overflow: 'hidden', ...shadows.md },
  regionImage: { flex: 1 },
  regionImageStyle: { borderRadius: 18 },
  regionGradient: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  regionContent: { gap: 2 },
  regionName: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  regionSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },

  // Universes
  universesRow: { paddingHorizontal: 16, gap: 12 },
  universeCard: { width: 130, borderRadius: 18, padding: 16, minHeight: 130, justifyContent: 'space-between' },
  universeIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  universeName: { fontSize: 13, fontWeight: '600', marginTop: 8, lineHeight: 17 },
  universeCount: { fontSize: 11, marginTop: 4 },

  // Trending
  trendingList: { paddingHorizontal: 20, gap: 8 },
  trendingCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, gap: 12, borderWidth: 1, ...shadows.sm },
  trendingRank: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  trendingRankText: { fontSize: 14, fontWeight: '700' },
  trendingImage: { width: 52, height: 52, borderRadius: 10 },
  trendingInfo: { flex: 1 },
  trendingTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  trendingMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // Discovery Cards
  horizontalScroll: { paddingHorizontal: 16, gap: 12 },
  discoveryCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, ...shadows.md },
  discoveryImage: { width: '100%', height: 130 },
  discoveryContent: { padding: 12, gap: 8 },
  discoveryTitle: { fontSize: 14, fontWeight: '600' },
  reasonBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  reasonText: { fontSize: 11 },

  // Empty State
  emptyState: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 48 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  exploreButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 24, gap: 8 },
  exploreButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // POI do Dia
  poiDiaCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  poiDiaImage: { width: '100%', height: 160 },
  poiDiaContent: { padding: 14, gap: 8 },
  poiDiaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  poiDiaBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 },
  poiDiaBadgeText: { fontSize: 11, fontWeight: '600' },
  poiDiaScoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  poiDiaScoreVal: { fontSize: 16, fontWeight: '800' },
  poiDiaName: { fontSize: 17, fontWeight: '700' },
  poiDiaDesc: { fontSize: 13, lineHeight: 19 },
  poiDiaBottom: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  poiDiaInfoText: { fontSize: 12, textTransform: 'capitalize' },
  poiDiaRarity: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 6 },
  poiDiaRarityText: { fontSize: 10, fontWeight: '600' },

  // Section link
  sectionLink: { fontSize: 13, fontWeight: '600' },

  // Timeline chips
  timelineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, marginRight: 8,
  },
  timelineEmoji: { fontSize: 16 },
  timelineLabel: { fontSize: 13, fontWeight: '600' },

  // Mission badge on quick action
  actionBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: palette.encarnado[500], borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  actionBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', paddingHorizontal: 2 },

  // Surpreende-me
  surpriseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginVertical: 8, borderRadius: 16,
    borderWidth: 1, padding: 14,
  },
  surpriseIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  surpriseThumb: { width: 56, height: 56, borderRadius: 12 },
  surpriseTitle: { fontSize: 15, fontWeight: '700' },

  // Category tabs
  categoryTabsWrap: { marginTop: 4 },
  categoryTabsContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  categoryTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  categoryTabText: { fontSize: 13, fontWeight: '600' },

  // Load more
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600' },

  // Content toolkit banner
  toolkitBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginVertical: 8,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  toolkitIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  toolkitTitle: { fontSize: 14, fontWeight: '700' },
  toolkitSub: { fontSize: 12, marginTop: 2 },
});

export default function DescobrerTabWithBoundary() {
  return (
    <ErrorBoundary>
      <DescobrerTab />
    </ErrorBoundary>
  );
}
