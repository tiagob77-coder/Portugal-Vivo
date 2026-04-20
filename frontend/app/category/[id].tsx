import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ImageBackground, ScrollView, Dimensions, Platform, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getHeritageItems, getCategories } from '../../src/services/api';
import HeritageCard from '../../src/components/HeritageCard';
import AnimatedListItem from '../../src/components/AnimatedListItem';
import SkeletonCard from '../../src/components/SkeletonCard';
import { LinearGradient } from 'expo-linear-gradient';

const { width: _width, height: _height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Conditional import for WebView (only on native)
let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView; // eslint-disable-line @typescript-eslint/no-require-imports
}

// Region definitions
const REGIONS = [
  { id: 'all', name: 'Todas', icon: 'public' },
  { id: 'norte', name: 'Norte', icon: 'terrain' },
  { id: 'centro', name: 'Centro', icon: 'landscape' },
  { id: 'lisboa', name: 'Lisboa', icon: 'location-city' },
  { id: 'alentejo', name: 'Alentejo', icon: 'grass' },
  { id: 'algarve', name: 'Algarve', icon: 'beach-access' },
  { id: 'acores', name: 'Açores', icon: 'waves' },
  { id: 'madeira', name: 'Madeira', icon: 'forest' },
];

// Category metadata - covers both old and new subcategory IDs
const CATEGORY_META: Record<string, { icon: string; color: string; image: string }> = {
  // Territorio & Natureza
  percursos_pedestres: { icon: 'hiking', color: '#84CC16', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80' },
  aventura_natureza: { icon: 'sports-kabaddi', color: '#DC2626', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80' },
  natureza_especializada: { icon: 'science', color: '#7C3AED', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80' },
  fauna_autoctone: { icon: 'pets', color: '#65A30D', image: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&q=80' },
  flora_autoctone: { icon: 'eco', color: '#22C55E', image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80' },
  flora_botanica: { icon: 'local-florist', color: '#A3E635', image: 'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&q=80' },
  biodiversidade_avistamentos: { icon: 'visibility', color: '#10B981', image: 'https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=800&q=80' },
  miradouros: { icon: 'visibility', color: '#0284C7', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' },
  barragens_albufeiras: { icon: 'water', color: '#3B82F6', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80' },
  cascatas_pocos: { icon: 'water-drop', color: '#0891B2', image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80' },
  praias_fluviais: { icon: 'waves', color: '#0EA5E9', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80' },
  arqueologia_geologia: { icon: 'hexagon', color: '#78716C', image: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&q=80' },
  moinhos_azenhas: { icon: 'settings', color: '#78716C', image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80' },
  ecovias_passadicos: { icon: 'directions-walk', color: '#84CC16', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80' },
  // Historia & Patrimonio
  castelos: { icon: 'castle', color: '#92400E', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
  palacios_solares: { icon: 'villa', color: '#D97706', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80' },
  museus: { icon: 'museum', color: '#F59E0B', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80' },
  oficios_artesanato: { icon: 'construction', color: '#10B981', image: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&q=80' },
  termas_banhos: { icon: 'hot-tub', color: '#06B6D4', image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80' },
  patrimonio_ferroviario: { icon: 'train', color: '#6366F1', image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80' },
  arte_urbana: { icon: 'palette', color: '#E11D48', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80' },
  // Gastronomia & Produtos
  restaurantes_gastronomia: { icon: 'restaurant', color: '#EF4444', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80' },
  tabernas_historicas: { icon: 'local-bar', color: '#B45309', image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80' },
  mercados_feiras: { icon: 'storefront', color: '#F97316', image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80' },
  produtores_dop: { icon: 'verified', color: '#F97316', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80' },
  agroturismo_enoturismo: { icon: 'wine-bar', color: '#7C2D12', image: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80' },
  pratos_tipicos: { icon: 'lunch-dining', color: '#EF4444', image: 'https://images.unsplash.com/photo-1591107576521-87091dc07797?w=800&q=80' },
  docaria_regional: { icon: 'cake', color: '#EC4899', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80' },
  // Cultura Viva
  musica_tradicional: { icon: 'music-note', color: '#8B5CF6', image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80' },
  festivais_musica: { icon: 'festival', color: '#D946EF', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80' },
  festas_romarias: { icon: 'celebration', color: '#F59E0B', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80' },
  // Praias & Mar
  surf: { icon: 'surfing', color: '#0EA5E9', image: 'https://images.unsplash.com/photo-1502680390548-bdbac40b3e1a?w=800&q=80' },
  praias_fluviais_mar: { icon: 'waves', color: '#06B6D4', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80' },
  praias_bandeira_azul: { icon: 'beach-access', color: '#2563EB', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80' },
  // Experiencias & Rotas
  rotas_tematicas: { icon: 'route', color: '#EC4899', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' },
  grande_expedicao: { icon: 'explore', color: '#F59E0B', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80' },
  perolas_portugal: { icon: 'diamond', color: '#D946EF', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80' },
  alojamentos_rurais: { icon: 'cottage', color: '#92400E', image: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80' },
  parques_campismo: { icon: 'camping', color: '#22C55E', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80' },
  pousadas_juventude: { icon: 'hotel', color: '#3B82F6', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80' },
  agentes_turisticos: { icon: 'support-agent', color: '#14B8A6', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80' },
  entidades_operadores: { icon: 'business', color: '#6366F1', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80' },
  guia_viajante: { icon: 'menu-book', color: '#F97316', image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80' },
  transportes: { icon: 'directions-bus', color: '#78716C', image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80' },
  // Legacy IDs (backward compat)
  lendas: { icon: 'menu-book', color: '#8B5CF6', image: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80' },
  festas: { icon: 'celebration', color: '#F43F5E', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80' },
  gastronomia: { icon: 'restaurant-menu', color: '#EF4444', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80' },
  percursos: { icon: 'hiking', color: '#10B981', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80' },
  termas: { icon: 'hot-tub', color: '#06B6D4', image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80' },
  tascas: { icon: 'local-bar', color: '#BE185D', image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80' },
  cascatas: { icon: 'water', color: '#14B8A6', image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80' },
  aventura: { icon: 'sports-kabaddi', color: '#DC2626', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80' },
  moinhos: { icon: 'settings', color: '#A1A1AA', image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80' },
  areas_protegidas: { icon: 'park', color: '#22C55E', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80' },
  rotas: { icon: 'route', color: '#EC4899', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' },
  comunidade: { icon: 'groups', color: '#FB923C', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80' },
  produtos: { icon: 'shopping-basket', color: '#84CC16', image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80' },
  fauna: { icon: 'pets', color: '#A3E635', image: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&q=80' },
  arte: { icon: 'palette', color: '#EC4899', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80' },
  arqueologia: { icon: 'account-balance', color: '#78716C', image: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&q=80' },
  piscinas: { icon: 'pool', color: '#0EA5E9', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80' },
  religioso: { icon: 'church', color: '#7C3AED', image: 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800&q=80' },
  saberes: { icon: 'auto-fix-high', color: '#C49A6C', image: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&q=80' },
  crencas: { icon: 'self-improvement', color: '#C084FC', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80' },
  aldeias: { icon: 'holiday-village', color: '#B08556', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80' },
  rios: { icon: 'waves', color: '#3B82F6', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80' },
  minerais: { icon: 'diamond', color: '#64748B', image: 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=800&q=80' },
  cogumelos: { icon: 'eco', color: '#92400E', image: 'https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=800&q=80' },
  baloicos: { icon: 'airlines', color: '#7DD3FC', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80' },
};

// Calculate map center from items
const calculateMapCenter = (items: any[]) => {
  if (!items || items.length === 0) {
    return { lat: 39.5, lng: -8.0 }; // Default Portugal center
  }
  
  const itemsWithLocation = items.filter(item => item.location);
  if (itemsWithLocation.length === 0) {
    return { lat: 39.5, lng: -8.0 };
  }
  
  const sumLat = itemsWithLocation.reduce((sum, item) => sum + item.location?.lat, 0);
  const sumLng = itemsWithLocation.reduce((sum, item) => sum + item.location?.lng, 0);
  
  return {
    lat: sumLat / itemsWithLocation.length,
    lng: sumLng / itemsWithLocation.length,
  };
};

// Calculate zoom level based on items spread
const calculateZoom = (items: any[]) => {
  if (!items || items.length === 0) return 6;
  
  const itemsWithLocation = items.filter(item => item.location);
  if (itemsWithLocation.length === 0) return 6;
  if (itemsWithLocation.length === 1) return 12;
  
  const lats = itemsWithLocation.map(item => item.location?.lat);
  const lngs = itemsWithLocation.map(item => item.location?.lng);
  
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const maxSpread = Math.max(latSpread, lngSpread);
  
  if (maxSpread > 5) return 6;
  if (maxSpread > 3) return 7;
  if (maxSpread > 1) return 8;
  if (maxSpread > 0.5) return 9;
  return 10;
};

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['categoryItems', id],
    queryFn: () => getHeritageItems({ category: id, limit: 500 }),
    enabled: !!id,
  });

  const category = categories.find(c => c.id === id);
  const meta = CATEGORY_META[id || ''] || { icon: 'category', color: '#C49A6C', image: CATEGORY_META.lendas.image };

  // Partnership categories — visible but not yet available
  const COMING_SOON_IDS = ['alojamentos_rurais', 'agentes_turisticos', 'entidades_operadores'];
  const isComingSoon = COMING_SOON_IDS.includes(id || '');

  // Filter items by region
  const filteredItems = useMemo(() => {
    if (selectedRegion === 'all') return items;
    return items.filter(item => item.region === selectedRegion);
  }, [items, selectedRegion]);

  // Get regions with item counts
  const regionsWithCounts = useMemo(() => {
    return REGIONS.map(region => {
      const count = region.id === 'all' 
        ? items.length 
        : items.filter(item => item.region === region.id).length;
      return { ...region, count };
    }).filter(region => region.count > 0 || region.id === 'all');
  }, [items]);

  // Map center and zoom
  const mapCenter = useMemo(() => calculateMapCenter(filteredItems), [filteredItems]);
  const mapZoom = useMemo(() => calculateZoom(filteredItems), [filteredItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Open Google Maps with location name for full features
  const openInGoogleMaps = (item: any) => {
    // Use place search by name + coordinates for best results with all Google Maps features
    const query = encodeURIComponent(`${item.name}, ${item.address || 'Portugal'}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  // Generate map HTML for WebView
  const getMapHTML = () => {
    const itemsWithLocation = filteredItems.filter(item => item.location);
    const markers = itemsWithLocation.map((item, _index) => `
      {
        position: { lat: ${item.location?.lat}, lng: ${item.location?.lng} },
        title: "${item.name.replace(/"/g, '\\"')}",
        address: "${(item.address || '').replace(/"/g, '\\"')}",
        id: "${item.id}"
      }
    `).join(',');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; width: 100%; }
          #map { height: 100%; width: 100%; }
          .info-window {
            max-width: 280px;
            padding: 8px;
          }
          .info-window h3 {
            font-size: 15px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 4px;
          }
          .info-window p {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .info-window button {
            background: #C49A6C;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
          }
          .info-window button:hover {
            background: #B08556;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          let map;
          let markers = [];
          let currentInfoWindow = null;
          
          function initMap() {
            map = new google.maps.Map(document.getElementById('map'), {
              center: { lat: ${mapCenter.lat}, lng: ${mapCenter.lng} },
              zoom: ${mapZoom},
              styles: [
                { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c4a6e" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#2A2F2A" }] },
                { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#166534" }] },
              ],
              mapTypeControl: true,
              mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                position: google.maps.ControlPosition.TOP_RIGHT
              },
              streetViewControl: true,
              fullscreenControl: true,
              zoomControl: true,
            });
            
            const data = [${markers}];
            
            data.forEach((item, index) => {
              const marker = new google.maps.Marker({
                position: item.position,
                map: map,
                title: item.title,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: '${meta.color}',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
                animation: google.maps.Animation.DROP,
              });
              
              const infoContent = \`
                <div class="info-window">
                  <h3>\${item.title}</h3>
                  <p>\${item.address || 'Portugal'}</p>
                  <button onclick="openInMaps('\${item.title}', '\${item.address || 'Portugal'}')">
                    Abrir no Google Maps
                  </button>
                </div>
              \`;
              
              const infoWindow = new google.maps.InfoWindow({
                content: infoContent,
              });
              
              marker.addListener('click', () => {
                if (currentInfoWindow) {
                  currentInfoWindow.close();
                }
                infoWindow.open(map, marker);
                currentInfoWindow = infoWindow;
              });
              
              markers.push(marker);
            });
            
            // Fit bounds if multiple markers
            if (markers.length > 1) {
              const bounds = new google.maps.LatLngBounds();
              markers.forEach(marker => bounds.extend(marker.getPosition()));
              map.fitBounds(bounds, { padding: 50 });
            }
          }
          
          function openInMaps(name, address) {
            const query = encodeURIComponent(name + ', ' + address);
            window.open('https://www.google.com/maps/search/?api=1&query=' + query, '_blank');
          }
        </script>
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
      </body>
      </html>
    `;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Hero Header */}
      <ImageBackground
        source={{ uri: meta.image }}
        style={[styles.heroHeader, { paddingTop: insets.top }]}
        imageStyle={styles.heroImageStyle}
      >
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.9)']}
          style={styles.heroGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
            </TouchableOpacity>
            <View style={styles.viewToggle}>
              <TouchableOpacity 
                style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
                onPress={() => setViewMode('list')}
              >
                <MaterialIcons name="list" size={20} color={viewMode === 'list' ? '#2E5E4E' : '#FAF8F3'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
                onPress={() => setViewMode('map')}
              >
                <MaterialIcons name="map" size={20} color={viewMode === 'map' ? '#2E5E4E' : '#FAF8F3'} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.heroContent}>
            <View style={[styles.categoryIconBg, { backgroundColor: meta.color + '30' }]}>
              <MaterialIcons name={meta.icon as any} size={28} color={meta.color} />
            </View>
            <Text style={styles.heroTitle}>{category?.name || id}</Text>
            <Text style={styles.heroSubtitle}>
              {filteredItems.length} {filteredItems.length === 1 ? 'lugar' : 'lugares'} 
              {selectedRegion !== 'all' && ` em ${REGIONS.find(r => r.id === selectedRegion)?.name}`}
            </Text>
          </View>
        </LinearGradient>
      </ImageBackground>

      {/* Region Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {regionsWithCounts.map((region) => (
            <TouchableOpacity
              key={region.id}
              style={[
                styles.filterChip,
                selectedRegion === region.id && [styles.filterChipActive, { backgroundColor: meta.color }]
              ]}
              onPress={() => setSelectedRegion(region.id)}
            >
              <MaterialIcons 
                name={region.icon as any} 
                size={16} 
                color={selectedRegion === region.id ? '#2E5E4E' : '#94A3B8'} 
              />
              <Text style={[
                styles.filterChipText,
                selectedRegion === region.id && styles.filterChipTextActive
              ]}>
                {region.name}
              </Text>
              <View style={[
                styles.filterChipCount,
                selectedRegion === region.id && styles.filterChipCountActive
              ]}>
                <Text style={[
                  styles.filterChipCountText,
                  selectedRegion === region.id && styles.filterChipCountTextActive
                ]}>
                  {region.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {isComingSoon ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="lock-clock" size={64} color="#C49A6C" />
          <Text style={styles.emptyTitle}>Brevemente disponivel</Text>
          <Text style={styles.emptySubtitle}>
            {category?.name || id} estara disponivel na fase de parcerias. Estamos a trabalhar para trazer a melhor experiencia!
          </Text>
          <TouchableOpacity
            style={[styles.resetFilterButton, { backgroundColor: meta.color }]}
            onPress={() => router.back()}
          >
            <Text style={styles.resetFilterButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <SkeletonCard variant="heritage" count={5} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="inbox" size={64} color="#3D4A3D" />
          <Text style={styles.emptyTitle}>Sem resultados</Text>
          <Text style={styles.emptySubtitle}>
            {selectedRegion !== 'all' 
              ? `Não existem locais em ${REGIONS.find(r => r.id === selectedRegion)?.name}`
              : 'Esta categoria ainda não tem items disponíveis'}
          </Text>
          {selectedRegion !== 'all' && (
            <TouchableOpacity 
              style={[styles.resetFilterButton, { backgroundColor: meta.color }]} 
              onPress={() => setSelectedRegion('all')}
            >
              <Text style={styles.resetFilterButtonText}>Ver todas as regiões</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : viewMode === 'list' ? (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#C49A6C"
              colors={['#C49A6C']}
            />
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index} stagger={40}>
              <HeritageCard
                item={item}
                categories={categories}
                onPress={() => router.push(`/heritage/${item.id}`)}
              />
            </AnimatedListItem>
          )}
        />
      ) : (
        /* Map View */
        <View style={styles.mapContainer}>
          {Platform.OS !== 'web' && WebView ? (
            <WebView
              source={{ html: getMapHTML() }}
              style={styles.map}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color="#C49A6C" />
                  <Text style={styles.mapLoadingText}>A carregar mapa...</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.webMapFallback}>
              <MaterialIcons name="map" size={64} color="#3D4A3D" />
              <Text style={styles.webMapTitle}>Mapa Interativo</Text>
              <Text style={styles.webMapSubtitle}>
                {filteredItems.filter(i => i.location).length} locais com coordenadas
              </Text>
              <TouchableOpacity 
                style={[styles.openMapButton, { backgroundColor: meta.color }]}
                onPress={() => {
                  const url = `https://www.google.com/maps/search/${encodeURIComponent(category?.name || id)}+Portugal`;
                  if (Platform.OS === 'web') {
                    window.open(url, '_blank');
                  } else {
                    Linking.openURL(url);
                  }
                }}
              >
                <MaterialIcons name="open-in-new" size={18} color="#2E5E4E" />
                <Text style={styles.openMapButtonText}>Abrir no Google Maps</Text>
              </TouchableOpacity>
              
              {/* Quick list of items with location */}
              <ScrollView style={styles.quickList} showsVerticalScrollIndicator={false}>
                {filteredItems.filter(i => i.location).slice(0, 10).map(item => (
                  <TouchableOpacity 
                    key={item.id}
                    style={styles.quickListItem}
                    onPress={() => openInGoogleMaps(item)}
                  >
                    <MaterialIcons name="place" size={18} color={meta.color} />
                    <View style={styles.quickListItemInfo}>
                      <Text style={styles.quickListItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.quickListItemAddress} numberOfLines={1}>{item.address}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#64748B" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E5E4E',
  },
  heroHeader: {
    height: 180,
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    width: 40,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#C49A6C',
  },
  heroContent: {
    alignItems: 'flex-start',
  },
  categoryIconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#C8C3B8',
  },
  filtersContainer: {
    backgroundColor: '#264E41',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2F2A',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#2A2F2A',
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#C49A6C',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#2E5E4E',
  },
  filterChipCount: {
    backgroundColor: '#3D4A3D',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  filterChipCountActive: {
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
  },
  filterChipCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C8C3B8',
  },
  filterChipCountTextActive: {
    color: '#2E5E4E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FAF8F3',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  resetFilterButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  resetFilterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E5E4E',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2E5E4E',
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
  },
  webMapFallback: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  webMapTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FAF8F3',
    marginTop: 16,
  },
  webMapSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 20,
  },
  openMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  openMapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E5E4E',
  },
  quickList: {
    flex: 1,
    width: '100%',
    marginTop: 24,
  },
  quickListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#264E41',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  quickListItemInfo: {
    flex: 1,
  },
  quickListItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FAF8F3',
  },
  quickListItemAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
