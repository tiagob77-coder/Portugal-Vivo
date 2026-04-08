import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Image, Dimensions, ActivityIndicator,
  ImageBackground, Animated, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SkeletonCard from '../../src/components/SkeletonCard';
import MicroStoryCard, { MicroStory } from '../../src/components/MicroStoryCard';
import {
  getDiscoveryFeed, getTrendingItems, getEncyclopediaUniverses,
  getPOIDoDia, DiscoveryFeedItem, TrendingItem, EncyclopediaUniverse,
  getWeatherForecast, getWeatherAlerts, getSafetyCheck, getActiveFires, getAllSpotsConditions,
  getSurprisePOI,
} from '../../src/services/api';
import { API_BASE } from '../../src/config/api';
import { typography, shadows, regionImages } from '../../src/theme';
import { useTheme } from '../../src/context/ThemeContext';
// OnboardingModal removed — handled by /onboarding screen

const { width } = Dimensions.get('window');
const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { greeting: 'Bom dia', period: 'morning' };
  if (hour >= 12 && hour < 19) return { greeting: 'Boa tarde', period: 'afternoon' };
  return { greeting: 'Boa noite', period: 'evening' };
};

const REGIONS = [
  { id: 'norte', name: 'Norte', subtitle: 'Montanhas e tradição', image: regionImages.norte },
  { id: 'centro', name: 'Centro', subtitle: 'Aldeias históricas', image: regionImages.centro },
  { id: 'lisboa', name: 'Lisboa', subtitle: 'Capital vibrante', image: regionImages.lisboa },
  { id: 'alentejo', name: 'Alentejo', subtitle: 'Planícies douradas', image: regionImages.alentejo },
  { id: 'algarve', name: 'Algarve', subtitle: 'Costa e falésias', image: regionImages.algarve },
  { id: 'acores', name: 'Açores', subtitle: 'Natureza vulcânica', image: regionImages.acores },
  { id: 'madeira', name: 'Madeira', subtitle: 'Ilha jardim', image: regionImages.madeira },
];

const QUICK_ACTIONS = [
  { id: 'mapa', title: 'Mapa', icon: 'map', route: '/(tabs)/mapa' },
  { id: 'planeador', title: 'Planeador', icon: 'edit-calendar', route: '/(tabs)/planeador' },
  { id: 'eventos', title: 'Eventos', icon: 'event', route: '/(tabs)/eventos' },
  { id: 'pesquisar', title: 'Pesquisar', icon: 'search', route: '/search' },
  { id: 'perto', title: 'Perto de Mim', icon: 'near-me', route: '/nearby' },
  { id: 'conquistas', title: 'Conquistas', icon: 'military-tech', route: '/gamification' },
  { id: 'album', title: 'Álbum', icon: 'photo-album', route: '/album' },
  { id: 'ranking', title: 'Ranking', icon: 'leaderboard', route: '/leaderboard' },
  { id: 'transportes', title: 'Transportes', icon: 'train', route: '/(tabs)/transportes' },
  { id: 'beachcams', title: 'Beachcams', icon: 'videocam', route: '/beachcams' },
  { id: 'agenda', title: 'Agenda', icon: 'celebration', route: '/(tabs)/eventos' },
  { id: 'planner', title: 'Viagem IA', icon: 'auto-awesome', route: '/(tabs)/planeador' },
  { id: 'coleccoes', title: 'Enciclopédia', icon: 'collections-bookmark', route: '/(tabs)/coleccoes' },
  { id: 'guia', title: 'Guia Viajante', icon: 'menu-book', route: null },
];

const PROFILE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  aventureiro: { label: 'Aventureiro', icon: 'terrain', color: '#2E5E4E' },
  gastronomo: { label: 'Gastrónomo', icon: 'restaurant', color: '#C65D3B' },
  cultural: { label: 'Cultural', icon: 'account-balance', color: '#8B6914' },
  familia: { label: 'Família', icon: 'family-restroom', color: '#5B8C5A' },
};

