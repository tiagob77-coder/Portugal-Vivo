import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Dimensions, ImageBackground, Linking, Share, Alert } from 'react-native';
import OptimizedImage from '../../src/components/OptimizedImage';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Head from 'expo-router/head';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHeritageItem, getCategories, generateNarrative, addFavorite, removeFavorite, getAudioGuideForItem, doCheckin, getPoiImages, getDepthContent, ContentDepth, CognitiveProfile } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { Category } from '../../src/types';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { offlineCache } from '../../src/services/offlineCache';
import { ReviewsSection } from '../../src/components/ReviewsSection';
import { ShareButton } from '../../src/components/ShareButton';
import ImageUpload from '../../src/components/ImageUpload';
import PoiVideoPlayer from '../../src/components/PoiVideoPlayer';
import Panorama360View from '../../src/components/Panorama360View';
import SensoryCard from '../../src/components/SensoryCard';

const { width: _width } = Dimensions.get('window');

const _GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Helper to remove markdown formatting from AI-generated text
const cleanMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s*/gm, '') // Remove header markers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/^\s*[-*+]\s+/gm, '• ') // Convert list markers to bullet
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .trim();
};

// Conditional import for WebView (only on native)
let _WebView: any = null;
if (Platform.OS !== 'web') {
  _WebView = require('react-native-webview').WebView; // eslint-disable-line @typescript-eslint/no-require-imports
}

// MapView and Marker are only available on native
// On web, we use Leaflet via NativeMap.web.tsx
let MapView: any = null;
let Marker: any = null;
// Note: react-native-maps imports are handled only in native builds
// Web builds should never include this module

const REGION_NAMES: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa e Vale do Tejo',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

// Category default images — covers all 39+ new subcategories + legacy
const CATEGORY_IMAGES: Record<string, string> = {
  // ── Natureza ──────────────────────────────────────────────
  percursos_pedestres: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
  aventura_natureza: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
  natureza_especializada: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
  fauna_autoctone: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&q=80',
  flora_autoctone: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
  flora_botanica: 'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&q=80',
  biodiversidade_avistamentos: 'https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=800&q=80',
  miradouros: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  barragens_albufeiras: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80',
  cascatas_pocos: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80',
  praias_fluviais: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  arqueologia_geologia: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&q=80',
  moinhos_azenhas: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80',
  ecovias_passadicos: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
  // ── História & Património ─────────────────────────────────
  castelos: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  palacios_solares: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
  museus: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80',
  oficios_artesanato: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&q=80',
  termas_banhos: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  patrimonio_ferroviario: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80',
  arte_urbana: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80',
  // ── Gastronomia ───────────────────────────────────────────
  restaurantes_gastronomia: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  tabernas_historicas: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80',
  mercados_feiras: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80',
  produtores_dop: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80',
  agroturismo_enoturismo: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80',
  pratos_tipicos: 'https://images.unsplash.com/photo-1591107576521-87091dc07797?w=800&q=80',
  docaria_regional: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80',
  sopas_tipicas: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
  // ── Cultura ───────────────────────────────────────────────
  musica_tradicional: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80',
  festivais_musica: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
  festas_romarias: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  // ── Mar & Praias ──────────────────────────────────────────
  surf: 'https://images.unsplash.com/photo-1502680390548-bdbac40b3e1a?w=800&q=80',
  praias_bandeira_azul: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  // ── Experiências ──────────────────────────────────────────
  rotas_tematicas: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  grande_expedicao: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
  perolas_portugal: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
  alojamentos_rurais: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80',
  parques_campismo: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
  pousadas_juventude: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
  farois: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  entidades_operadores: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
  agentes_turisticos: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
  // ── Legacy (old categories fallback) ──────────────────────
  lendas: 'https://images.unsplash.com/photo-1627501690716-110dfac7c9ca?w=800&q=80',
  festas: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
  saberes: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  gastronomia: 'https://images.unsplash.com/photo-1591107576521-87091dc07797?w=800&q=80',
  termas: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
  aldeias: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80',
};

