import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView,
  ImageBackground, Animated, TextInput, StatusBar, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStats, getTopScoredItems, getStories, getMainCategories, TopScoredItem, StoryItem } from '../src/services/api';
import { useTheme } from '../src/context/ThemeContext';
import { regionImages } from '../src/theme';

const { width } = Dimensions.get('window');

// Inject fonts on web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

const headingFont = Platform.OS === 'web' ? 'Playfair Display, Georgia, serif' : undefined;
const bodyFont = Platform.OS === 'web' ? 'DM Sans, system-ui, sans-serif' : undefined;

// Colors - matching mobile app (light, green/teal)
const C = {
  bg: '#F5F7F5',
  card: '#FFFFFF',
  forest: '#1E3A3F',
  forestLight: '#2E5E4E',
  teal: '#2A5F6B',
  accent: '#E67A4A',
  mint: '#D0DFD5',
  mintLight: '#E8F0EC',
  textDark: '#1F2937',
  textMed: '#4B5563',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F0F2F0',
  statGreen: '#2E5E4E',
  statOrange: '#E67A4A',
  statBlue: '#2A5F6B',
};

const HERO_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Ribeira_do_Porto_%28Portugal%29.jpg/1280px-Ribeira_do_Porto_%28Portugal%29.jpg';

const REGIONS = [
  { id: 'norte', name: 'Norte', desc: 'Do Minho ao Douro, granito e vinho verde', items: 714 },
  { id: 'centro', name: 'Centro', desc: 'Serras, aldeias historicas e tradicoes vivas', items: 704 },
  { id: 'lisboa', name: 'Lisboa', desc: 'Capital de luz, fado e azulejos', items: 310 },
  { id: 'alentejo', name: 'Alentejo', desc: 'Planicies douradas, cortica e silencio', items: 280 },
  { id: 'algarve', name: 'Algarve', desc: 'Falesias, mar turquesa e cataplanas', items: 123 },
  { id: 'acores', name: 'Acores', desc: 'Vulcoes, lagoas e verde infinito', items: 95 },
  { id: 'madeira', name: 'Madeira', desc: 'Laurissilva, levadas e flores', items: 85 },
];

const ACTION_CARDS = [
  {
    id: 'nearby',
    title: 'Perto de Mim',
    desc: 'Descobre o que esta a tua volta',
    icon: 'place',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Pena_Palace_in_Sintra_-_panorama_%28cropped%29.jpg/640px-Pena_Palace_in_Sintra_-_panorama_%28cropped%29.jpg',
    route: '/(tabs)/mapa',
    color: '#E67A4A',
  },
  {
    id: 'explore',
    title: 'Explorar Património',
    desc: 'Caminha por vilas onde o tempo parou',
    icon: 'account-balance',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Panorama_of_Lisbon_%2811977231484%29.jpg/640px-Panorama_of_Lisbon_%2811977231484%29.jpg',
    route: '/(tabs)/descobrir',
    color: '#2E5E4E',
  },
  {
    id: 'gastro',
    title: 'Gastronomia',
    desc: 'Sabores autenticos de cada regiao',
    icon: 'restaurant',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Douro_Vinhateiro2.jpg/640px-Douro_Vinhateiro2.jpg',
    route: '/(tabs)/descobrir',
    color: '#8B4513',
  },
  {
    id: 'trails',
    title: 'Trilhos & Natureza',
    desc: 'Percursos entre serras e rios',
    icon: 'terrain',
    image: regionImages.acores,
    route: '/(tabs)/mapa',
    color: '#2A5F6B',
  },
];

const NEWSLETTER_INTERESTS = ['Natureza', 'Patrimonio', 'Gastronomia', 'Praias', 'Trilhos', 'Eventos', 'Termas', 'Surf'];

