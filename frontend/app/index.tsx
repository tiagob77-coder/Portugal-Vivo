import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView,
  ImageBackground, Animated, TextInput, StatusBar, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStats, getTopScoredItems, getStories, TopScoredItem, StoryItem } from '../src/services/api';
import { regionImages, colors as themeColors } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import { palette, categoryColors, withOpacity } from '../src/theme/colors';

const { width } = Dimensions.get('window');

// ============ Design System Constants ============
// Typography scale (from typography.ts)
const typography = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.3 },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  h4: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.2 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  overline: { fontSize: 10, lineHeight: 12, fontWeight: '600' as const, letterSpacing: 1, textTransform: 'uppercase' as const },
  stat: { fontSize: 28, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
};

// Spacing scale (from spacing.ts)
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

// Border radius (from spacing.ts)
const borderRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
  full: 9999,
};

// Shadows (from spacing.ts)
const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
};

// Color aliases for backward compatibility - maps to design system
const C = {
  bg: palette.gray[50],
  textLight: palette.gray[500],
  textMuted: palette.gray[400],
  statGreen: palette.forest[600],
  statOrange: palette.terracotta[500],
  statBlue: palette.ocean[500],
  forestLight: palette.forest[500],
  mint: palette.forest[200],
};

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

const headingFont = Platform.OS === 'web' ? 'Playfair Display, Georgia, serif' : undefined;
const bodyFont = Platform.OS === 'web' ? 'DM Sans, system-ui, sans-serif' : undefined;

const HERO_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Ribeira_do_Porto_%28Portugal%29.jpg/1280px-Ribeira_do_Porto_%28Portugal%29.jpg';

const REGIONS = [
  { id: 'norte', name: 'Norte', desc: 'Do Minho ao Douro, granito e vinho verde', items: 714 },
  { id: 'centro', name: 'Centro', desc: 'Serras, aldeias históricas e tradições vivas', items: 704 },
  { id: 'lisboa', name: 'Lisboa', desc: 'Capital de luz, fado e azulejos', items: 310 },
  { id: 'alentejo', name: 'Alentejo', desc: 'Planícies douradas, cortiça e silêncio', items: 280 },
  { id: 'algarve', name: 'Algarve', desc: 'Falésias, mar turquesa e cataplanas', items: 123 },
  { id: 'acores', name: 'Açores', desc: 'Vulcões, lagoas e verde infinito', items: 95 },
  { id: 'madeira', name: 'Madeira', desc: 'Laurissilva, levadas e flores', items: 85 },
];

const ACTION_CARDS = [
  {
    id: 'nearby',
    title: 'Perto de Mim',
    desc: 'Descobre o que está à tua volta',
    icon: 'place',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Pena_Palace_in_Sintra_-_panorama_%28cropped%29.jpg/640px-Pena_Palace_in_Sintra_-_panorama_%28cropped%29.jpg',
    route: '/(tabs)/mapa',
    color: palette.terracotta[500],
  },
  {
    id: 'explore',
    title: 'Explorar Património',
    desc: 'Caminha por vilas onde o tempo parou',
    icon: 'account-balance',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Panorama_of_Lisbon_%2811977231484%29.jpg/640px-Panorama_of_Lisbon_%2811977231484%29.jpg',
    route: '/(tabs)/descobrir',
    color: palette.forest[500],
  },
  {
    id: 'gastro',
    title: 'Gastronomia',
    desc: 'Sabores autênticos de cada região',
    icon: 'restaurant',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Douro_Vinhateiro2.jpg/640px-Douro_Vinhateiro2.jpg',
    route: '/(tabs)/descobrir',
    color: categoryColors.gastronomia,
  },
  {
    id: 'trails',
    title: 'Trilhos & Natureza',
    desc: 'Percursos entre serras e rios',
    icon: 'terrain',
    image: regionImages.acores,
    route: '/(tabs)/mapa',
    color: categoryColors.trilhos,
  },
];

const NEWSLETTER_INTERESTS = ['Natureza', 'Património', 'Gastronomia', 'Praias', 'Trilhos', 'Eventos', 'Termas', 'Surf'];