// Specific item images based on keywords
const getItemImage = (name: string, category: string): string => {
  const nameLower = name.toLowerCase();
  
  // Fauna - Animais
  if (nameLower.includes('lobo') || nameLower.includes('ibérico') || nameLower.includes('iberico')) {
    return 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800&q=80'; // Wolf
  }
  if (nameLower.includes('lince')) {
    return 'https://images.unsplash.com/photo-1606567595334-d39972c85dfd?w=800&q=80'; // Lynx
  }
  if (nameLower.includes('águia') || nameLower.includes('aguia')) {
    return 'https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=800&q=80'; // Eagle
  }
  if (nameLower.includes('golfinho')) {
    return 'https://images.unsplash.com/photo-1607153333879-c174d265f1d2?w=800&q=80'; // Dolphin
  }
  if (nameLower.includes('cegonha')) {
    return 'https://images.unsplash.com/photo-1591608971362-f08b2a75731a?w=800&q=80'; // Stork
  }
  if (nameLower.includes('cavalo')) {
    return 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800&q=80'; // Horse
  }
  if (nameLower.includes('touro') || nameLower.includes('boi')) {
    return 'https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=800&q=80'; // Bull
  }
  
  // Lendas específicas
  if (nameLower.includes('lobisomem')) {
    return 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800&q=80'; // Wolf at night
  }
  if (nameLower.includes('moura') || nameLower.includes('encantada')) {
    return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80'; // Mystical
  }
  if (nameLower.includes('galo') || nameLower.includes('barcelos')) {
    return 'https://images.unsplash.com/photo-1569428034239-f9565e32e224?w=800&q=80'; // Rooster
  }
  if (nameLower.includes('adamastor') || nameLower.includes('cabo')) {
    return 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80'; // Sea/storm
  }
  if (nameLower.includes('sete cidades')) {
    return 'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?w=800&q=80'; // Lakes
  }
  if (nameLower.includes('serra') || nameLower.includes('estrela')) {
    return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80'; // Mountains
  }
  if (nameLower.includes('bruxa') || nameLower.includes('feitiçaria') || nameLower.includes('feiticaria')) {
    return 'https://images.unsplash.com/photo-1509557965875-b88c97052f0e?w=800&q=80'; // Dark forest
  }
  if (nameLower.includes('dragão') || nameLower.includes('dragao') || nameLower.includes('serpente')) {
    return 'https://images.unsplash.com/photo-1577493340887-b7bfff550145?w=800&q=80'; // Dragon-like
  }
  if (nameLower.includes('fantasma') || nameLower.includes('assombr')) {
    return 'https://images.unsplash.com/photo-1509248961895-40e8ce494c85?w=800&q=80'; // Haunted
  }
  if (nameLower.includes('castelo') || nameLower.includes('torre')) {
    return 'https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=800&q=80'; // Castle
  }
  if (nameLower.includes('milagre') || nameLower.includes('santo') || nameLower.includes('santa')) {
    return 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800&q=80'; // Church
  }
  if (nameLower.includes('alma') || nameLower.includes('espírito') || nameLower.includes('espirito')) {
    return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80'; // Spiritual
  }
  if (nameLower.includes('mar') || nameLower.includes('oceano') || nameLower.includes('pescador')) {
    return 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80'; // Ocean
  }
  if (nameLower.includes('rio') || nameLower.includes('água') || nameLower.includes('agua')) {
    return 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=80'; // River
  }
  if (nameLower.includes('floresta') || nameLower.includes('bosque') || nameLower.includes('mata')) {
    return 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80'; // Forest
  }
  
  // Festas
  if (nameLower.includes('carnaval')) {
    return 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80';
  }
  if (nameLower.includes('santo') && nameLower.includes('popular')) {
    return 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80';
  }
  if (nameLower.includes('romaria') || nameLower.includes('festa') || nameLower.includes('procissão')) {
    return 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80';
  }
  if (nameLower.includes('fogo') || nameLower.includes('fogueira')) {
    return 'https://images.unsplash.com/photo-1475738972911-5b44ce984c42?w=800&q=80'; // Fire
  }
  
  // Gastronomia
  if (nameLower.includes('vinho') || nameLower.includes('porto')) {
    return 'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=800&q=80';
  }
  if (nameLower.includes('bacalhau')) {
    return 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=800&q=80';
  }
  if (nameLower.includes('pastel') || nameLower.includes('nata')) {
    return 'https://images.unsplash.com/photo-1591107576521-87091dc07797?w=800&q=80';
  }
  if (nameLower.includes('queijo')) {
    return 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&q=80';
  }
  if (nameLower.includes('pão') || nameLower.includes('pao') || nameLower.includes('broa')) {
    return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80'; // Bread
  }
  if (nameLower.includes('azeite') || nameLower.includes('oliva')) {
    return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80'; // Olive oil
  }
  if (nameLower.includes('mel')) {
    return 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80'; // Honey
  }
  if (nameLower.includes('presunto') || nameLower.includes('enchido') || nameLower.includes('chouriço')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80'; // Cured meat
  }
  
  // Aldeias e lugares
  if (nameLower.includes('monsanto')) {
    return 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80';
  }
  if (nameLower.includes('óbidos') || nameLower.includes('obidos')) {
    return 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80';
  }
  if (nameLower.includes('sintra')) {
    return 'https://images.unsplash.com/photo-1627501690716-110dfac7c9ca?w=800&q=80';
  }
  if (nameLower.includes('marvão') || nameLower.includes('marvao')) {
    return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80';
  }
  
  // Natureza
  if (nameLower.includes('douro')) {
    return 'https://images.unsplash.com/photo-1638664370752-8188076afbab?w=800&q=80';
  }
  if (nameLower.includes('gerês') || nameLower.includes('geres') || nameLower.includes('peneda')) {
    return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80';
  }
  if (nameLower.includes('praia') || nameLower.includes('costa') || nameLower.includes('falesia')) {
    return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80';
  }
  if (nameLower.includes('montanha') || nameLower.includes('pico')) {
    return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80';
  }
  if (nameLower.includes('lagoa') || nameLower.includes('lago')) {
    return 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80'; // Lake
  }
  if (nameLower.includes('cascata') || nameLower.includes('queda')) {
    return 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=80'; // Waterfall
  }
  
  // Artesanato
  if (nameLower.includes('azulejo')) {
    return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80';
  }
  if (nameLower.includes('bordado') || nameLower.includes('renda') || nameLower.includes('tecelagem')) {
    return 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&q=80'; // Textile
  }
  if (nameLower.includes('olaria') || nameLower.includes('cerâmica') || nameLower.includes('ceramica') || nameLower.includes('barro')) {
    return 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80'; // Pottery
  }
  if (nameLower.includes('cortiça') || nameLower.includes('cortica')) {
    return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'; // Cork
  }
  if (nameLower.includes('filigrana') || nameLower.includes('ouro') || nameLower.includes('prata')) {
    return 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80'; // Jewelry
  }
  
  // Minerais e termas
  if (nameLower.includes('mina') || nameLower.includes('mineral') || nameLower.includes('pedra')) {
    return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80';
  }
  if (nameLower.includes('terma') || nameLower.includes('água quente') || nameLower.includes('spa')) {
    return 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80';
  }
  
  // Default to category image
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.lendas;
};