export default function DescobrerTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const [guiaOpen, setGuiaOpen] = useState(false);
  const [activePerfil, setActivePerfil] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [feedPage, setFeedPage] = useState(1);
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

  const { data: feedData, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
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
  const { greeting } = getGreeting();

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

  return (
    <View style={[styles.container, ds.bg]}>
      {Platform.OS === 'web' && (
        <Head>
          <title>Descobrir — Portugal Vivo | POI do Dia, Tendências e Regiões</title>
          <meta name="description" content="Descubra o melhor de Portugal hoje: o POI do Dia, locais em tendência, previsão meteorológica e sugestões por região. Tesouros que não encontra nos guias." />
          <meta property="og:title" content="Descobrir — Portugal Vivo" />
          <meta property="og:description" content="POI do Dia, tendências e sugestões personalizadas por região. Explore Portugal como nunca antes." />
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
            <Text style={[styles.refreshText, { color: colors.textMuted }]}>A descobrir novidades...</Text>
          </View>
        )}
        {/* Hero Header */}
        <View style={styles.header}>
          <ImageBackground source={{ uri: regionImages.hero }} style={styles.heroImage} imageStyle={styles.heroImageStyle}>
            <LinearGradient
              colors={isDark ? ['rgba(28,31,28,0.8)', 'rgba(28,31,28,0.5)', 'transparent'] : ['rgba(46,94,78,0.75)', 'rgba(46,94,78,0.4)', 'transparent']}
              style={styles.heroGradient}
            >
              {/* Login button top-right */}
              <TouchableOpacity
                style={{ position: 'absolute', top: 12, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 }}
                onPress={() => router.push('/(tabs)/profile' as any)}
              >
                <MaterialIcons name={token ? 'account-circle' : 'login'} size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{token ? 'Perfil' : 'Entrar'}</Text>
              </TouchableOpacity>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.headerTitle}>Descubra Portugal</Text>
              <Text style={styles.headerSubtitle}>O patrimonio vivo do nosso pais</Text>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* Quick Actions Grid */}
        <View style={[styles.quickActions, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} data-testid="quick-actions-grid">
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionButton}
              onPress={() => {
                if (action.id === 'guia') { setGuiaOpen(!guiaOpen); return; }
                if (action.route) router.push(action.route as any);
              }}
              data-testid={`action-${action.id}`}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name={action.icon as any} size={20} color={colors.primary} />
                {action.id === 'conquistas' && claimableMissions > 0 && (
                  <View style={styles.actionBadge}><Text style={styles.actionBadgeText}>{claimableMissions}</Text></View>
                )}
              </View>
              <Text style={[styles.actionText, ds.textSecondary]} numberOfLines={1}>{action.title}</Text>
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
                Sugestões para {PROFILE_LABELS[activePerfil].label}
              </Text>
              <Text style={[styles.profileBannerSub, { color: colors.textMuted }]}>
                Feed personalizado ao seu perfil
              </Text>
            </View>
            <TouchableOpacity onPress={() => setActivePerfil(null)} data-testid="clear-profile-btn">
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Guia do Viajante Panel (expandable) */}
        {guiaOpen && (
          <View style={[styles.guiaPanel, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} data-testid="guia-viajante-panel">
            <View style={styles.guiaPanelHeader}>
              <MaterialIcons name="menu-book" size={18} color={colors.primary} />
              <Text style={[styles.guiaPanelTitle, { color: colors.textPrimary }]}>Guia do Viajante - Portugal</Text>
              <TouchableOpacity onPress={() => setGuiaOpen(false)} data-testid="close-guia">
                <MaterialIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Informacoes Essenciais */}
            <View style={[styles.guiaSectionHeader, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="info" size={14} color={colors.accent} />
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>Informacoes Essenciais</Text>
            </View>
            {[
              { icon: 'language', label: 'Idioma Oficial', value: 'Portugues' },
              { icon: 'payments', label: 'Moeda', value: 'Euro (EUR)' },
              { icon: 'schedule', label: 'Fuso Horario', value: 'WET (UTC+0) / WEST (UTC+1 verao)' },
              { icon: 'electrical-services', label: 'Tomadas', value: 'Tipo F, 230V 50Hz' },
              { icon: 'local-drink', label: 'Agua da torneira', value: 'Segura para beber em todo o pais' },
              { icon: 'directions-car', label: 'Conduzir', value: 'Lado direito. Carta EU aceite.' },
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
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>Melhor Epoca para Visitar</Text>
            </View>
            {[
              { icon: 'calendar-today', label: 'Primavera (Mar-Mai)', value: 'Ideal. Tempo ameno, poucos turistas' },
              { icon: 'wb-sunny', label: 'Verao (Jun-Ago)', value: 'Quente, praias. Muito turistico' },
              { icon: 'eco', label: 'Outono (Set-Nov)', value: 'Excelente. Vindimas, cores, bom tempo' },
              { icon: 'ac-unit', label: 'Inverno (Dez-Fev)', value: 'Suave no sul, neve na Serra da Estrela' },
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
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>Custos Medios</Text>
            </View>
            {[
              { icon: 'restaurant', label: 'Refeicao (restaurante)', value: '8-15 EUR' },
              { icon: 'local-cafe', label: 'Cafe + pastel de nata', value: '1.50-2.50 EUR' },
              { icon: 'hotel', label: 'Hotel (2 estrelas)', value: '40-80 EUR/noite' },
              { icon: 'apartment', label: 'Hotel (4 estrelas)', value: '80-150 EUR/noite' },
              { icon: 'directions-bus', label: 'Transporte publico', value: '1.50-3 EUR/viagem' },
              { icon: 'local-gas-station', label: 'Gasolina', value: '~1.60 EUR/litro' },
              { icon: 'local-bar', label: 'Cerveja (bar)', value: '1.50-3 EUR' },
              { icon: 'favorite', label: 'Gorjetas', value: '5-10% (opcional, arredondamento)' },
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
              <Text style={[styles.guiaSectionTitle, { color: colors.error }]}>Saude e Seguranca</Text>
            </View>
            {[
              { icon: 'emergency', label: 'Emergencia geral', value: '112' },
              { icon: 'local-police', label: 'Policia (PSP)', value: '112 / 21 765 42 42' },
              { icon: 'fire-truck', label: 'Bombeiros', value: '117' },
              { icon: 'local-hospital', label: 'Saude 24', value: '808 24 24 24' },
              { icon: 'health-and-safety', label: 'Cartao Europeu Saude', value: 'Aceite em hospitais publicos (EU)' },
              { icon: 'verified-user', label: 'Seguranca geral', value: 'Pais muito seguro para turistas' },
              { icon: 'warning', label: 'Cuidados', value: 'Carteiristas em zonas turisticas' },
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
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>Transportes</Text>
            </View>
            {[
              { icon: 'train', label: 'Comboios (CP)', value: 'Rede nacional, Alfa Pendular rapido' },
              { icon: 'directions-bus', label: 'Autocarros (Rede Expressos)', value: 'Cobertura nacional, economico' },
              { icon: 'subway', label: 'Metro', value: 'Lisboa (4 linhas) e Porto (6 linhas)' },
              { icon: 'local-taxi', label: 'Taxi / TVDE', value: 'Uber e Bolt disponiveis' },
              { icon: 'directions-boat', label: 'Ferries', value: 'Ligacoes fluviais em Lisboa e Porto' },
              { icon: 'flight', label: 'Voos internos', value: 'TAP para Madeira e Acores' },
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
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>Cultura e Etiqueta</Text>
            </View>
            {[
              { icon: 'waving-hand', label: 'Cumprimento', value: 'Aperto de mao, 2 beijos entre amigos' },
              { icon: 'schedule', label: 'Horario refeicoes', value: 'Almoco 12-14h, Jantar 19:30-21:30' },
              { icon: 'store', label: 'Horario comercio', value: 'Seg-Sab 9-19h. Centros ate 23h' },
              { icon: 'no-photography', label: 'Fotografias', value: 'Pedir autorizacao em igrejas e museus' },
              { icon: 'smoking-rooms', label: 'Fumar', value: 'Proibido em espacos fechados' },
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
              <Text style={[styles.guiaSectionTitle, { color: colors.accent }]}>Documentacao</Text>
            </View>
            {[
              { icon: 'public', label: 'Cidadaos EU/EEE', value: 'BI ou passaporte valido' },
              { icon: 'flight-land', label: 'Cidadaos fora EU', value: 'Passaporte. Visto Schengen se aplicavel' },
              { icon: 'receipt-long', label: 'Tax Free', value: 'Compras > 50 EUR (residentes fora EU)' },
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
          >
            <View style={styles.chipRow}>
              <MaterialIcons
                name={safetyData?.safety_level === 'danger' ? 'error' : safetyData?.safety_level === 'warning' ? 'warning' : 'check-circle'}
                size={16}
                color={safetyData?.safety_level === 'danger' ? colors.error : safetyData?.safety_level === 'warning' ? colors.warning : colors.success}
              />
              <Text style={[styles.chipText, { color: colors.textPrimary }]} numberOfLines={1}>
                {safetyData?.safety_level === 'danger' ? 'Perigo' : safetyData?.safety_level === 'warning' ? 'Atencao' : 'Seguro'}
              </Text>
              <MaterialIcons name={expandedWidget === 'safety' ? 'expand-less' : 'expand-more'} size={16} color={colors.textMuted} />
            </View>
            {expandedWidget === 'safety' && (
              <View style={[styles.chipDetail, { borderTopColor: colors.borderLight }]}>
                {safetyData?.message && <Text style={[styles.chipDetailText, { color: colors.textSecondary }]}>{safetyData.message}</Text>}
                {((firesData as any)?.active_count || 0) > 0 && (
                  <Text style={[styles.chipDetailText, { color: colors.textSecondary }]}>{(firesData as any).active_count} incendios ativos</Text>
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
                <Text style={[styles.chipDetailText, { color: colors.textSecondary }]}>{surfData.spots[0].spot?.name || 'Melhor Spot'}</Text>
                <View style={styles.surfStats}>
                  <Text style={[styles.surfStat, { color: colors.textPrimary }]}>{surfData.spots[0].wave_height_m?.toFixed(1)}m</Text>
                  <Text style={[styles.surfStatLabel, { color: colors.textMuted }]}>Altura</Text>
                  <Text style={[styles.surfStat, { color: colors.textPrimary }]}>{surfData.spots[0].wave_period_s?.toFixed(0)}s</Text>
                  <Text style={[styles.surfStatLabel, { color: colors.textMuted }]}>Periodo</Text>
                  <Text style={[styles.surfStat, { color: colors.textPrimary }]}>{surfData.spots[0].wave_direction || '--'}</Text>
                  <Text style={[styles.surfStatLabel, { color: colors.textMuted }]}>Dir.</Text>
                </View>
                <Text style={[styles.chipDetailMuted, { color: colors.textMuted }]}>Open-Meteo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* POI do Dia */}
        {poiDoDia?.has_poi && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="auto-awesome" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, ds.textPrimary]}>POI do Dia</Text>
              </View>
              <Text style={[styles.seeAll, { color: colors.textMuted, fontSize: 11 }]}>{poiDoDia.category_label}</Text>
            </View>
            <TouchableOpacity
              style={[styles.poiDiaCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
              onPress={() => router.push(`/heritage/${poiDoDia.poi.id}`)}
              activeOpacity={0.85}
              data-testid="poi-do-dia-card"
            >
              {/* Placeholder for future real image */}
              <View style={[styles.poiDiaImagePlaceholder, { backgroundColor: isDark ? colors.surfaceAlt : colors.backgroundAlt }]}>
                <MaterialIcons name={poiDoDia.category_icon as any || 'place'} size={32} color={colors.accent} />
                <Text style={[styles.poiDiaImageHint, { color: colors.textMuted }]}>Foto brevemente</Text>
              </View>
              <View style={styles.poiDiaContent}>
                <View style={styles.poiDiaTop}>
                  <View style={[styles.poiDiaBadge, { backgroundColor: colors.accent + '18' }]}>
                    <MaterialIcons name="auto-awesome" size={12} color={colors.accent} />
                    <Text style={[styles.poiDiaBadgeText, { color: colors.accent }]}>Destaque IQ</Text>
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
            <Text style={[styles.sectionTitle, ds.textPrimary]}>Explorar por Região</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/mapa')}>
              <Text style={[styles.seeAll, { color: colors.accent }]}>Ver Mapa</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionsRow}>
            {REGIONS.map((region) => (
              <TouchableOpacity
                key={region.id}
                style={styles.regionCard}
                onPress={() => router.push(`/(tabs)/mapa?region=${region.id}&t=${Date.now()}` as any)}
                activeOpacity={0.9}
                data-testid={`region-card-${region.id}`}
              >
                <ImageBackground source={{ uri: region.image }} style={styles.regionImage} imageStyle={styles.regionImageStyle}>
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.regionGradient}>
                    <View style={styles.regionContent}>
                      <Text style={styles.regionName}>{region.name}</Text>
                      <Text style={styles.regionSubtitle}>{region.subtitle}</Text>
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
                <MaterialIcons name="auto-awesome" size={18} color="#8E24AA" />
                <Text style={[styles.sectionTitle, ds.textPrimary]}>Enciclopedia Viva</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/coleccoes' as any)}>
                <Text style={[styles.seeAll, { color: colors.accent }]}>Ver Todos</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.universesRow}>
              {universesData.map((universe: EncyclopediaUniverse) => (
                <TouchableOpacity
                  key={universe.id}
                  style={[styles.universeCard, { backgroundColor: (universe.color || colors.primary) + (isDark ? '20' : '10') }]}
                  onPress={() => router.push('/(tabs)/coleccoes' as any)}
                  activeOpacity={0.8}
                  data-testid={`universe-card-${universe.id}`}
                >
                  <View style={[styles.universeIcon, { backgroundColor: universe.color || colors.primary }]}>
                    <MaterialIcons name={(universe.icon || 'place') as any} size={22} color="#FFF" />
                  </View>
                  <Text style={[styles.universeName, ds.textPrimary]} numberOfLines={2}>{universe.name}</Text>
                  <Text style={[styles.universeCount, ds.textMuted]}>{universe.item_count} locais</Text>
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
        >
          {surpriseLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : surprisePOI ? (
            <>
              <View style={[styles.surpriseIcon, { backgroundColor: colors.accent + '20' }]}>
                <MaterialIcons name="auto-awesome" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.accent, marginBottom: 2 }]}>LUGAR ESCONDIDO</Text>
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
                <Text style={[styles.surpriseTitle, ds.textPrimary]}>Surpreende-me</Text>
                <Text style={[{ fontSize: 12, color: colors.textMuted }]}>Descobre um lugar escondido</Text>
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
                <Text style={[styles.sectionTitle, ds.textPrimary]}>Em Tendencia</Text>
              </View>
              <Text style={[styles.sectionPeriod, ds.textMuted]}>7 dias</Text>
            </View>
            <View style={styles.trendingList}>
              {trendingData.items.slice(0, 5).map((item: TrendingItem, index: number) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.trendingCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                  onPress={() => router.push(`/heritage/${item.id}`)}
                  activeOpacity={0.8}
                  data-testid={`trending-card-${item.id}`}
                >
                  <View style={[styles.trendingRank, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.trendingRankText, { color: colors.primary }]}>{index + 1}</Text>
                  </View>
                  <Image source={{ uri: item.image_url || 'https://via.placeholder.com/80' }} style={styles.trendingImage} />
                  <View style={styles.trendingInfo}>
                    <Text style={[styles.trendingTitle, ds.textPrimary]} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.trendingMeta}>
                      <MaterialIcons name="trending-up" size={14} color={colors.success} />
                      <Text style={{ fontSize: 12, color: colors.success }}>{item.trending_score} visitas</Text>
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
              { id: 'todos', label: 'Para Ti', icon: 'person' },
              { id: 'nearby', label: 'Próximo', icon: 'near-me' },
              { id: 'stories', label: 'Histórias', icon: 'auto-stories' },
              { id: 'trails', label: 'Trilhos', icon: 'directions-walk' },
              { id: 'events', label: 'Eventos', icon: 'event' },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryTab,
                  { backgroundColor: activeCategory === cat.id ? colors.accent : colors.surface, borderColor: activeCategory === cat.id ? colors.accent : colors.borderLight },
                ]}
                onPress={() => { setActiveCategory(cat.id); setFeedPage(1); }}
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
                <Text style={[styles.sectionTitle, ds.textPrimary]}>Para Si</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {groupedFeed['for_you'].slice(0, 6 * feedPage).map((item: DiscoveryFeedItem) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.discoveryCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                  onPress={() => router.push(`/heritage/${item.content_id}`)}
                  activeOpacity={0.8}
                  data-testid={`discovery-card-${item.content_id}`}
                >
                  <Image source={{ uri: item.content_data.image_url || 'https://via.placeholder.com/300x200' }} style={styles.discoveryImage} />
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
              >
                <Text style={[styles.loadMoreText, { color: colors.accent }]}>Carregar mais</Text>
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
                <Text style={[styles.sectionTitle, ds.textPrimary]}>Micro-histórias</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/search' as any)}>
                <Text style={[styles.sectionLink, { color: colors.accent }]}>Ver mais</Text>
              </TouchableOpacity>
            </View>
            {microStoriesData.stories.map((story: MicroStory) => (
              <MicroStoryCard
                key={story.poi_id}
                story={story}
                onPress={() => router.push(`/heritage/${story.poi_id}` as any)}
                onQueroSaberMais={(id) => router.push(`/heritage/${id}` as any)}
              />
            ))}
          </View>
        )}

        {/* Linha do Tempo — quick access by region */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="history-edu" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, ds.textPrimary]}>Linha do Tempo</Text>
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
                onPress={() => router.push(`/timeline/${r.id}` as any)}
              >
                <Text style={styles.timelineEmoji}>{r.emoji}</Text>
                <Text style={[styles.timelineLabel, ds.textPrimary]}>{r.label}</Text>
                <MaterialIcons name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── Explorar em Profundidade ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialIcons name="auto-awesome-mosaic" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, ds.textPrimary]}>Explorar em Profundidade</Text>
            </View>
          </View>
          {[
            {
              title: 'Mar & Costa',
              subtitle: 'Zonas costeiras, biodiversidade marinha e cultura do mar',
              icon: 'sailing' as const,
              color: '#0891B2',
              modules: [
                { name: 'Costa de Portugal', route: '/costa', icon: 'waves' as const, count: '10 zonas' },
                { name: 'Biodiversidade Marinha', route: '/biodiversidade', icon: 'water' as const, count: '10 spots' },
                { name: 'Cultura Marítima', route: '/cultura-maritima', icon: 'anchor' as const, count: '14 tradições' },
              ],
            },
            {
              title: 'Natureza Viva',
              subtitle: 'Flora endémica, fauna e infraestruturas naturais',
              icon: 'eco' as const,
              color: '#059669',
              modules: [
                { name: 'Flora Endémica', route: '/flora', icon: 'local-florist' as const, count: '8 espécies' },
                { name: 'Fauna & Habitats', route: '/fauna', icon: 'pets' as const, count: '8 espécies' },
                { name: 'Infraestrutura Natural', route: '/infraestrutura', icon: 'terrain' as const, count: '14 locais' },
              ],
            },
            {
              title: 'Património & Cultura',
              subtitle: 'Música, pré-história, astronomia e economia local',
              icon: 'account-balance' as const,
              color: '#B45309',
              modules: [
                { name: 'Rotas Culturais', route: '/rotas-culturais', icon: 'auto-awesome' as const, count: '11 rotas' },
                { name: 'Música Tradicional', route: '/musica', icon: 'music-note' as const, count: '14 tradições' },
                { name: 'Pré-História & Astronomia', route: '/prehistoria', icon: 'public' as const, count: '12 sítios' },
                { name: 'Economia Local', route: '/economia', icon: 'storefront' as const, count: '5 mercados' },
                { name: 'Atlas Gastronómico', route: '/gastronomia', icon: 'restaurant' as const, count: '14 pratos' },
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
                    onPress={() => router.push(mod.route as any)}
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
          onPress={() => router.push('/content-toolkit' as any)}
        >
          <View style={[styles.toolkitIcon, { backgroundColor: (colors.primary || '#4A6741') + '18' }]}>
            <MaterialIcons name="auto-awesome" size={22} color={colors.primary || '#4A6741'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toolkitTitle, ds.textPrimary]}>Toolkit IA para Agentes Culturais</Text>
            <Text style={[styles.toolkitSub, ds.textSecondary]}>
              Cria e enriquece conteúdo cultural com IA
            </Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Empty State */}
        {(!feedData?.items || feedData.items.length === 0) && !feedLoading && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="explore" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, ds.textPrimary]}>Comece a Explorar</Text>
            <Text style={[styles.emptySubtitle, ds.textMuted]}>Visite locais para receber recomendacoes personalizadas</Text>
            <TouchableOpacity
              style={[styles.exploreButton, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/(tabs)/mapa')}
              data-testid="explore-button"
            >
              <Text style={styles.exploreButtonText}>Ver Mapa</Text>
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
  scrollContent: { paddingBottom: 20 },

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
  actionButton: { alignItems: 'center', width: (width - 64) / 6, paddingVertical: 8 },
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
  discoveryCard: { width: width * 0.58, borderRadius: 18, overflow: 'hidden', borderWidth: 1, ...shadows.md },
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
  poiDiaImagePlaceholder: { height: 120, justifyContent: 'center', alignItems: 'center', gap: 6 },
  poiDiaImageHint: { fontSize: 10 },
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
    backgroundColor: '#EF4444', borderRadius: 8,
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