const NAV_ITEMS = ['Mapa', 'Regiões', 'Categorias', 'Tesouros', 'Newsletter'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

// Styles using design system directly
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.gray[50] },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['2xl'] },

  nav: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: spacing.base, 
    paddingVertical: spacing.md, 
    marginBottom: spacing.xs 
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: borderRadius.md, 
    backgroundColor: palette.forest[500], 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  logoText: { 
    ...typography.h4,
    color: palette.forest[700], 
    fontFamily: headingFont 
  },
  navLinks: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 28 },
  navLink: {},
  navLinkText: { 
    ...typography.bodySmall,
    color: palette.gray[600], 
    fontWeight: '500', 
    fontFamily: bodyFont 
  },
  profileBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: borderRadius.pill, 
    backgroundColor: palette.forest[500], 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  heroSection: { paddingHorizontal: spacing.base, marginBottom: spacing.xl },
  heroImage: { height: 320, marginBottom: spacing.base },
  heroGrad: { flex: 1, borderRadius: borderRadius.xl, justifyContent: 'flex-end', paddingBottom: 0 },
  heroContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.base },
  greeting: { 
    ...typography.bodySmall,
    color: palette.forest[500], 
    fontWeight: '600', 
    marginBottom: spacing.xs, 
    fontFamily: bodyFont 
  },
  heroTitle: { 
    ...typography.h1,
    color: palette.gray[900], 
    marginBottom: spacing.sm, 
    fontFamily: headingFont 
  },
  heroSub: { 
    ...typography.body,
    color: palette.gray[600], 
    fontFamily: bodyFont 
  },

  searchWrap: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: palette.white, 
    borderRadius: borderRadius.lg, 
    paddingHorizontal: spacing.base, 
    paddingVertical: spacing.md, 
    gap: spacing.md, 
    marginBottom: spacing.base, 
    borderWidth: 1, 
    borderColor: palette.gray[200], 
    ...shadows.sm
  },
  searchInput: { 
    flex: 1, 
    ...typography.body,
    color: palette.gray[900], 
    fontFamily: bodyFont 
  },

  statsRow: { flexDirection: 'row', gap: spacing.md },
  statBox: { 
    flex: 1, 
    borderRadius: borderRadius.lg, 
    paddingVertical: spacing.base, 
    paddingHorizontal: spacing.md, 
    alignItems: 'center', 
    gap: spacing.xs 
  },
  statVal: { 
    ...typography.stat,
    fontFamily: headingFont 
  },
  statLabel: { 
    ...typography.caption,
    color: palette.gray[600], 
    fontWeight: '500', 
    fontFamily: bodyFont 
  },

  section: { paddingHorizontal: spacing.base, marginBottom: spacing['2xl'] },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    marginBottom: spacing.base 
  },
  sectionLabel: { 
    ...typography.label,
    color: palette.forest[500], 
    marginBottom: spacing.xs, 
    fontFamily: bodyFont 
  },
  sectionTitle: { 
    ...typography.h2,
    color: palette.gray[900], 
    marginBottom: spacing.xs, 
    fontFamily: headingFont 
  },
  sectionSub: { 
    ...typography.body,
    color: palette.gray[600], 
    marginBottom: spacing.base, 
    fontFamily: bodyFont 
  },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.xs },
  seeAllText: { 
    ...typography.bodySmall,
    color: palette.forest[500], 
    fontWeight: '600', 
    fontFamily: bodyFont 
  },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCard: { height: 180, borderRadius: borderRadius.lg, overflow: 'hidden' },
  actionCardBg: { flex: 1 },
  actionCardGrad: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    padding: spacing.md, 
    borderRadius: borderRadius.lg 
  },
  actionIconWrap: { 
    width: 34, 
    height: 34, 
    borderRadius: borderRadius.md, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: spacing.sm 
  },
  actionTitle: { 
    ...typography.h4,
    color: '#FFF', 
    fontFamily: headingFont 
  },
  actionDesc: { 
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)', 
    marginTop: spacing.xs, 
    fontFamily: bodyFont 
  },

  regionScroll: { gap: spacing.md, paddingRight: spacing.base },
  regionCard: { width: 260, height: 180, borderRadius: borderRadius.lg, overflow: 'hidden' },
  regionCardBg: { flex: 1 },
  regionCardGrad: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    padding: spacing.md, 
    borderRadius: borderRadius.lg 
  },
  regionName: { 
    ...typography.h3,
    color: '#FFF', 
    fontFamily: headingFont 
  },
  regionDesc: { 
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)', 
    marginTop: spacing.xs, 
    fontFamily: bodyFont 
  },
  regionStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  regionStatText: { ...typography.caption, color: palette.forest[200] },


  descScroll: { gap: spacing.md, paddingRight: spacing.base },
  descCard: { width: 200, height: 240, borderRadius: borderRadius.lg, overflow: 'hidden' },
  descCardBg: { flex: 1 },
  descCardGrad: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    padding: spacing.md, 
    borderRadius: borderRadius.lg 
  },
  descBadge: { 
    backgroundColor: palette.forest[500], 
    alignSelf: 'flex-start', 
    paddingHorizontal: spacing.sm, 
    paddingVertical: spacing.xs, 
    borderRadius: borderRadius.md, 
    marginBottom: spacing.sm 
  },
  descBadgeText: { 
    ...typography.overline,
    color: '#FFF', 
    fontFamily: bodyFont 
  },
  descCardTitle: { 
    ...typography.h4,
    color: '#FFF', 
    fontFamily: headingFont 
  },
  descCardRegion: { 
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)', 
    marginTop: spacing.xs, 
    fontFamily: bodyFont 
  },

  storyScroll: { gap: spacing.base, paddingRight: spacing.base },
  storyCard: { 
    width: 280, 
    borderRadius: borderRadius.lg, 
    overflow: 'hidden', 
    backgroundColor: palette.white, 
    borderWidth: 1, 
    borderColor: palette.gray[200] 
  },
  storyCardImg: { height: 140 },
  storyCardImgGrad: { flex: 1, justifyContent: 'flex-end', padding: spacing.md },
  storyBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyRegionBadge: { 
    backgroundColor: withOpacity(palette.forest[500], 0.85), 
    paddingHorizontal: spacing.sm, 
    paddingVertical: spacing.xs, 
    borderRadius: borderRadius.md 
  },
  storyRegionText: { 
    ...typography.caption,
    color: '#FFF', 
    fontWeight: '700', 
    fontFamily: bodyFont 
  },
  storyReadTime: { 
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)', 
    fontFamily: bodyFont 
  },
  storyContent: { padding: spacing.md },
  storyTitle: { 
    ...typography.h4,
    color: palette.gray[900], 
    marginBottom: spacing.xs, 
    fontFamily: headingFont 
  },
  storyDesc: { 
    ...typography.bodySmall,
    color: palette.gray[600], 
    marginBottom: spacing.sm, 
    fontFamily: bodyFont 
  },
  storyFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  storyReadMore: { 
    ...typography.bodySmall,
    color: palette.forest[500], 
    fontWeight: '600', 
    fontFamily: bodyFont 
  },

  nlSection: { 
    marginHorizontal: spacing.base, 
    backgroundColor: palette.forest[700], 
    borderRadius: borderRadius.xl, 
    padding: spacing.xl, 
    marginBottom: spacing['2xl'] 
  },
  nlContent: { maxWidth: 500 },
  nlTitle: { 
    ...typography.h3,
    color: '#FFF', 
    marginBottom: spacing.sm, 
    fontFamily: headingFont 
  },
  nlSub: { 
    ...typography.body,
    color: 'rgba(255,255,255,0.7)', 
    marginBottom: spacing.base, 
    fontFamily: bodyFont 
  },
  nlInterests: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.base },
  nlChip: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.xs, 
    borderRadius: borderRadius.pill, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.25)' 
  },
  nlChipText: { 
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)', 
    fontFamily: bodyFont 
  },
  nlInputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  nlInput: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    borderRadius: borderRadius.md, 
    paddingHorizontal: spacing.base, 
    paddingVertical: spacing.md, 
    ...typography.body,
    color: '#FFF', 
    fontFamily: bodyFont 
  },
  nlBtn: { 
    backgroundColor: palette.terracotta[500], 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.md, 
    borderRadius: borderRadius.md, 
    justifyContent: 'center' 
  },
  nlBtnText: { 
    color: '#FFF', 
    ...typography.button,
    fontFamily: bodyFont 
  },
  nlDisclaimer: { 
    ...typography.caption,
    color: 'rgba(255,255,255,0.4)', 
    fontFamily: bodyFont 
  },

  footer: { 
    marginHorizontal: spacing.base, 
    borderTopWidth: 1, 
    borderTopColor: palette.gray[200], 
    paddingTop: spacing['2xl'], 
    paddingBottom: spacing.base 
  },
  footerTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 40, marginBottom: spacing.xl },
  footerBrand: { flex: 1, minWidth: 200 },
  footerLogoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  footerLogo: { 
    ...typography.h4,
    color: palette.gray[900], 
    fontFamily: headingFont 
  },
  footerDesc: { 
    ...typography.bodySmall,
    color: palette.gray[600], 
    maxWidth: 300, 
    fontFamily: bodyFont 
  },
  footerCol: { minWidth: 120 },
  footerColTitle: { 
    ...typography.label,
    color: palette.forest[500], 
    marginBottom: spacing.md, 
    fontFamily: bodyFont 
  },
  footerLink: { 
    ...typography.bodySmall,
    color: palette.gray[600], 
    marginBottom: spacing.sm, 
    fontFamily: bodyFont 
  },
  footerBottom: { 
    borderTopWidth: 1, 
    borderTopColor: palette.gray[200], 
    paddingTop: spacing.base, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    flexWrap: 'wrap' 
  },
  footerCopy: { 
    ...typography.caption,
    color: palette.gray[500], 
    fontFamily: bodyFont 
  },
  footerMade: { 
    ...typography.caption,
    color: palette.gray[500], 
    fontFamily: bodyFont 
  },
});

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const { colors } = useTheme();
  
  // Direct design system usage - no intermediate object needed
  const s = styles;

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const { data: topScored } = useQuery({ queryKey: ['top-scored'], queryFn: getTopScoredItems });
  const { data: stories } = useQuery({ queryKey: ['stories'], queryFn: getStories });

  useEffect(() => {
    AsyncStorage.getItem('onboarding_complete').then((done) => {
      if (!done) router.replace('/onboarding');
    });
  }, [router]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const isWide = width > 768;
  const greeting = getGreeting();

  const descobertas = topScored && topScored.length > 0
    ? topScored.slice(0, 6).map((item: TopScoredItem) => ({
        id: item.id,
        title: item.name,
        cat: item.main_category_name || item.category_name,
        image: item.image_url,
        region: item.region || '',
        iqScore: item.iq_score,
      }))
    : [];

  return (
    <View style={s.container} data-testid="landing-page">
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView style={s.scroll} contentContainerStyle={[s.scrollContent, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>

        <View style={s.nav} data-testid="nav-bar">
          <TouchableOpacity style={s.logoWrap} onPress={() => router.replace('/(tabs)')}>
            <View style={s.logoIcon}>
              <MaterialIcons name="terrain" size={18} color="#FFF" />
            </View>
            <Text style={s.logoText}>Portugal Vivo</Text>
          </TouchableOpacity>
          {isWide && (
            <View style={s.navLinks}>
              {NAV_ITEMS.map((item) => (
                <TouchableOpacity key={item} style={s.navLink}>
                  <Text style={s.navLinkText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => router.push('/(tabs)/profile' as any)}
            data-testid="connect-btn"
          >
            <MaterialIcons name="person" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={s.heroSection}>
          <ImageBackground
            source={{ uri: HERO_IMAGE }}
            style={s.heroImage}
            imageStyle={{ borderRadius: 24 }}
          >
            <LinearGradient
              colors={['rgba(30,58,63,0.15)', 'rgba(30,58,63,0.4)', withOpacity(C.bg, 0.95), C.bg]}
              locations={[0, 0.35, 0.7, 0.9]}
              style={s.heroGrad}
            >
              <Animated.View style={[s.heroContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <Text style={s.greeting} data-testid="greeting">{greeting}, explorador</Text>
                <Text style={s.heroTitle} data-testid="hero-title">Bem-vindo à tua{'\n'}jornada portuguesa</Text>
                <Text style={s.heroSub}>Descobre histórias antigas, sabores únicos e{'\n'}caminhos onde o tempo parou</Text>
              </Animated.View>
            </LinearGradient>
          </ImageBackground>

          <View style={s.searchWrap} data-testid="search-bar">
            <MaterialIcons name="search" size={22} color={C.textLight} />
            <TextInput
              style={s.searchInput}
              placeholder="O que procuras em Portugal?"
              placeholderTextColor={C.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => searchQuery && router.push(`/search?q=${encodeURIComponent(searchQuery)}`)}
              returnKeyType="search"
            />
          </View>

          <View style={s.statsRow} data-testid="stats-row">
            <View style={[s.statBox, { backgroundColor: palette.forest[50] }]}>
              <MaterialIcons name="place" size={20} color={C.statGreen} />
              <Text style={[s.statVal, { color: C.statGreen }]}>
                {stats?.total_items ? stats.total_items.toLocaleString('pt-PT') : '5.678'}
              </Text>
              <Text style={s.statLabel}>lugares</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: palette.terracotta[50] }]}>
              <MaterialIcons name="explore" size={20} color={C.statOrange} />
              <Text style={[s.statVal, { color: C.statOrange }]}>
                {stats?.total_routes || '20'}
              </Text>
              <Text style={s.statLabel}>aventuras</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: palette.ocean[50] }]}>
              <MaterialIcons name="flag" size={20} color={C.statBlue} />
              <Text style={[s.statVal, { color: C.statBlue }]}>
                {stats?.regions?.length || '7'}
              </Text>
              <Text style={s.statLabel}>regiões</Text>
            </View>
          </View>
        </View>

        <View style={s.section} data-testid="aventura-section">
          <Text style={s.sectionTitle}>Começa a tua aventura</Text>
          <Text style={s.sectionSub}>Escolhe o que o coração te pedir</Text>

          <View style={s.actionGrid}>
            {ACTION_CARDS.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[s.actionCard, { width: isWide ? (width - 80) / 4 - 12 : (width - 52) / 2 }]}
                activeOpacity={0.85}
                onPress={() => router.push(card.route as any)}
                data-testid={`action-${card.id}`}
              >
                <ImageBackground
                  source={{ uri: card.image }}
                  style={s.actionCardBg}
                  imageStyle={{ borderRadius: 16 }}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.8)']}
                    locations={[0.2, 0.6, 1]}
                    style={s.actionCardGrad}
                  >
                    <View style={[s.actionIconWrap, { backgroundColor: withOpacity(card.color, 0.5) }]}>
                      <MaterialIcons name={card.icon as any} size={18} color="#FFF" />
                    </View>
                    <Text style={s.actionTitle}>{card.title}</Text>
                    <Text style={s.actionDesc}>{card.desc}</Text>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.section} data-testid="regioes-section">
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionLabel}>REGIÕES</Text>
              <Text style={s.sectionTitle}>Cada Região, uma História</Text>
            </View>
            <TouchableOpacity style={s.seeAllBtn} onPress={() => router.push('/(tabs)/mapa')}>
              <Text style={s.seeAllText}>Ver todas</Text>
              <MaterialIcons name="arrow-forward" size={16} color={C.forestLight} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.regionScroll}>
            {REGIONS.map((region) => (
              <TouchableOpacity
                key={region.id}
                style={s.regionCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/(tabs)/mapa?region=${region.id}&t=${Date.now()}` as any)}
                data-testid={`landing-region-${region.id}`}
              >
                <ImageBackground
                  source={{ uri: (regionImages as any)[region.id] }}
                  style={s.regionCardBg}
                  imageStyle={{ borderRadius: 16 }}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)']}
                    locations={[0.3, 0.65, 1]}
                    style={s.regionCardGrad}
                  >
                    <Text style={s.regionName}>{region.name}</Text>
                    <Text style={s.regionDesc} numberOfLines={1}>{region.desc}</Text>
                    <View style={s.regionStats}>
                      <MaterialIcons name="place" size={12} color={C.mint} />
                      <Text style={s.regionStatText}>{region.items} experiências</Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {descobertas.length > 0 && (
          <View style={s.section} data-testid="descobertas-section">
            <View style={s.sectionHeader}>
              <View>
                <Text style={s.sectionLabel}>TESOUROS</Text>
                <Text style={s.sectionTitle}>Descobertas Raras</Text>
              </View>
              <TouchableOpacity style={s.seeAllBtn} onPress={() => router.push('/(tabs)/descobrir')}>
                <Text style={s.seeAllText}>Ver todos</Text>
                <MaterialIcons name="arrow-forward" size={16} color={C.forestLight} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.descScroll}>
              {descobertas.map((item: any, i: number) => (
                <TouchableOpacity
                  key={item.id || i}
                  style={s.descCard}
                  activeOpacity={0.85}
                  onPress={() => item.id ? router.push(`/heritage/${item.id}` as any) : null}
                  data-testid={`descoberta-${i}`}
                >
                  <ImageBackground
                    source={{ uri: item.image }}
                    style={s.descCardBg}
                    imageStyle={{ borderRadius: 14 }}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={s.descCardGrad}
                    >
                      <View style={s.descBadge}>
                        <Text style={s.descBadgeText}>{item.cat}</Text>
                      </View>
                      <Text style={s.descCardTitle}>{item.title}</Text>
                      <Text style={s.descCardRegion}>{item.region}</Text>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {stories && stories.length > 0 && (
          <View style={s.section} data-testid="historias">
            <Text style={s.sectionLabel}>HISTORIAS</Text>
            <Text style={s.sectionTitle}>Historias que Inspiram</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storyScroll}>
              {stories.map((story: StoryItem, i: number) => (
                <TouchableOpacity
                  key={story.id}
                  style={s.storyCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/heritage/${story.id}` as any)}
                  data-testid={`story-${i}`}
                >
                  <ImageBackground source={{ uri: story.image_url }} style={s.storyCardImg} imageStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={s.storyCardImgGrad}>
                      <View style={s.storyBadgeRow}>
                        <View style={s.storyRegionBadge}>
                          <Text style={s.storyRegionText}>{story.region}</Text>
                        </View>
                        <Text style={s.storyReadTime}>{story.read_time}</Text>
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                  <View style={s.storyContent}>
                    <Text style={s.storyTitle}>{story.title}</Text>
                    <Text style={s.storyDesc} numberOfLines={2}>{story.description}</Text>
                    <View style={s.storyFooter}>
                      <Text style={s.storyReadMore}>Ler historia</Text>
                      <MaterialIcons name="arrow-forward" size={14} color={C.forestLight} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={s.nlSection} data-testid="newsletter">
          <View style={s.nlContent}>
            <Text style={s.nlTitle}>Recebe as Melhores Dicas</Text>
            <Text style={s.nlSub}>Junta-te a uma comunidade de viajantes apaixonados por Portugal.</Text>

            <View style={s.nlInterests}>
              {NEWSLETTER_INTERESTS.map((interest) => (
                <View key={interest} style={s.nlChip}>
                  <Text style={s.nlChipText}>{interest}</Text>
                </View>
              ))}
            </View>

            <View style={s.nlInputRow}>
              <TextInput
                style={s.nlInput}
                placeholder="O teu email"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                data-testid="newsletter-email"
              />
              <TouchableOpacity
                style={[s.nlBtn, emailSent && { backgroundColor: palette.forest[500] }]}
                onPress={async () => {
                  if (!email) return;
                  try {
                    const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/newsletter/subscribe`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email, interests: ['natureza', 'gastronomia', 'patrimonio'] }),
                    });
                    if (res.ok) setEmailSent(true);
                  } catch { setEmailSent(true); }
                }}
                data-testid="newsletter-submit"
              >
                <Text style={s.nlBtnText}>{emailSent ? 'Subscrito!' : 'Subscrever'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.nlDisclaimer}>Sem spam. Cancela quando quiseres.</Text>
          </View>
        </View>

        <View style={s.footer} data-testid="footer">
          <View style={s.footerTop}>
            <View style={s.footerBrand}>
              <View style={s.footerLogoRow}>
                <View style={s.logoIcon}>
                  <MaterialIcons name="terrain" size={14} color="#FFF" />
                </View>
                <Text style={s.footerLogo}>Portugal Vivo</Text>
              </View>
              <Text style={s.footerDesc}>Um mapa vivo onde cada regiao respira historias, sabores e caminhos. Descobre Portugal de uma forma unica e autentica.</Text>
            </View>
            {isWide && (
              <>
                <View style={s.footerCol}>
                  <Text style={s.footerColTitle}>Regioes</Text>
                  {['Norte', 'Centro', 'Lisboa', 'Alentejo', 'Algarve', 'Acores', 'Madeira'].map((r) => (
                    <Text key={r} style={s.footerLink}>{r}</Text>
                  ))}
                </View>
                <View style={s.footerCol}>
                  <Text style={s.footerColTitle}>Categorias</Text>
                  {['Patrimonio', 'Gastronomia', 'Natureza', 'Experiencias', 'Termas'].map((c) => (
                    <Text key={c} style={s.footerLink}>{c}</Text>
                  ))}
                </View>
                <View style={s.footerCol}>
                  <Text style={s.footerColTitle}>Sobre</Text>
                  {['Quem Somos', 'Contacto', 'Parcerias', 'Termos de Uso', 'Privacidade'].map((a) => (
                    <Text key={a} style={s.footerLink}>{a}</Text>
                  ))}
                </View>
              </>
            )}
          </View>
          <View style={s.footerBottom}>
            <Text style={s.footerCopy}>2026 Portugal Vivo. Todos os direitos reservados.</Text>
            <Text style={s.footerMade}>Feito com amor em Portugal</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