const NAV_ITEMS = ['Mapa', 'Regioes', 'Categorias', 'Tesouros', 'Newsletter'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const { data: topScored } = useQuery({ queryKey: ['top-scored'], queryFn: getTopScoredItems });
  const { data: stories } = useQuery({ queryKey: ['stories'], queryFn: getStories });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

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

        {/* === NAV BAR === */}
        <View style={s.nav} data-testid="nav-bar">
          <TouchableOpacity style={s.logoWrap} onPress={() => router.replace('/(tabs)')}>
            <View style={s.logoIcon}>
              <MaterialIcons name="terrain" size={18} color="#FFF" />
            </View>
            <Text style={s.logoText}>Patrimonio Vivo</Text>
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

        {/* === HERO SECTION === */}
        <View style={s.heroSection}>
          <ImageBackground
            source={{ uri: HERO_IMAGE }}
            style={s.heroImage}
            imageStyle={{ borderRadius: 24 }}
          >
            <LinearGradient
              colors={['rgba(30,58,63,0.15)', 'rgba(30,58,63,0.4)', 'rgba(245,247,245,0.95)', C.bg]}
              locations={[0, 0.35, 0.7, 0.9]}
              style={s.heroGrad}
            >
              <Animated.View style={[s.heroContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <Text style={s.greeting} data-testid="greeting">{greeting}, explorador</Text>
                <Text style={s.heroTitle} data-testid="hero-title">Bem-vindo a tua{'\n'}jornada portuguesa</Text>
                <Text style={s.heroSub}>Descobre historias antigas, sabores unicos e{'\n'}caminhos onde o tempo parou</Text>
              </Animated.View>
            </LinearGradient>
          </ImageBackground>

          {/* Search Bar */}
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

          {/* Stats Row */}
          <View style={s.statsRow} data-testid="stats-row">
            <View style={[s.statBox, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcons name="place" size={20} color={C.statGreen} />
              <Text style={[s.statVal, { color: C.statGreen }]}>
                {stats?.total_items ? stats.total_items.toLocaleString('pt-PT') : '471'}
              </Text>
              <Text style={s.statLabel}>lugares</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="explore" size={20} color={C.statOrange} />
              <Text style={[s.statVal, { color: C.statOrange }]}>
                {stats?.total_routes || '20'}
              </Text>
              <Text style={s.statLabel}>aventuras</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: '#E0F2F1' }]}>
              <MaterialIcons name="flag" size={20} color={C.statBlue} />
              <Text style={[s.statVal, { color: C.statBlue }]}>
                {stats?.regions?.length || '7'}
              </Text>
              <Text style={s.statLabel}>regioes</Text>
            </View>
          </View>
        </View>

        {/* === COMECA A TUA AVENTURA === */}
        <View style={s.section} data-testid="aventura-section">
          <Text style={s.sectionTitle}>Comeca a tua aventura</Text>
          <Text style={s.sectionSub}>Escolhe o que o coracao te pedir</Text>

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
                    <View style={[s.actionIconWrap, { backgroundColor: card.color + '80' }]}>
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

        {/* === REGIOES === */}
        <View style={s.section} data-testid="regioes-section">
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionLabel}>REGIOES</Text>
              <Text style={s.sectionTitle}>Cada Regiao, uma Historia</Text>
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
                      <Text style={s.regionStatText}>{region.items} experiencias</Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* === DESCOBERTAS === */}
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

        {/* === HISTORIAS === */}
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

        {/* === NEWSLETTER === */}
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
                style={[s.nlBtn, emailSent && { backgroundColor: '#2E8B57' }]}
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

        {/* === FOOTER === */}
        <View style={s.footer} data-testid="footer">
          <View style={s.footerTop}>
            <View style={s.footerBrand}>
              <View style={s.footerLogoRow}>
                <View style={s.logoIcon}>
                  <MaterialIcons name="terrain" size={14} color="#FFF" />
                </View>
                <Text style={s.footerLogo}>Patrimonio Vivo</Text>
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
            <Text style={s.footerCopy}>2026 Patrimonio Vivo. Todos os direitos reservados.</Text>
            <Text style={s.footerMade}>Feito com amor em Portugal</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // === NAV ===
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, marginBottom: 4 },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.forestLight, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 18, fontWeight: '700', color: C.forest, fontFamily: headingFont },
  navLinks: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 28 },
  navLink: {},
  navLinkText: { fontSize: 14, color: C.textMed, fontWeight: '500', fontFamily: bodyFont },
  profileBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.forestLight, justifyContent: 'center', alignItems: 'center' },

  // === HERO ===
  heroSection: { paddingHorizontal: 20, marginBottom: 28 },
  heroImage: { height: 320, marginBottom: 20 },
  heroGrad: { flex: 1, borderRadius: 24, justifyContent: 'flex-end', paddingBottom: 0 },
  heroContent: { paddingHorizontal: 20, paddingBottom: 20 },
  greeting: { fontSize: 15, color: C.forestLight, fontWeight: '600', marginBottom: 6, fontFamily: bodyFont },
  heroTitle: { fontSize: 32, fontWeight: '800', color: C.textDark, lineHeight: 40, marginBottom: 10, fontFamily: headingFont },
  heroSub: { fontSize: 14, color: C.textLight, lineHeight: 22, fontFamily: bodyFont },

  // === SEARCH ===
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 12, marginBottom: 20, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, fontSize: 15, color: C.textDark, fontFamily: bodyFont },

  // === STATS ===
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  statVal: { fontSize: 26, fontWeight: '800', fontFamily: headingFont },
  statLabel: { fontSize: 11, color: C.textLight, fontWeight: '500', fontFamily: bodyFont },

  // === SECTIONS ===
  section: { paddingHorizontal: 20, marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  sectionLabel: { fontSize: 11, color: C.forestLight, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4, fontFamily: bodyFont },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: C.textDark, marginBottom: 6, fontFamily: headingFont },
  sectionSub: { fontSize: 14, color: C.textLight, lineHeight: 22, marginBottom: 20, fontFamily: bodyFont },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 6 },
  seeAllText: { fontSize: 13, color: C.forestLight, fontWeight: '600', fontFamily: bodyFont },

  // === ACTION CARDS ===
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { height: 180, borderRadius: 16, overflow: 'hidden' },
  actionCardBg: { flex: 1 },
  actionCardGrad: { flex: 1, justifyContent: 'flex-end', padding: 14, borderRadius: 16 },
  actionIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', fontFamily: headingFont },
  actionDesc: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: bodyFont },

  // === REGION CARDS ===
  regionScroll: { gap: 12, paddingRight: 20 },
  regionCard: { width: 260, height: 180, borderRadius: 16, overflow: 'hidden' },
  regionCardBg: { flex: 1 },
  regionCardGrad: { flex: 1, justifyContent: 'flex-end', padding: 14, borderRadius: 16 },
  regionName: { fontSize: 20, fontWeight: '700', color: '#FFF', fontFamily: headingFont },
  regionDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: bodyFont },
  regionStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  regionStatText: { fontSize: 11, color: C.mint },

  // === DESCOBERTAS ===
  descScroll: { gap: 12, paddingRight: 20 },
  descCard: { width: 200, height: 240, borderRadius: 14, overflow: 'hidden' },
  descCardBg: { flex: 1 },
  descCardGrad: { flex: 1, justifyContent: 'flex-end', padding: 14, borderRadius: 14 },
  descBadge: { backgroundColor: C.forestLight, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginBottom: 8 },
  descBadgeText: { fontSize: 10, color: '#FFF', fontWeight: '700', textTransform: 'uppercase', fontFamily: bodyFont },
  descCardTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', fontFamily: headingFont },
  descCardRegion: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontFamily: bodyFont },

  // === STORIES ===
  storyScroll: { gap: 16, paddingRight: 20 },
  storyCard: { width: 280, borderRadius: 16, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  storyCardImg: { height: 140 },
  storyCardImgGrad: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  storyBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyRegionBadge: { backgroundColor: 'rgba(46,94,78,0.85)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  storyRegionText: { fontSize: 10, color: '#FFF', fontWeight: '700', fontFamily: bodyFont },
  storyReadTime: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontFamily: bodyFont },
  storyContent: { padding: 14 },
  storyTitle: { fontSize: 16, fontWeight: '700', color: C.textDark, marginBottom: 6, fontFamily: headingFont },
  storyDesc: { fontSize: 12, color: C.textLight, lineHeight: 18, marginBottom: 10, fontFamily: bodyFont },
  storyFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storyReadMore: { fontSize: 13, color: C.forestLight, fontWeight: '600', fontFamily: bodyFont },

  // === NEWSLETTER ===
  nlSection: { marginHorizontal: 20, backgroundColor: C.forest, borderRadius: 24, padding: 28, marginBottom: 32 },
  nlContent: { maxWidth: 500 },
  nlTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 8, fontFamily: headingFont },
  nlSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 16, fontFamily: bodyFont },
  nlInterests: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  nlChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  nlChipText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: bodyFont },
  nlInputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  nlInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: '#FFF', fontFamily: bodyFont },
  nlBtn: { backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, justifyContent: 'center' },
  nlBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700', fontFamily: bodyFont },
  nlDisclaimer: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: bodyFont },

  // === FOOTER ===
  footer: { marginHorizontal: 20, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 32, paddingBottom: 20 },
  footerTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 40, marginBottom: 24 },
  footerBrand: { flex: 1, minWidth: 200 },
  footerLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  footerLogo: { fontSize: 16, fontWeight: '700', color: C.textDark, fontFamily: headingFont },
  footerDesc: { fontSize: 13, color: C.textLight, lineHeight: 20, maxWidth: 300, fontFamily: bodyFont },
  footerCol: { minWidth: 120 },
  footerColTitle: { fontSize: 12, color: C.forestLight, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: bodyFont },
  footerLink: { fontSize: 13, color: C.textLight, marginBottom: 8, fontFamily: bodyFont },
  footerBottom: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  footerCopy: { fontSize: 11, color: C.textMuted, fontFamily: bodyFont },
  footerMade: { fontSize: 11, color: C.textMuted, fontFamily: bodyFont },
});