export default function HeritageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, sessionToken, login, isPremium, refreshUser } = useAuth();
  const [narrativeStyle, setNarrativeStyle] = useState<'storytelling' | 'educational' | 'brief'>('storytelling');
  const [depthLevel, setDepthLevel] = useState<ContentDepth>('snackable');
  const [cognitiveProfile, setCognitiveProfile] = useState<CognitiveProfile | undefined>(undefined);
  const [showNarrative, setShowNarrative] = useState(false);
  const [showFreeResume, setShowFreeResume] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSpeakingNarrative, setIsSpeakingNarrative] = useState(false);
  const [isSpeakingDesc, setIsSpeakingDesc] = useState(false);
  const [showPanorama, setShowPanorama] = useState(false);

  // Get user location for check-in
  useEffect(() => {
    if (Platform.OS === 'web') {
      navigator.geolocation?.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silently fail
      );
    }
  }, []);

  const checkinMutation = useMutation({
    mutationFn: () => doCheckin(userLocation!.lat, userLocation!.lng, id!),
    onSuccess: (data) => {
      if (data.success) {
        const badges = data.new_badges?.map((b: any) => b.name).join(', ');
        const msg = `+${data.xp_earned} XP${badges ? `\nNovo badge: ${badges}!` : ''}`;
        if (Platform.OS === 'web') {
          window.alert(`${data.message}\n${msg}`);
        } else {
          Alert.alert('Check-in!', `${data.message}\n${msg}`);
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(data.message);
        } else {
          Alert.alert('Aviso', data.message);
        }
      }
    },
    onError: () => {
      const errMsg = 'Não foi possível fazer check-in. Tente novamente.';
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Erro', errMsg);
      }
    },
  });

  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['heritage', id],
    queryFn: () => getHeritageItem(id!),
    enabled: !!id,
  });

  // Inject SEO meta tags on web for social sharing (Open Graph + Twitter Card)
  useEffect(() => {
    if (Platform.OS !== 'web' || !item || typeof document === 'undefined') return;

    const title = `${item.name} — Portugal Vivo`;
    const desc = item.description?.slice(0, 160) || `Descobre ${item.name} no Portugal Vivo`;
    const image = item.image_url || getItemImage(item.name, item.category);
    const url = window.location.href;

    document.title = title;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    const setMetaName = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };

    // Open Graph
    setMeta('og:title', title);
    setMeta('og:description', desc);
    setMeta('og:image', image);
    setMeta('og:url', url);
    setMeta('og:type', 'article');
    setMeta('og:site_name', 'Portugal Vivo');

    // Twitter Card
    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', title);
    setMetaName('twitter:description', desc);
    setMetaName('twitter:image', image);

    // Standard meta description
    setMetaName('description', desc);
  }, [item]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: narrativeData, isLoading: narrativeLoading, refetch: refetchNarrative } = useQuery({
    queryKey: ['narrative', id, narrativeStyle],
    queryFn: async () => {
      try {
        const data = await generateNarrative(id!, narrativeStyle);
        // Persist generated narrative for offline access
        offlineCache.cacheNarrative(id!, narrativeStyle, data.narrative).catch(() => {});
        return data;
      } catch (err) {
        // Offline fallback: serve from cache with a flag
        const cached = await offlineCache.getCachedNarrative(id!, narrativeStyle);
        if (cached) {
          return { narrative: cached, item_name: item?.name || '', generated_at: 'cached' };
        }
        throw err;
      }
    },
    enabled: showNarrative && isPremium,
  });

  // Free brief resume — available to all users via depth content API (snackable)
  const { data: freeResumeData, isLoading: freeResumeLoading } = useQuery({
    queryKey: ['depth-content', id, 'snackable'],
    queryFn: async () => {
      try {
        const data = await getDepthContent(id!, 'snackable');
        return { narrative: data.content, item_name: '', generated_at: data.generated_at };
      } catch {
        // Fallback to legacy narrative API
        try {
          const data = await generateNarrative(id!, 'brief');
          return data;
        } catch (err2) {
          const cached = await offlineCache.getCachedNarrative(id!, 'brief');
          if (cached) {
            return { narrative: cached, item_name: item?.name || '', generated_at: 'cached' };
          }
          throw err2;
        }
      }
    },
    enabled: showFreeResume,
  });

  // Depth content — 4 levels for premium users
  const { data: depthData, isLoading: depthLoading } = useQuery({
    queryKey: ['depth-content', id, depthLevel, cognitiveProfile],
    queryFn: async () => {
      const data = await getDepthContent(id!, depthLevel, cognitiveProfile);
      return data;
    },
    enabled: showNarrative && isPremium && depthLevel !== 'snackable',
  });

  // Community photo gallery
  const { data: communityPhotos } = useQuery({
    queryKey: ['poi-images', id],
    queryFn: () => getPoiImages(id!),
    enabled: !!id,
  });

  // Offline favorites via AsyncStorage (works without login)
  const { isFavorite: isFavOffline, toggleFavorite: toggleFavOffline } = useFavorites();
  const isFavorite = isFavOffline(id!);
  const handleToggleFavorite = () => { toggleFavOffline(id!); };

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [_audioError, setAudioError] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Cache POI + pre-fetch images for offline access when viewed
  useEffect(() => {
    if (item) {
      offlineCache.addFavoritePOI(item);
      // Pre-fetch hero and thumbnail images (native only — SW handles web)
      const imageUrls: string[] = [];
      if ((item as any).image_url) imageUrls.push((item as any).image_url);
      if ((item as any).thumbnail_url) imageUrls.push((item as any).thumbnail_url);
      if (imageUrls.length > 0) offlineCache.prefetchImages(imageUrls).catch(() => {});
    }
  }, [item]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Handle audio guide - using REAL TTS from backend (Premium feature)
  const handlePlayAudio = async () => {
    if (!isPremium) {
      router.push('/premium');
      return;
    }
    if (isPlayingAudio && sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlayingAudio(false);
      return;
    }

    if (!item) return;

    setIsLoadingAudio(true);
    setAudioError(null);

    try {
      // Get audio from backend TTS service
      const audioResult = await getAudioGuideForItem(item.id);
      
      if (!audioResult.success || !audioResult.audio_base64) {
        throw new Error(audioResult.error || 'Não foi possível gerar áudio');
      }

      // Convert base64 to audio file and play
      const audioUri = `data:audio/mp3;base64,${audioResult.audio_base64}`;
      
      // Load and play audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlayingAudio(false);
            newSound.unloadAsync();
            setSound(null);
          }
        }
      );
      
      setSound(newSound);
      setIsPlayingAudio(true);
      
    } catch (error: any) {
      console.error('Audio guide error:', error);
      setAudioError(error.message || 'Erro ao reproduzir áudio');
      Alert.alert('Erro', 'Não foi possível reproduzir o áudio guia: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Device TTS for AI narrative (free, uses on-device voice)
  const handleSpeakNarrative = async (text: string) => {
    if (isSpeakingNarrative) {
      Speech.stop();
      setIsSpeakingNarrative(false);
      return;
    }
    setIsSpeakingNarrative(true);
    Speech.speak(text, {
      language: 'pt-PT',
      rate: 0.9,
      onDone: () => setIsSpeakingNarrative(false),
      onError: () => setIsSpeakingNarrative(false),
      onStopped: () => setIsSpeakingNarrative(false),
    });
  };

  // Device TTS for description (free)
  const handleSpeakDescription = () => {
    if (!item?.description) return;
    if (isSpeakingDesc) {
      Speech.stop();
      setIsSpeakingDesc(false);
      return;
    }
    setIsSpeakingDesc(true);
    Speech.speak(item.description, {
      language: 'pt-PT',
      rate: 0.9,
      onDone: () => setIsSpeakingDesc(false),
      onError: () => setIsSpeakingDesc(false),
      onStopped: () => setIsSpeakingDesc(false),
    });
  };

  // Server-side favorites (for authenticated users only - Premium feature)
  const addFavoriteMutation = useMutation({
    mutationFn: () => addFavorite(id!, sessionToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      refreshUser();
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: () => removeFavorite(id!, sessionToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      refreshUser();
    },
  });

  const toggleFavorite = () => {
    // Use offline favorites (AsyncStorage) — works without login
    handleToggleFavorite();
  };

  const category = categories.find((c: Category) => c.id === item?.category);

  if (itemLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#FAF8F5' }]}>
        {/* Hero image skeleton */}
        <View style={{ width: '100%', height: 280, backgroundColor: '#E8E3DC' }}>
          <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
            <View style={{ width: 80, height: 24, borderRadius: 12, backgroundColor: '#D4CFC7', marginBottom: 8 }} />
            <View style={{ width: '70%', height: 28, borderRadius: 8, backgroundColor: '#D4CFC7', marginBottom: 6 }} />
            <View style={{ width: '50%', height: 16, borderRadius: 6, backgroundColor: '#D4CFC7' }} />
          </View>
        </View>
        {/* Content skeleton */}
        <View style={{ padding: 20 }}>
          <View style={{ width: '100%', height: 16, borderRadius: 6, backgroundColor: '#E8E3DC', marginBottom: 10 }} />
          <View style={{ width: '90%', height: 16, borderRadius: 6, backgroundColor: '#E8E3DC', marginBottom: 10 }} />
          <View style={{ width: '75%', height: 16, borderRadius: 6, backgroundColor: '#E8E3DC', marginBottom: 24 }} />
          {/* Action buttons skeleton */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ width: 90, height: 70, borderRadius: 12, backgroundColor: '#E8E3DC' }} />
            ))}
          </View>
          {/* Map skeleton */}
          <View style={{ width: '100%', height: 200, borderRadius: 16, backgroundColor: '#E8E3DC' }} />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Item não encontrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS === 'web' && (
        <Head>
          <title>{item.name} — Portugal Vivo</title>
          <meta name="description" content={item.description ? item.description.slice(0, 155) : `Descubra ${item.name} no Portugal Vivo. Património cultural e natural de Portugal.`} />
          <meta property="og:title" content={`${item.name} — Portugal Vivo`} />
          <meta property="og:description" content={item.description ? item.description.slice(0, 200) : `Descubra ${item.name} em ${item.region || 'Portugal'}.`} />
          {(item.image_url) && <meta property="og:image" content={item.image_url} />}
          <meta property="og:type" content="place" />
          <link rel="canonical" href={`https://portugal-vivo.app/heritage/${item.id}`} />
          <script type="application/ld+json">{JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TouristAttraction',
            name: item.name,
            description: item.description,
            image: item.image_url,
            address: { '@type': 'PostalAddress', addressRegion: item.region, addressCountry: 'PT' },
            url: `https://portugal-vivo.app/heritage/${item.id}`,
          })}</script>
        </Head>
      )}
      
      {/* Hero Image */}
      <ImageBackground
        source={{ uri: item.image_url || getItemImage(item.name, item.category) }}
        style={[styles.heroImage, { paddingTop: insets.top }]}
        imageStyle={styles.heroImageStyle}
      >
        <View style={styles.heroOverlay}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ShareButton
                title={item.name}
                description={`Descobre ${item.name} no Portugal Vivo! \u{1F1F5}\u{1F1F9}`}
                url={`https://portugal-vivo-3.preview.emergentagent.com/heritage/${id}`}
              />
              <TouchableOpacity 
                style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]} 
                onPress={toggleFavorite}
              >
                <MaterialIcons 
                  name={isFavorite ? 'favorite' : 'favorite-border'} 
                  size={24} 
                  color={isFavorite ? '#EF4444' : '#FAF8F3'} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Hero Content */}
          <View style={styles.heroContent}>
            <View style={[
              styles.categoryBadge, 
              { backgroundColor: (category?.color || '#6366F1') + '40' }
            ]}>
              <MaterialIcons 
                name={(category?.icon || 'place') as any} 
                size={16} 
                color={category?.color || '#6366F1'} 
              />
              <Text style={[styles.categoryText, { color: category?.color || '#6366F1' }]}>
                {category?.name || item.category}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{item.name}</Text>
            <View style={styles.heroMeta}>
              {item.address && (
                <View style={styles.heroMetaItem}>
                  <MaterialIcons name="place" size={14} color="#FAF8F3" />
                  <Text style={styles.heroMetaText}>{item.address}</Text>
                </View>
              )}
              {(item.concelho || item.freguesia) && (
                <View style={styles.heroMetaItem}>
                  <MaterialIcons name="account-balance" size={14} color="#A8D5B5" />
                  <Text style={[styles.heroMetaText, { color: '#A8D5B5' }]}>
                    {[item.freguesia, item.concelho, item.distrito].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
              <View style={styles.heroMetaItem}>
                <MaterialIcons name="map" size={14} color="#C49A6C" />
                <Text style={[styles.heroMetaText, { color: '#C49A6C' }]}>
                  {REGION_NAMES[item.region] || item.region}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >

        {/* Description */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={styles.sectionTitle}>Descrição</Text>
            <TouchableOpacity
              onPress={handleSpeakDescription}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: isSpeakingDesc ? '#C49A6C20' : 'transparent' }}
              accessibilityLabel="Ouvir descrição"
            >
              <MaterialIcons name={isSpeakingDesc ? 'stop' : 'volume-up'} size={18} color="#C49A6C" />
              <Text style={{ fontSize: 12, color: '#C49A6C', fontWeight: '600' }}>{isSpeakingDesc ? 'Parar' : 'Ouvir'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.description}>{item.description}</Text>

          {/* Free brief AI expansion — shown when description is short (<120 chars) */}
          {(item.description?.length ?? 0) < 120 && (
            <View style={styles.freeResumeBox}>
              {!showFreeResume && !freeResumeData && (
                <TouchableOpacity
                  style={styles.freeResumeButton}
                  onPress={() => setShowFreeResume(true)}
                  accessibilityLabel="Expandir descrição com resumo gerado por IA"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="auto-fix-high" size={16} color="#C49A6C" />
                  <Text style={styles.freeResumeButtonText}>Saber mais (resumo IA gratuito)</Text>
                </TouchableOpacity>
              )}
              {freeResumeLoading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <ActivityIndicator size="small" color="#C49A6C" />
                  <Text style={{ color: '#94A3B8', fontSize: 13 }}>A gerar resumo...</Text>
                </View>
              )}
              {freeResumeData && (
                <View style={styles.freeResumeContent}>
                  <View style={styles.freeResumeDivider} />
                  <Text style={styles.freeResumeText}>{cleanMarkdown(freeResumeData.narrative)}</Text>
                  <View style={styles.freeResumeFooter}>
                    <MaterialIcons name="auto-awesome" size={12} color="#C49A6C" />
                    <Text style={styles.freeResumeFooterText}>Resumo gerado por IA</Text>
                    <TouchableOpacity
                      onPress={() => handleSpeakNarrative(freeResumeData.narrative)}
                      style={styles.freeResumeSpeakBtn}
                      accessibilityLabel="Ouvir resumo"
                    >
                      <MaterialIcons
                        name={isSpeakingNarrative ? 'stop' : 'record-voice-over'}
                        size={14}
                        color="#C49A6C"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Sensory Experiences */}
        {((item as any).aroma_note || (item as any).flavor_note || (item as any).photo_angle_tip || (item as any).sound_label) && (
          <View style={styles.section}>
            <SensoryCard data={{
              sound_url: (item as any).sound_url,
              sound_label: (item as any).sound_label,
              aroma_note: (item as any).aroma_note,
              flavor_note: (item as any).flavor_note,
              photo_angle_tip: (item as any).photo_angle_tip,
            }} />
          </View>
        )}

        {/* Short Video */}
        {(item as any).video_url && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vídeo</Text>
            <PoiVideoPlayer
              videoUrl={(item as any).video_url}
              posterUrl={(item as any).image_url || undefined}
              autoPlay={false}
            />
          </View>
        )}

        {/* 360° Panorama */}
        {(item as any).panorama_url && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>Vista 360°</Text>
              <TouchableOpacity
                onPress={() => setShowPanorama(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#C49A6C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
              >
                <MaterialIcons name="360" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Abrir Panorama</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showPanorama && (item as any).panorama_url && (
          <Panorama360View
            imageUrl={(item as any).panorama_url}
            title={item.name}
            onClose={() => setShowPanorama(false)}
          />
        )}

        {/* Location Map Preview */}
        {item.location && (
          <View style={styles.section}>
            <View style={styles.mapHeader}>
              <Text style={styles.sectionTitle}>Localização no Mapa</Text>
              <TouchableOpacity 
                style={styles.openMapsButton}
                onPress={() => {
                  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.location?.lat},${item.location?.lng}`;
                  const appleMapsUrl = `https://maps.apple.com/?q=${item.location?.lat},${item.location?.lng}`;
                  
                  if (Platform.OS === 'web') {
                    window.open(googleMapsUrl, '_blank');
                  } else if (Platform.OS === 'ios') {
                    // Try to open in Apple Maps first, fallback to Google Maps
                    Linking.canOpenURL(appleMapsUrl).then((supported) => {
                      if (supported) {
                        Linking.openURL(appleMapsUrl);
                      } else {
                        Linking.openURL(googleMapsUrl);
                      }
                    });
                  } else {
                    // Android - open Google Maps URL directly
                    Linking.openURL(googleMapsUrl);
                  }
                }}
              >
                <MaterialIcons name="open-in-new" size={16} color="#C49A6C" />
                <Text style={styles.openMapsButtonText}>Abrir no Maps</Text>
              </TouchableOpacity>
            </View>
            {Platform.OS === 'web' ? (
              /* Web: OpenStreetMap iframe embed */
              <View style={[styles.miniMapContainer, { overflow: 'hidden', borderRadius: 12 }]}>
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${(item.location?.lng || 0) - 0.015},${(item.location?.lat || 0) - 0.008},${(item.location?.lng || 0) + 0.015},${(item.location?.lat || 0) + 0.008}&layer=mapnik&marker=${item.location?.lat},${item.location?.lng}`}
                  style={{ width: '100%', height: '100%', border: 'none' } as any}
                  title="Localização no mapa"
                  loading="lazy"
                />
              </View>
            ) : _WebView ? (
              /* Native: Leaflet mini-map via WebView */
              <View style={[styles.miniMapContainer, { borderRadius: 12, overflow: 'hidden' }]}>
                <_WebView
                  style={{ flex: 1 }}
                  source={{ html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script><script>var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${item.location?.lat||39.5},${item.location?.lng||-8.0}],15);L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);L.circleMarker([${item.location?.lat||39.5},${item.location?.lng||-8.0}],{radius:8,fillColor:'#C49A6C',color:'#fff',weight:3,fillOpacity:1}).addTo(map);<\/script></body></html>` }}
                  javaScriptEnabled
                  domStorageEnabled
                  scrollEnabled={false}
                  bounces={false}
                  originWhitelist={['*']}
                  mixedContentMode="always"
                />
                <View style={styles.mapTapOverlay} pointerEvents="none">
                  <View style={styles.mapTapHintBottom}>
                    <MaterialIcons name="touch-app" size={14} color="#FFFFFF" />
                    <Text style={styles.mapTapHintText}>Toque &quot;Abrir no Maps&quot; para navegar</Text>
                  </View>
                </View>
              </View>
            ) : (
              /* Fallback: styled placeholder with coordinates */
              <View style={[styles.miniMapContainer, styles.miniMapFallback]}>
                <MaterialIcons name="map" size={36} color="#4A7C6A" />
                <Text style={styles.miniMapFallbackText}>{item.name}</Text>
                <Text style={styles.coordsTextCenter}>
                  {item.location?.lat.toFixed(4)}° N, {item.location?.lng.toFixed(4)}° W
                </Text>
              </View>
            )}
            <View style={styles.coordsRow}>
              <MaterialIcons name="gps-fixed" size={14} color="#64748B" />
              <Text style={styles.coordsText}>
                {item.location?.lat.toFixed(6)}, {item.location?.lng.toFixed(6)}
              </Text>
            </View>
          </View>
        )}

        {/* AI Narrative Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-stories" size={20} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Narrativa IA</Text>
          </View>
          
          {!showNarrative ? (
            <View>
              <Text style={styles.narrativeIntro}>
                Gere uma narrativa personalizada sobre este elemento do património.
              </Text>
              
              {/* Depth Level Selection */}
              <View style={styles.styleSelector}>
                {[
                  { id: 'snackable', label: 'Resumo', icon: 'flash-on', time: '30-60s' },
                  { id: 'historia', label: 'História', icon: 'menu-book', time: '3-5 min' },
                  { id: 'enciclopedico', label: 'Enciclopédia', icon: 'library-books', time: '7-12 min' },
                  { id: 'criancas', label: 'Crianças', icon: 'child-care', time: '1-2 min' },
                ].map((level) => (
                  <TouchableOpacity
                    key={level.id}
                    style={[
                      styles.styleOption,
                      depthLevel === level.id && styles.styleOptionActive,
                    ]}
                    onPress={() => setDepthLevel(level.id as ContentDepth)}
                  >
                    <MaterialIcons
                      name={level.icon as any}
                      size={18}
                      color={depthLevel === level.id ? '#8B5CF6' : '#64748B'}
                    />
                    <Text style={[
                      styles.styleOptionText,
                      depthLevel === level.id && styles.styleOptionTextActive,
                    ]}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cognitive Profile Selection */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4 }}>
                  <TouchableOpacity
                    style={[styles.styleOption, { paddingHorizontal: 10, paddingVertical: 6 }, !cognitiveProfile && styles.styleOptionActive]}
                    onPress={() => setCognitiveProfile(undefined)}
                  >
                    <Text style={[styles.styleOptionText, { fontSize: 11 }, !cognitiveProfile && styles.styleOptionTextActive]}>Geral</Text>
                  </TouchableOpacity>
                  {([
                    { id: 'gourmet', emoji: '\uD83C\uDF77', label: 'Gourmet' },
                    { id: 'familia', emoji: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', label: 'Família' },
                    { id: 'arquitetura', emoji: '\uD83C\uDFDB\uFE0F', label: 'Arquitetura' },
                    { id: 'natureza_radical', emoji: '\uD83C\uDFD4\uFE0F', label: 'Aventura' },
                    { id: 'historia_profunda', emoji: '\uD83D\uDCDC', label: 'História' },
                    { id: 'criancas', emoji: '\uD83E\uDDD2', label: 'Juniores' },
                  ] as const).map((profile) => (
                    <TouchableOpacity
                      key={profile.id}
                      style={[styles.styleOption, { paddingHorizontal: 10, paddingVertical: 6 }, cognitiveProfile === profile.id && styles.styleOptionActive]}
                      onPress={() => setCognitiveProfile(profile.id as CognitiveProfile)}
                    >
                      <Text style={{ fontSize: 12 }}>{profile.emoji}</Text>
                      <Text style={[styles.styleOptionText, { fontSize: 11 }, cognitiveProfile === profile.id && styles.styleOptionTextActive]}>{profile.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.generateButton, !isPremium && depthLevel !== 'snackable' && styles.generateButtonLocked]}
                onPress={() => {
                  if (depthLevel === 'snackable') {
                    setShowNarrative(true);
                  } else if (isPremium) {
                    setShowNarrative(true);
                  } else {
                    router.push('/premium');
                  }
                }}
              >
                <MaterialIcons
                  name={isPremium || depthLevel === 'snackable' ? 'auto-fix-high' : 'lock'}
                  size={20}
                  color="#2E5E4E"
                />
                <Text style={styles.generateButtonText}>
                  {depthLevel === 'snackable' ? 'Gerar Resumo' : isPremium ? 'Gerar Narrativa' : 'Narrativa Premium'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (narrativeLoading || depthLoading) ? (
            <View style={styles.narrativeLoading}>
              <ActivityIndicator size="small" color="#8B5CF6" />
              <Text style={styles.narrativeLoadingText}>A gerar narrativa...</Text>
            </View>
          ) : (depthData || narrativeData) ? (
            <View style={styles.narrativeContent}>
              {(depthData?.source === 'cache' || narrativeData?.generated_at === 'cached') && (
                <View style={styles.cachedBadge}>
                  <MaterialIcons name="offline-pin" size={12} color="#64748B" />
                  <Text style={styles.cachedBadgeText}>Guardado offline</Text>
                </View>
              )}
              {depthData?.credibility && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <MaterialIcons name="verified" size={12} color={depthData.credibility.confidence_level >= 0.7 ? '#22C55E' : '#F59E0B'} />
                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                    {depthData.credibility.source_type} · confiança {Math.round(depthData.credibility.confidence_level * 100)}%
                  </Text>
                </View>
              )}
              <Text style={styles.narrativeText}>{depthData?.content || narrativeData?.narrative}</Text>
              <View style={styles.narrativeActions}>
                {/* Ouvir narrativa — device TTS, free */}
                <TouchableOpacity
                  style={[styles.narrativeSpeakButton, isSpeakingNarrative && styles.narrativeSpeakButtonActive]}
                  onPress={() => handleSpeakNarrative(depthData?.content || narrativeData?.narrative || '')}
                  accessibilityLabel={isSpeakingNarrative ? 'Parar leitura' : 'Ouvir narrativa'}
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name={isSpeakingNarrative ? 'stop' : 'record-voice-over'}
                    size={16}
                    color={isSpeakingNarrative ? '#FFFFFF' : '#8B5CF6'}
                  />
                  <Text style={[styles.narrativeSpeakText, isSpeakingNarrative && { color: '#FFFFFF' }]}>
                    {isSpeakingNarrative ? 'Parar' : 'Ouvir'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.regenerateButton}
                  onPress={() => refetchNarrative()}
                >
                  <MaterialIcons name="refresh" size={16} color="#8B5CF6" />
                  <Text style={styles.regenerateButtonText}>Regenerar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avaliações</Text>
          <ReviewsSection 
            itemId={id as string}
            authToken={sessionToken || undefined}
            onLoginRequired={login}
          />
        </View>

        {/* Community Photo Gallery */}
        {communityPhotos && communityPhotos.images && communityPhotos.images.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="photo-library" size={20} color="#C49A6C" />
              <Text style={styles.sectionTitle}>Fotos da Comunidade</Text>
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>{communityPhotos.total}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery} contentContainerStyle={styles.photoGalleryContent}>
              {communityPhotos.images.map((photo, idx) => (
                <TouchableOpacity
                  key={photo.public_id || idx}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      window.open(photo.url, '_blank');
                    } else {
                      Linking.openURL(photo.url);
                    }
                  }}
                >
                  <OptimizedImage
                    uri={photo.thumbnail_url || photo.url}
                    style={styles.communityPhoto}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* User Photo Contribution */}
        {isAuthenticated && sessionToken && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="add-a-photo" size={20} color="#C49A6C" />
              <Text style={styles.sectionTitle}>Contribuir com Foto</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>
              Partilhe as suas fotos deste local com a comunidade.
            </Text>
            <ImageUpload
              token={sessionToken}
              context="poi"
              itemId={id as string}
              onUpload={(_url) => {
                queryClient.invalidateQueries({ queryKey: ['heritage', id] });
                queryClient.invalidateQueries({ queryKey: ['poi-images', id] });
                if (Platform.OS === 'web') {
                  window.alert('Foto adicionada com sucesso!');
                } else {
                  Alert.alert('Sucesso', 'Foto adicionada com sucesso!');
                }
              }}
            />
          </View>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {item.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons - Fixed at bottom */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        {/* AR Time-Travel button — prominent CTA */}
        <TouchableOpacity
          style={[styles.actionButton, styles.arButton]}
          onPress={() =>
            router.push({
              pathname: '/ar-time-travel',
              params: {
                itemId: id,
                itemName: item.name,
                itemCategory: item.category,
                itemRegion: item.region,
                imageUrl: item.image_url || '',
              },
            })
          }
          accessibilityLabel="Viajar no Tempo — ver como este local era no passado"
          accessibilityRole="button"
        >
          <MaterialIcons name="camera" size={22} color="#FAF8F3" />
          <Text style={styles.arButtonText}>Time-Travel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (item.location) {
              const url = Platform.select({
                ios: `maps://app?daddr=${item.location?.lat},${item.location?.lng}`,
                android: `google.navigation:q=${item.location?.lat},${item.location?.lng}`,
                default: `https://www.google.com/maps/dir/?api=1&destination=${item.location?.lat},${item.location?.lng}`,
              });
              if (Platform.OS === 'web') {
                window.open(url as string, '_blank');
              } else {
                import('react-native').then(({ Linking }) => Linking.openURL(url as string));
              }
            } else {
              Alert.alert('Localização', 'Coordenadas não disponíveis');
            }
          }}
        >
          <MaterialIcons name="place" size={22} color="#FAF8F3" />
          <Text style={styles.actionButtonText}>Localização</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => isPremium ? setShowNarrative(true) : router.push('/premium')}
        >
          <MaterialIcons name={isPremium ? 'auto-stories' : 'lock'} size={22} color="#2E5E4E" />
          <Text style={styles.actionButtonTextPrimary}>{isPremium ? 'Narrativa IA' : 'Narrativa Premium'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, (isPlayingAudio || isLoadingAudio) && styles.actionButtonActive]}
          onPress={handlePlayAudio}
          disabled={isLoadingAudio}
        >
          {isLoadingAudio ? (
            <ActivityIndicator size="small" color="#C49A6C" />
          ) : (
            <MaterialIcons
              name={!isPremium ? 'lock' : isPlayingAudio ? 'stop' : 'volume-up'}
              size={22}
              color={isPlayingAudio ? '#C49A6C' : '#FAF8F3'}
            />
          )}
          <Text style={[styles.actionButtonText, (isPlayingAudio || isLoadingAudio) && styles.actionButtonTextActive]}>
            {!isPremium ? 'Áudio Premium' : isLoadingAudio ? 'A carregar...' : isPlayingAudio ? 'Parar' : 'Ouvir'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.checkinButton]}
          onPress={() => {
            if (!userLocation) {
              const msg = 'Ative a localização para fazer check-in.';
              Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Localização', msg); // eslint-disable-line no-unused-expressions
              return;
            }
            checkinMutation.mutate();
          }}
          disabled={checkinMutation.isPending}
          data-testid="checkin-btn"
        >
          {checkinMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <MaterialIcons name="check-circle" size={22} color="#FFF" />
          )}
          <Text style={styles.checkinButtonText}>
            {checkinMutation.isPending ? 'A registar...' : 'Check-in'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={async () => {
            const shareUrl = Platform.OS === 'web' ? window.location.href : '';
            const shareText = `${item.name}\n${item.description?.substring(0, 100)}\n\n${shareUrl}`;
            if (Platform.OS === 'web') {
              // Try Web Share API first
              if (navigator.share) {
                try {
                  await navigator.share({ title: item.name, text: item.description?.substring(0, 100), url: shareUrl });
                  return;
                } catch { /* fallback to clipboard */ }
              }
              let copied = false;
              try {
                await navigator.clipboard.writeText(shareText);
                copied = true;
              } catch {
                try {
                  const ta = document.createElement('textarea');
                  ta.value = shareText;
                  ta.style.position = 'fixed';
                  ta.style.opacity = '0';
                  document.body.appendChild(ta);
                  ta.select();
                  copied = document.execCommand('copy');
                  document.body.removeChild(ta);
                } catch { /* ignore */ }
              }
              setShareCopied(copied);
              if (copied) setTimeout(() => setShareCopied(false), 2500);
            } else {
              Share.share({ title: item.name, message: shareText });
            }
          }}
          data-testid="bottom-share-button"
        >
          <MaterialIcons name={shareCopied ? 'check' : 'share'} size={22} color={shareCopied ? '#22C55E' : '#FAF8F3'} />
          <Text style={[styles.actionButtonText, shareCopied && { color: '#22C55E' }]}>{shareCopied ? 'Copiado!' : 'Partilhar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E5E4E',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginTop: 12,
  },
  heroImage: {
    width: '100%',
    height: 380,
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'space-between',
  },
  heroContent: {
    padding: 20,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: 13,
    color: '#FAF8F3',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FAF8F3',
    marginBottom: 12,
    lineHeight: 34,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 15,
    color: '#94A3B8',
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    marginBottom: 24,
  },
  regionText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#C8C3B8',
    lineHeight: 26,
  },
  mapPreview: {
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2F2A',
  },
  mapPreviewText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  miniMapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#264E41',
    marginBottom: 8,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C49A6C20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  openMapsButtonText: {
    fontSize: 12,
    color: '#C49A6C',
    fontWeight: '600',
  },
  mapLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#264E41',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mapLoadingText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  mapFallback: {
    flex: 1,
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallbackText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  staticMapImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
  },
  mapOverlayLight: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    padding: 12,
  },
  mapTapHintBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  mapPinContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mapTapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  mapTapHintText: {
    fontSize: 12,
    color: '#FAF8F3',
    fontWeight: '500',
  },
  miniMapWebView: {
    flex: 1,
    borderRadius: 12,
  },
  mapTapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    alignItems: 'center',
  },
  miniMapFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  miniMapFallbackText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
  },
  coordsTextCenter: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coordsText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  narrativeIntro: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  styleSelector: {
    gap: 8,
    marginBottom: 16,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2F2A',
    gap: 10,
  },
  styleOptionActive: {
    backgroundColor: '#8B5CF620',
    borderColor: '#8B5CF6',
  },
  styleOptionText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  styleOptionTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E5E4E',
  },
  generateButtonLocked: {
    backgroundColor: '#4A5568',
    opacity: 0.85,
  },
  narrativeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#264E41',
    padding: 24,
    borderRadius: 12,
    gap: 12,
  },
  narrativeLoadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  narrativeContent: {
    backgroundColor: '#264E41',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B5CF640',
  },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  cachedBadgeText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  narrativeText: {
    fontSize: 15,
    color: '#F2EDE4',
    lineHeight: 24,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  regenerateButtonText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  narrativeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  narrativeSpeakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  narrativeSpeakButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  narrativeSpeakText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  // Free resume styles
  freeResumeBox: {
    marginTop: 12,
  },
  freeResumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C49A6C40',
    backgroundColor: '#C49A6C15',
  },
  freeResumeButtonText: {
    fontSize: 13,
    color: '#C49A6C',
    fontWeight: '600',
  },
  freeResumeContent: {
    marginTop: 4,
  },
  freeResumeDivider: {
    height: 1,
    backgroundColor: '#C49A6C30',
    marginBottom: 12,
  },
  freeResumeText: {
    fontSize: 15,
    color: '#C8C3B8',
    lineHeight: 24,
  },
  freeResumeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  freeResumeFooterText: {
    fontSize: 11,
    color: '#C49A6C',
    fontStyle: 'italic',
    flex: 1,
  },
  freeResumeSpeakBtn: {
    padding: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#2A2F2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#C8C3B8',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#2E5E4E',
    borderTopWidth: 1,
    borderTopColor: '#264E41',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#264E41',
    minHeight: 64,
  },
  actionButtonPrimary: {
    backgroundColor: '#C49A6C',
  },
  actionButtonActive: {
    backgroundColor: '#1E3A5F',
    borderWidth: 1,
    borderColor: '#C49A6C',
  },
  actionButtonText: {
    fontSize: 11,
    color: '#FAF8F3',
    fontWeight: '600',
    marginTop: 4,
  },
  actionButtonTextActive: {
    color: '#C49A6C',
  },
  actionButtonTextPrimary: {
    fontSize: 11,
    color: '#2E5E4E',
    fontWeight: '700',
    marginTop: 4,
  },
  checkinButton: {
    backgroundColor: '#22C55E',
  },
  checkinButtonText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 4,
  },
  arButton: {
    backgroundColor: '#7C3AED',
  },
  arButtonText: {
    fontSize: 11,
    color: '#FAF8F3',
    fontWeight: '700',
    marginTop: 4,
  },
  // Community Photo Gallery
  photoBadge: {
    backgroundColor: 'rgba(196, 154, 108, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C49A6C',
  },
  photoGallery: {
    marginHorizontal: -20,
  },
  photoGalleryContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  communityPhoto: {
    width: 140,
    height: 100,
    borderRadius: 10,
    backgroundColor: '#1E3A3F',
  },
});
