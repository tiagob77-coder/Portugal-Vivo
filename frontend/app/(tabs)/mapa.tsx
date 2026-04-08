/**
 * Mapa Inteligente - Tab
 * Interactive map with contextually activatable layers
 * Based on Strategic Report Section 4
 * 
 * - Native (iOS/Android): Uses react-native-maps with Google Maps
 * - Web: Uses a list-based fallback interface
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/services/api';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography, spacing, borders, shadows } from '../../src/theme';
// import { categoryColors } from '../../src/context/ThemeContext';
import AccessibilityFilters from '../../src/components/AccessibilityFilters';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, isMapAvailable, LeafletMapComponent } from '../../src/components/NativeMap';
import { GoogleMapComponent } from '../../src/components/GoogleMapComponent';
import {
  MapLayerSelector,
  MapModeSelector,
  TimelineControls,
  ProximityPanel,
  NightExplorerPanel,
  NIGHT_FILTERS,
} from '../../src/components/map';
import type { MapMode } from '../../src/components/map';

const { width: _width, height: _height } = Dimensions.get('window');

// Map layers based on strategic report
const MAP_LAYERS = [
  { id: 'territorio_natureza', name: 'Natureza', icon: 'terrain', color: '#3F6F4A' },
  { id: 'historia_patrimonio', name: 'Património', icon: 'account-balance', color: '#C49A6C' },
  { id: 'gastronomia_produtos', name: 'Gastronomia', icon: 'restaurant', color: '#EF4444' },
  { id: 'cultura_viva', name: 'Cultura & Eventos', icon: 'event', color: '#8B5CF6' },
  { id: 'praias_mar', name: 'Praias & Mar', icon: 'beach-access', color: '#06B6D4' },
  { id: 'experiencias_rotas', name: 'Experiências', icon: 'hiking', color: '#84CC16' },
];

// All 44 subcategories grouped by main category
const SUBCATEGORIES: Record<string, { id: string; name: string; icon: string; comingSoon?: boolean }[]> = {
  territorio_natureza: [
    { id: 'percursos_pedestres', name: 'Percursos Pedestres', icon: 'hiking' },
    { id: 'aventura_natureza', name: 'Aventura e Natureza', icon: 'terrain' },
    { id: 'natureza_especializada', name: 'Natureza Especializada', icon: 'eco' },
    { id: 'fauna_autoctone', name: 'Fauna Autóctone', icon: 'pets' },
    { id: 'flora_autoctone', name: 'Flora Autóctone', icon: 'local-florist' },
    { id: 'flora_botanica', name: 'Flora Botânica', icon: 'park' },
    { id: 'biodiversidade_avistamentos', name: 'Biodiversidade', icon: 'visibility' },
    { id: 'miradouros', name: 'Miradouros', icon: 'panorama' },
    { id: 'barragens_albufeiras', name: 'Barragens e Albufeiras', icon: 'water' },
    { id: 'cascatas_pocos', name: 'Cascatas e Poços', icon: 'waves' },
    { id: 'praias_fluviais', name: 'Praias Fluviais', icon: 'pool' },
    { id: 'arqueologia_geologia', name: 'Arqueologia e Geologia', icon: 'diamond' },
    { id: 'moinhos_azenhas', name: 'Moinhos e Azenhas', icon: 'settings' },
    { id: 'ecovias_passadicos', name: 'Ecovias e Passadiços', icon: 'directions-walk' },
  ],
  historia_patrimonio: [
    { id: 'castelos', name: 'Castelos', icon: 'fort' },
    { id: 'palacios_solares', name: 'Palácios e Solares', icon: 'villa' },
    { id: 'museus', name: 'Museus', icon: 'museum' },
    { id: 'oficios_artesanato', name: 'Ofícios e Artesanato', icon: 'handyman' },
    { id: 'termas_banhos', name: 'Termas e Banhos', icon: 'hot-tub' },
    { id: 'patrimonio_ferroviario', name: 'Património Ferroviário', icon: 'train' },
    { id: 'arte_urbana', name: 'Arte Urbana', icon: 'palette' },
  ],
  gastronomia_produtos: [
    { id: 'restaurantes_gastronomia', name: 'Restaurantes', icon: 'restaurant' },
    { id: 'tabernas_historicas', name: 'Tabernas Históricas', icon: 'local-bar' },
    { id: 'mercados_feiras', name: 'Mercados e Feiras', icon: 'storefront' },
    { id: 'produtores_dop', name: 'Produtores DOP', icon: 'agriculture' },
    { id: 'agroturismo_enoturismo', name: 'Agroturismo e Enoturismo', icon: 'wine-bar' },
    { id: 'pratos_tipicos', name: 'Pratos Típicos', icon: 'lunch-dining' },
    { id: 'docaria_regional', name: 'Doçaria Regional', icon: 'cake' },
  ],
  cultura_viva: [
    { id: 'musica_tradicional', name: 'Música Tradicional', icon: 'music-note' },
    { id: 'festivais_musica', name: 'Festivais de Música', icon: 'celebration' },
    { id: 'festas_romarias', name: 'Festas e Romarias', icon: 'festival' },
  ],
  praias_mar: [
    { id: 'surf', name: 'Surf', icon: 'surfing' },
    { id: 'praias_fluviais_mar', name: 'Praias Fluviais', icon: 'pool' },
    { id: 'praias_bandeira_azul', name: 'Praias Bandeira Azul', icon: 'flag' },
  ],
  experiencias_rotas: [
    { id: 'rotas_tematicas', name: 'Rotas Temáticas', icon: 'route' },
    { id: 'grande_expedicao', name: 'Grande Expedição 2026', icon: 'explore' },
    { id: 'perolas_portugal', name: 'Pérolas de Portugal', icon: 'star' },
    { id: 'alojamentos_rurais', name: 'Alojamentos Rurais', icon: 'cottage', comingSoon: true },
    { id: 'parques_campismo', name: 'Parques de Campismo', icon: 'holiday-village' },
    { id: 'pousadas_juventude', name: 'Pousadas de Juventude', icon: 'hotel' },
    { id: 'agentes_turisticos', name: 'Agentes Turísticos', icon: 'support-agent', comingSoon: true },
    { id: 'entidades_operadores', name: 'Entidades e Operadores', icon: 'business', comingSoon: true },
    { id: 'guia_viajante', name: 'Guia do Viajante', icon: 'menu-book' },
    { id: 'transportes', name: 'Transportes', icon: 'directions-bus' },
  ],
};

const MAP_REGIONS = [
  { id: 'norte', name: 'Norte', color: '#3B82F6' },
  { id: 'centro', name: 'Centro', color: '#10B981' },
  { id: 'lisboa', name: 'Lisboa', color: '#F59E0B' },
  { id: 'alentejo', name: 'Alentejo', color: '#D97706' },
  { id: 'algarve', name: 'Algarve', color: '#EF4444' },
  { id: 'acores', name: 'Açores', color: '#6366F1' },
  { id: 'madeira', name: 'Madeira', color: '#EC4899' },
];

// Layer color map for subcategories
const getLayerColor = (categoryId: string): string => {
  for (const layer of MAP_LAYERS) {
    if (SUBCATEGORIES[layer.id]?.some(s => s.id === categoryId)) {
      return layer.color;
    }
  }
  return '#64748B';
};

// All subcategory IDs for a layer
const getLayerSubcategories = (layerId: string): string[] => {
  return (SUBCATEGORIES[layerId] || []).map(s => s.id);
};

interface MapItem {
  id: string;
  name: string;
  category: string;
  region: string;
  location: { lat: number; lng: number };
  image_url?: string;
  description?: string;
  iq_score?: number;
}

const getMapItems = async (categories?: string[], region?: string | null): Promise<MapItem[]> => {
  const searchParams = new URLSearchParams();
  if (categories?.length) searchParams.set('categories', categories.join(','));
  if (region) searchParams.set('region', region);
  const qs = searchParams.toString();
  const response = await api.get(`/map/items${qs ? '?' + qs : ''}`);
  return response.data;
};

// Portugal initial region
const PORTUGAL_REGION = {
  latitude: 39.5,
  longitude: -8.0,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
];

export default function MapaTab() {
  const router = useRouter();
  const { region: regionParam, t: navTimestamp } = useLocalSearchParams<{ region?: string; t?: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);
  const [activeLayers, setActiveLayers] = useState<string[]>(['historia_patrimonio']);
  const [activeSubcategories, setActiveSubcategories] = useState<string[]>(
    (SUBCATEGORIES['historia_patrimonio'] || []).map(s => s.id)
  );
  const [expandedLayer, setExpandedLayer] = useState<string | null>('historia_patrimonio');
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [_mapReady, setMapReady] = useState(false);
  const [accessibilityFilters, setAccessibilityFilters] = useState<string[]>([]);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('markers');
  const [selectedTrail, setSelectedTrail] = useState<string | null>(null);
  const [selectedEpochs, setSelectedEpochs] = useState<string[]>([]);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [gpxUploading, setGpxUploading] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [proximityLoading, setProximityLoading] = useState(false);
  const timelineRef = useRef<any>(null);

  // Timeline epochs in chronological order
  const TIMELINE_EPOCHS = [
    { id: 'pre_historia', name: 'Pré-História', year: -218, color: '#8B4513', period: 'Antes de 218 a.C.' },
    { id: 'romano', name: 'Romano', year: 0, color: '#DC2626', period: '218 a.C. - 409 d.C.' },
    { id: 'medieval', name: 'Medieval', year: 600, color: '#7C3AED', period: '409 - 1415' },
    { id: 'manuelino', name: 'Descobrimentos', year: 1500, color: '#2563EB', period: '1415 - 1580' },
    { id: 'barroco', name: 'Barroco', year: 1700, color: '#B08556', period: '1580 - 1820' },
    { id: 'contemporaneo', name: 'Contemporâneo', year: 1920, color: '#059669', period: '1820 - Presente' },
  ];

  // Apply region filter from navigation params
  useEffect(() => {
    if (regionParam && typeof regionParam === 'string') {
      setRegionFilter(regionParam);
      // Activate all layers and subcategories when filtering by region
      setActiveLayers(MAP_LAYERS.map(l => l.id));
      const allSubs = MAP_LAYERS.flatMap(l => getLayerSubcategories(l.id));
      setActiveSubcategories(allSubs);
    }
  }, [regionParam, navTimestamp]);

  // Timeline animation effect
  useEffect(() => {
    if (timelinePlaying && mapMode === 'timeline') {
      timelineRef.current = setInterval(() => {
        setTimelineIndex(prev => {
          if (prev >= TIMELINE_EPOCHS.length - 1) {
            setTimelinePlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2500);
    }
    return () => {
      if (timelineRef.current) clearInterval(timelineRef.current);
    };
  }, [timelinePlaying, mapMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auto-select epoch when timeline index changes
  const timelineEpoch = TIMELINE_EPOCHS[timelineIndex];

  // Timeline map items query
  const { data: timelineMapItems, isLoading: timelineLoading } = useQuery({
    queryKey: ['timeline-map-items', timelineEpoch?.id],
    queryFn: async () => {
      const res = await api.get(`/epochs/map-items?epoch_ids=${timelineEpoch.id}`);
      return res.data;
    },
    enabled: mapMode === 'timeline' && !!timelineEpoch,
  });

  // GPX Upload handler — web uses <input>, native uses expo-document-picker
  const handleGpxUpload = async () => {
    setGpxUploading(true);
    try {
      let fileBlob: Blob | null = null;
      let fileName = 'trail.gpx';

      if (Platform.OS === 'web') {
        // Web: use hidden file input
        fileBlob = await new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.gpx,application/gpx+xml,application/octet-stream';
          input.onchange = (e: any) => resolve(e.target.files?.[0] ?? null);
          input.oncancel = () => resolve(null);
          input.click();
        });
        if (!fileBlob) { setGpxUploading(false); return; }
        fileName = (fileBlob as any).name || fileName;
      } else {
        // Native: expo-document-picker
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/gpx+xml', 'application/octet-stream', '*/*'],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) { setGpxUploading(false); return; }
        const asset = result.assets[0];
        fileName = asset.name;
        // Fetch file content from local URI as blob
        const response = await fetch(asset.uri);
        fileBlob = await response.blob();
      }

      const formData = new FormData();
      formData.append('file', fileBlob, fileName);
      const res = await api.post('/trails/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.id) {
        setSelectedTrail(res.data.id);
        const msg = `Trilho "${res.data.name}" carregado! ${res.data.distance_km}km`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Trilho carregado', msg);
      }
    } catch (_err) {
      const msg = 'Erro ao carregar ficheiro GPX. Verifique o formato.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Erro', msg);
    } finally {
      setGpxUploading(false);
    }
  };

  // Active categories = directly from selected subcategories
  const activeCategories = activeSubcategories;

  // Trail-specific categories: only walking routes
  const TRAIL_CATEGORIES = ['percursos_pedestres', 'ecovias_passadicos'];

  const { data: mapItems, isLoading, refetch: _refetch } = useQuery({
    queryKey: ['map-items', activeCategories, regionFilter, mapMode],
    queryFn: () => {
      // In trails mode, only show walking routes
      if (mapMode === 'trails') {
        return getMapItems(TRAIL_CATEGORIES, regionFilter);
      }
      return getMapItems(activeCategories, regionFilter);
    },
    enabled: (activeCategories.length > 0 || mapMode === 'trails') && !['epochs'].includes(mapMode),
  });

  // Debug: log when mapItems changes
  useEffect(() => {
    console.log('[Mapa] mapItems updated:', mapItems?.length, 'items');
  }, [mapItems]);

  // Trails data
  const { data: trailsData } = useQuery({
    queryKey: ['trails-list'],
    queryFn: async () => {
      const res = await api.get('/trails');
      // API returns { trails: [...], total: N } — extract array
      return Array.isArray(res.data) ? res.data : (res.data?.trails || []);
    },
    enabled: mapMode === 'trails',
  });
  const trailsList = Array.isArray(trailsData) ? trailsData : [];

  // Auto-select first trail when entering trails mode (if none selected)
  useEffect(() => {
    if (mapMode === 'trails' && !selectedTrail && trailsList?.length > 0) {
      setSelectedTrail(trailsList[0].id);
    }
    if (mapMode !== 'trails') {
      setSelectedTrail(null);
    }
  }, [mapMode, trailsList]);

  const { data: trailData } = useQuery({
    queryKey: ['trail-detail', selectedTrail],
    queryFn: async () => {
      const res = await api.get(`/trails/${selectedTrail}`);
      return res.data;
    },
    enabled: !!selectedTrail,
  });

  const { data: trailElevation } = useQuery({
    queryKey: ['trail-elevation', selectedTrail],
    queryFn: async () => {
      const res = await api.get(`/trails/elevation/${selectedTrail}`);
      return res.data;
    },
    enabled: !!selectedTrail,
  });

  // Epochs data
  const { data: epochsList } = useQuery({
    queryKey: ['epochs-list'],
    queryFn: async () => {
      const res = await api.get('/epochs');
      return res.data;
    },
  });

  const { data: epochMapItems, isLoading: epochsLoading } = useQuery({
    queryKey: ['epoch-map-items', selectedEpochs],
    queryFn: async () => {
      const res = await api.get(`/epochs/map-items?epoch_ids=${selectedEpochs.join(',')}`);
      return res.data;
    },
    enabled: mapMode === 'epochs' && selectedEpochs.length > 0,
  });

  // Proximity data
  const { data: proximityData, isLoading: proximityDataLoading, refetch: _refetchProximity } = useQuery({
    queryKey: ['proximity-nearby', userLocation?.lat, userLocation?.lng],
    queryFn: async () => {
      const res = await api.get(`/proximity/nearby?lat=${userLocation!.lat}&lng=${userLocation!.lng}&radius_km=5&limit=20`);
      return res.data;
    },
    enabled: mapMode === 'proximity' && !!userLocation,
  });

  // Get user location when proximity mode is selected
  useEffect(() => {
    if (mapMode === 'proximity' && Platform.OS === 'web' && !userLocation) {
      setProximityLoading(true);
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setProximityLoading(false);
        },
        () => {
          // Default to Lisbon if geolocation fails
          setUserLocation({ lat: 38.7223, lng: -9.1393 });
          setProximityLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, [mapMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Explorador mode — technical overlays (weather, fires, surf)
  const { data: exploradorWeather } = useQuery({
    queryKey: ['explorador-weather'],
    queryFn: async () => { const res = await api.get('/weather/forecast?region=lisboa'); return res.data; },
    enabled: mapMode === 'explorador',
    staleTime: 30 * 60 * 1000,
  });
  const { data: exploradorFires } = useQuery({
    queryKey: ['explorador-fires'],
    queryFn: async () => { const res = await api.get('/safety/fires'); return res.data; },
    enabled: mapMode === 'explorador',
    staleTime: 5 * 60 * 1000,
  });
  const { data: exploradorSurf } = useQuery({
    queryKey: ['explorador-surf'],
    queryFn: async () => { const res = await api.get('/surf/all-spots'); return res.data; },
    enabled: mapMode === 'explorador',
    staleTime: 5 * 60 * 1000,
  });

  // Night explorer data
  const { data: nightData, isLoading: nightLoading } = useQuery({
    queryKey: ['night-explorer'],
    queryFn: async () => {
      const res = await api.get('/map/night-explorer');
      return res.data;
    },
    enabled: mapMode === 'noturno',
  });

  // NIGHT_FILTERS imported from components/map/NightExplorerPanel
  const [nightFilter, setNightFilter] = useState('all');

  const nightItems = mapMode === 'noturno'
    ? (nightData?.items || []).filter((i: any) => nightFilter === 'all' || i.night_type === nightFilter)
    : [];

  // Create stable items reference for the map component
  // DEBUG: Using direct calculation without useMemo to debug
  let mapComponentItems: any[];
  if (mapMode === 'noturno') {
    mapComponentItems = nightItems;
  } else if (mapMode === 'proximity') {
    mapComponentItems = (proximityData?.pois?.map((p: any) => ({ ...p, location: p.location || { lat: 0, lng: 0 } })) || []);
  } else if (mapMode === 'epochs') {
    mapComponentItems = epochMapItems || [];
  } else if (mapMode === 'timeline') {
    mapComponentItems = timelineMapItems || [];
  } else {
    mapComponentItems = mapItems || [];
  }
  console.log('[Mapa] mapComponentItems calculated:', mapComponentItems?.length, 'items, mapMode:', mapMode);

  const toggleLayer = (layerId: string) => {
    const layerSubs = getLayerSubcategories(layerId);
    const allActive = layerSubs.every(s => activeSubcategories.includes(s));
    
    if (allActive) {
      // Deactivate all subs of this layer
      setActiveSubcategories(prev => prev.filter(s => !layerSubs.includes(s)));
      setActiveLayers(prev => prev.filter(l => l !== layerId));
    } else {
      // Activate all subs of this layer
      setActiveSubcategories(prev => [...new Set([...prev, ...layerSubs])]);
      setActiveLayers(prev => prev.includes(layerId) ? prev : [...prev, layerId]);
    }
    setExpandedLayer(allActive ? null : layerId);
    setSelectedItem(null);
  };

  const toggleSubcategory = (subcatId: string, layerId: string) => {
    setActiveSubcategories(prev => {
      const next = prev.includes(subcatId)
        ? prev.filter(s => s !== subcatId)
        : [...prev, subcatId];
      
      // Update activeLayers based on whether any sub of this layer is active
      const layerSubs = getLayerSubcategories(layerId);
      const hasActiveSub = layerSubs.some(s => next.includes(s));
      setActiveLayers(prevLayers => {
        if (hasActiveSub && !prevLayers.includes(layerId)) return [...prevLayers, layerId];
        if (!hasActiveSub) return prevLayers.filter(l => l !== layerId);
        return prevLayers;
      });
      
      return next;
    });
    setSelectedItem(null);
  };

  const getMarkerColor = (category: string): string => {
    return getLayerColor(category);
  };

  const getLayerIcon = (category: string): string => {
    for (const layer of MAP_LAYERS) {
      const sub = SUBCATEGORIES[layer.id]?.find(s => s.id === category);
      if (sub) return sub.icon;
    }
    return 'place';
  };

  const handleMarkerPress = useCallback((item: MapItem) => {
    setSelectedItem(item);
  }, []);

  const handleItemPress = () => {
    if (selectedItem) {
      router.push(`/heritage/${selectedItem.id}`);
    }
  };

  const centerOnPortugal = () => {
    mapRef.current?.animateToRegion(PORTUGAL_REGION, 500);
  };

  const fitToMarkers = () => {
    if (mapItems && mapItems.length > 0 && mapRef.current) {
      const coordinates = mapItems.map(item => ({
        latitude: item.location.lat,
        longitude: item.location.lng,
      }));
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true,
      });
    }
  };

  // Group items by region for web fallback
  const itemsByRegion = mapItems?.reduce((acc: Record<string, MapItem[]>, item) => {
    const region = item.region || 'outros';
    if (!acc[region]) acc[region] = [];
    acc[region].push(item);
    return acc;
  }, {}) || {};

  // Count items per layer
  const _layerCounts = MAP_LAYERS.reduce((acc, layer) => {
    const layerSubs = getLayerSubcategories(layer.id);
    acc[layer.id] = mapItems?.filter(item => 
      layerSubs.includes(item.category)
    ).length || 0;
    return acc;
  }, {} as Record<string, number>);

  const isNativeMap = isMapAvailable && MapView !== null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} data-testid="mapa-tab">
      {isNativeMap ? (
        /* Native Map View */
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={PORTUGAL_REGION}
            onMapReady={() => {
              setMapReady(true);
              setTimeout(fitToMarkers, 500);
            }}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            customMapStyle={darkMapStyle}
            mapPadding={{ top: 0, right: 0, bottom: 180, left: 0 }}
          >
            {mapItems?.map((item) => (
              <Marker
                key={item.id}
                coordinate={{
                  latitude: item.location.lat,
                  longitude: item.location.lng,
                }}
                onPress={() => handleMarkerPress(item)}
                tracksViewChanges={false}
              >
                <View style={[styles.markerContainer, { backgroundColor: getMarkerColor(item.category) }]}>
                  <MaterialIcons
                    name={getLayerIcon(item.category) as any}
                    size={16}
                    color="#FFFFFF"
                  />
                </View>
                <Callout tooltip onPress={handleItemPress}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.calloutCategory}>{item.category} • {item.region}</Text>
                    <Text style={styles.calloutAction}>Toca para ver detalhes →</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>

          {/* Header Overlay */}
          <View style={[styles.headerOverlay, { top: insets.top + 10 }]}>
            <Text style={styles.headerTitle}>Mapa Inteligente</Text>
            <View style={styles.headerStats}>
              <MaterialIcons name="place" size={14} color="#C49A6C" />
              <Text style={styles.headerStatsText}>{mapItems?.length || 0} locais</Text>
            </View>
          </View>

          {/* Map Controls */}
          <View style={[styles.mapControls, { top: insets.top + 60 }]}>
            <TouchableOpacity style={styles.controlButton} onPress={centerOnPortugal}>
              <MaterialIcons name="my-location" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={fitToMarkers}>
              <MaterialIcons name="zoom-out-map" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => router.push('/search')}
            >
              <MaterialIcons name="search" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.controlButton, showAccessibility && styles.controlButtonActive]}
              onPress={() => setShowAccessibility(!showAccessibility)}
              data-testid="accessibility-toggle"
            >
              <MaterialIcons 
                name="accessible" 
                size={22} 
                color={showAccessibility || accessibilityFilters.length > 0 ? colors.ocean[500] : "#FFFFFF"} 
              />
              {accessibilityFilters.length > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{accessibilityFilters.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Accessibility Filters Panel */}
          {showAccessibility && (
            <View style={[styles.accessibilityPanel, { top: insets.top + 150 }]}>
              <AccessibilityFilters
                selectedFilters={accessibilityFilters}
                onFiltersChange={setAccessibilityFilters}
                compact={false}
              />
            </View>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#C49A6C" />
            </View>
          )}

          {/* Layer Selector */}
          <View style={[styles.layerSelector, { bottom: selectedItem ? 280 : 180 }]}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.layerContent}
            >
              {MAP_LAYERS.map((layer) => {
                const layerSubs = getLayerSubcategories(layer.id);
                const activeCount = layerSubs.filter(s => activeSubcategories.includes(s)).length;
                const isActive = activeCount > 0;

                return (
                  <TouchableOpacity
                    key={layer.id}
                    style={[
                      styles.layerChip,
                      isActive && { backgroundColor: layer.color },
                    ]}
                    onPress={() => toggleLayer(layer.id)}
                    data-testid={`layer-${layer.id}`}
                  >
                    <MaterialIcons
                      name={layer.icon as any}
                      size={18}
                      color={isActive ? '#FFFFFF' : '#94A3B8'}
                    />
                    <Text style={[
                      styles.layerText,
                      isActive && styles.layerTextActive,
                    ]}>
                      {layer.name}
                    </Text>
                    {isActive && (
                      <View style={styles.layerBadge}>
                        <Text style={styles.layerBadgeText}>{activeCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {/* Region chips for native map */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.layerContent, { marginTop: 6 }]}
            >
              {MAP_REGIONS.map((region) => {
                const isActive = regionFilter === region.id;
                return (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.layerChip,
                      isActive && { backgroundColor: region.color },
                    ]}
                    onPress={() => setRegionFilter(isActive ? null : region.id)}
                    data-testid={`native-region-${region.id}`}
                  >
                    <MaterialIcons name="place" size={14} color={isActive ? '#FFF' : '#94A3B8'} />
                    <Text style={[styles.layerText, isActive && styles.layerTextActive]}>{region.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Selected Item Card */}
          {selectedItem && (
            <TouchableOpacity
              style={[styles.selectedCard, { bottom: 180 }]}
              onPress={handleItemPress}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#2E5E4E', '#1F3F32']}
                style={styles.selectedGradient}
              >
                <View style={styles.selectedContent}>
                  <View style={[
                    styles.selectedIcon,
                    { backgroundColor: getMarkerColor(selectedItem.category) + '30' }
                  ]}>
                    <MaterialIcons
                      name={getLayerIcon(selectedItem.category) as any}
                      size={24}
                      color={getMarkerColor(selectedItem.category)}
                    />
                  </View>
                  <View style={styles.selectedInfo}>
                    <Text style={styles.selectedName} numberOfLines={1}>
                      {selectedItem.name}
                    </Text>
                    <Text style={styles.selectedMeta}>
                      {selectedItem.category} • {selectedItem.region}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#8A8A8A" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Quick Actions */}
          <View style={[styles.quickActions, { bottom: 100 + insets.bottom }]}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/nearby')}
            >
              <LinearGradient
                colors={['#C49A6C', '#B08556']}
                style={styles.actionGradient}
              >
                <MaterialIcons name="near-me" size={20} color="#000" />
                <Text style={styles.actionText}>Perto de Mim</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/route-planner')}
            >
              <LinearGradient
                colors={['#3FA66B', '#2E8A55']}
                style={styles.actionGradient}
              >
                <MaterialIcons name="directions" size={20} color="#FFF" />
                <Text style={[styles.actionText, { color: '#FFF' }]}>Planear Rota</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* Web Fallback View */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.webHeaderTitle}>Mapa Inteligente</Text>
            <View style={styles.headerStats}>
              <MaterialIcons name="place" size={16} color="#C49A6C" />
              <Text style={styles.headerStatsText}>{mapItems?.length || 0} locais</Text>
            </View>
          </View>

          {/* Region Filter Indicator */}
          {regionFilter && (
            <View style={styles.regionFilterBar} data-testid="region-filter-bar">
              <MaterialIcons name="filter-list" size={16} color="#2E5E4E" />
              <Text style={styles.regionFilterText}>
                Filtrado por: <Text style={{ fontWeight: '700' }}>{regionFilter.charAt(0).toUpperCase() + regionFilter.slice(1)}</Text>
              </Text>
              <TouchableOpacity
                style={styles.regionFilterClear}
                onPress={() => setRegionFilter(null)}
                data-testid="clear-region-filter"
              >
                <MaterialIcons name="close" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Layer Selector with Subcategories */}
          <View style={styles.section}>
            <MapLayerSelector
              layers={MAP_LAYERS}
              subcategories={SUBCATEGORIES}
              activeSubcategories={activeSubcategories}
              expandedLayer={expandedLayer}
              onToggleLayer={toggleLayer}
              onToggleSubcategory={toggleSubcategory}
              onExpandLayer={setExpandedLayer}
              getLayerSubcategories={getLayerSubcategories}
            />
          </View>

          {/* Region Filter */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="map" size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Regiões</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.layerContent}
            >
              {MAP_REGIONS.map((region) => {
                const isActive = regionFilter === region.id;
                return (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.layerChip,
                      isActive && { backgroundColor: region.color },
                    ]}
                    onPress={() => setRegionFilter(isActive ? null : region.id)}
                    data-testid={`region-filter-${region.id}`}
                  >
                    <MaterialIcons
                      name="place"
                      size={16}
                      color={isActive ? '#FFFFFF' : '#94A3B8'}
                    />
                    <Text style={[
                      styles.layerText,
                      isActive && styles.layerTextActive,
                    ]}>
                      {region.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Accessibility Filters Section */}
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowAccessibility(!showAccessibility)}
              data-testid="accessibility-section-toggle"
            >
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="accessible" size={20} color={colors.ocean[500]} />
                <Text style={styles.sectionTitle}>Turismo Inclusivo</Text>
                {accessibilityFilters.length > 0 && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{accessibilityFilters.length}</Text>
                  </View>
                )}
              </View>
              <MaterialIcons 
                name={showAccessibility ? "expand-less" : "expand-more"} 
                size={24} 
                color={colors.gray[500]} 
              />
            </TouchableOpacity>
            {showAccessibility && (
              <View style={styles.accessibilityContainer}>
                <AccessibilityFilters
                  selectedFilters={accessibilityFilters}
                  onFiltersChange={setAccessibilityFilters}
                  compact={false}
                />
              </View>
            )}
          </View>

          {/* Map Mode Switcher */}
          <MapModeSelector activeMode={mapMode} onModeChange={setMapMode} />

          {/* Trails Selector (shown in trails mode) */}
          {mapMode === 'trails' && (
            <View style={styles.trailSelectorRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trailSelector}>
                {(trailsList || []).map((trail: any) => (
                  <TouchableOpacity
                    key={trail.id}
                    style={[styles.trailChip, selectedTrail === trail.id && { backgroundColor: trail.color, borderColor: trail.color }]}
                    onPress={() => setSelectedTrail(selectedTrail === trail.id ? null : trail.id)}
                  >
                    <MaterialIcons name="route" size={14} color={selectedTrail === trail.id ? '#FFF' : '#64748B'} />
                    <Text style={[styles.trailChipText, selectedTrail === trail.id && { color: '#FFF' }]} numberOfLines={1}>
                      {trail.name.split(' - ')[0]}
                    </Text>
                    <Text style={[styles.trailChipMeta, selectedTrail === trail.id && { color: 'rgba(255,255,255,0.8)' }]}>
                      {trail.distance_km}km
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.gpxUploadBtn}
                  onPress={handleGpxUpload}
                  disabled={gpxUploading}
                >
                  {gpxUploading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialIcons name="file-upload" size={16} color="#FFF" />
                  )}
                  <Text style={styles.gpxUploadText}>{gpxUploading ? 'A enviar...' : 'Upload GPX'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Epochs Selector (shown in epochs mode) */}
          {mapMode === 'epochs' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trailSelector}>
              {(epochsList || []).map((epoch: any) => (
                <TouchableOpacity
                  key={epoch.id}
                  style={[styles.trailChip, selectedEpochs.includes(epoch.id) && { backgroundColor: epoch.color, borderColor: epoch.color }]}
                  onPress={() => setSelectedEpochs(prev =>
                    prev.includes(epoch.id) ? prev.filter(e => e !== epoch.id) : [...prev, epoch.id]
                  )}
                >
                  <View style={[styles.epochDot, { backgroundColor: epoch.color }]} />
                  <Text style={[styles.trailChipText, selectedEpochs.includes(epoch.id) && { color: '#FFF' }]} numberOfLines={1}>
                    {epoch.name}
                  </Text>
                  <Text style={[styles.trailChipMeta, selectedEpochs.includes(epoch.id) && { color: 'rgba(255,255,255,0.8)' }]}>
                    {epoch.count}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Timeline Controls (shown in timeline mode) */}
          {mapMode === 'timeline' && (
            <TimelineControls
              epochs={TIMELINE_EPOCHS}
              currentIndex={timelineIndex}
              isPlaying={timelinePlaying}
              isLoading={timelineLoading}
              itemCount={timelineMapItems?.length || 0}
              onIndexChange={(i) => { setTimelineIndex(i); setTimelinePlaying(false); }}
              onPlayToggle={() => {
                if (timelineIndex >= TIMELINE_EPOCHS.length - 1) setTimelineIndex(0);
                setTimelinePlaying(!timelinePlaying);
              }}
            />
          )}

          {/* Proximity Panel (shown in proximity mode) */}
          {mapMode === 'proximity' && (
            <ProximityPanel
              isLoading={proximityDataLoading || proximityLoading}
              total={proximityData?.total || 0}
              pois={proximityData?.pois || []}
              getMarkerColor={getMarkerColor}
              getLayerIcon={getLayerIcon}
              onPoiPress={(poiId) => router.push(`/heritage/${poiId}`)}
              onRefresh={() => {
                setUserLocation(null);
                setProximityLoading(true);
                navigator.geolocation?.getCurrentPosition(
                  (pos) => {
                    setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setProximityLoading(false);
                  },
                  () => setProximityLoading(false),
                  { enableHighAccuracy: true },
                );
              }}
            />
          )}

          {/* Night Explorer Panel (shown in noturno mode) */}
          {mapMode === 'explorador' && (
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              <View style={{ padding: 12, gap: 8 }}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13, marginBottom: 4 }}>Dados Técnicos em Tempo Real</Text>

                {/* Weather */}
                {exploradorWeather?.forecast?.[0] && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <MaterialIcons name="wb-sunny" size={20} color="#FCD34D" />
                    <View>
                      <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Meteorologia</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{exploradorWeather.forecast[0].description} · {exploradorWeather.forecast[0].temp_max}°C max</Text>
                    </View>
                  </View>
                )}

                {/* Fires */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <MaterialIcons name="local-fire-department" size={20} color={exploradorFires?.active_fires > 0 ? '#EF4444' : '#4ADE80'} />
                  <View>
                    <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Risco de Incêndio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                      {exploradorFires?.active_fires != null ? `${exploradorFires.active_fires} ocorrências activas` : 'A carregar...'}
                    </Text>
                  </View>
                </View>

                {/* Surf/Tides */}
                {exploradorSurf?.spots?.[0] && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <MaterialIcons name="waves" size={20} color="#38BDF8" />
                    <View>
                      <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Mar — {exploradorSurf.spots[0].name}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                        Ondas {exploradorSurf.spots[0].wave_height_m}m · Vento {exploradorSurf.spots[0].wind_speed_kmh} km/h
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {mapMode === 'noturno' && (
            <NightExplorerPanel
              isLoading={nightLoading}
              itemCount={nightItems.length}
              activeFilter={nightFilter}
              onFilterChange={setNightFilter}
            />
          )}

          {/* Interactive Leaflet Map */}
          <View style={styles.mapContainer}>
            {(isLoading || epochsLoading || timelineLoading || (mapMode === 'proximity' && proximityDataLoading) || (mapMode === 'noturno' && nightLoading)) && (
              <View style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="small" color="#C49A6C" />
                <Text style={styles.loadingText}>A carregar mapa...</Text>
              </View>
            )}
            {(() => {
              console.log('[Mapa JSX] Rendering LeafletMapComponent with items:', mapComponentItems?.length);
              return null;
            })()}
            <GoogleMapComponent
              onItemPress={(item) => setSelectedItem(item)}
              style={{ flex: 1, minHeight: 480, borderRadius: 16 }}
            />
          </View>

          {/* Trail Info Card */}
          {mapMode === 'trails' && trailData && (
            <View style={styles.trailInfoCard}>
              <Text style={styles.trailInfoName}>{trailData.name}</Text>
              <Text style={styles.trailInfoDesc} numberOfLines={2}>{trailData.description}</Text>
              <View style={styles.trailStatsRow}>
                <View style={styles.trailStat}>
                  <MaterialIcons name="straighten" size={14} color="#C49A6C" />
                  <Text style={styles.trailStatText}>{trailData.distance_km} km</Text>
                </View>
                <View style={styles.trailStat}>
                  <MaterialIcons name="trending-up" size={14} color="#22C55E" />
                  <Text style={styles.trailStatText}>+{trailData.elevation_gain}m</Text>
                </View>
                <View style={styles.trailStat}>
                  <MaterialIcons name="trending-down" size={14} color="#EF4444" />
                  <Text style={styles.trailStatText}>-{trailData.elevation_loss}m</Text>
                </View>
                <View style={styles.trailStat}>
                  <MaterialIcons name="schedule" size={14} color="#8B5CF6" />
                  <Text style={styles.trailStatText}>{trailData.estimated_hours}h</Text>
                </View>
                <View style={[styles.difficultyBadge, { backgroundColor: trailData.difficulty === 'facil' ? '#22C55E' : trailData.difficulty === 'moderado' ? '#C49A6C' : '#EF4444' }]}>
                  <Text style={styles.difficultyText}>{trailData.difficulty}</Text>
                </View>
              </View>

              {/* Elevation Profile */}
              {trailElevation?.profile && (
                <View style={styles.elevationContainer}>
                  <Text style={styles.elevationTitle}>Perfil de Elevação</Text>
                  <View style={styles.elevationChart}>
                    {trailElevation.profile.map((pt: any, i: number) => {
                      const maxEle = trailData.max_elevation || 1;
                      const minEle = trailData.min_elevation || 0;
                      const range = maxEle - minEle || 1;
                      const heightPct = ((pt.elevation - minEle) / range) * 100;
                      return (
                        <View key={i} style={[styles.elevationBar, { height: `${Math.max(5, heightPct)}%` }]}>
                          <LinearGradient
                            colors={heightPct > 70 ? ['#EF4444', '#C49A6C'] : heightPct > 40 ? ['#C49A6C', '#22C55E'] : ['#22C55E', '#3B82F6']}
                            style={styles.elevationBarGradient}
                          />
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.elevationLabels}>
                    <Text style={styles.elevationLabel}>{trailData.min_elevation}m</Text>
                    <Text style={styles.elevationLabel}>{trailData.max_elevation}m</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Map Stats */}
          <View style={styles.mapStatsRow}>
            <View style={styles.mapStatChip}>
              <MaterialIcons name="place" size={14} color="#C49A6C" />
              <Text style={styles.mapStatText}>{mapItems?.length || 0} locais no mapa</Text>
            </View>
            <View style={styles.mapStatChip}>
              <MaterialIcons name="layers" size={14} color="#8B5CF6" />
              <Text style={styles.mapStatText}>{activeLayers.length} camadas ativas</Text>
            </View>
          </View>

          {/* Items by Region */}
          {Object.entries(itemsByRegion).map(([region, items]) => (
            <View key={region} style={styles.regionSection}>
              <View style={styles.regionHeader}>
                <Text style={styles.regionTitle}>{region}</Text>
                <Text style={styles.regionCount}>{items.length} locais</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.itemsRow}
              >
                {items.slice(0, 10).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemCard}
                    onPress={() => router.push(`/heritage/${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <View style={[
                      styles.itemIcon,
                      { backgroundColor: getMarkerColor(item.category) + '20' }
                    ]}>
                      <MaterialIcons
                        name={getLayerIcon(item.category) as any}
                        size={20}
                        color={getMarkerColor(item.category)}
                      />
                    </View>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemCategory}>{item.category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}

          {/* Quick Actions */}
          <View style={styles.webQuickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/nearby')}
            >
              <LinearGradient
                colors={['#C49A6C', '#B08556']}
                style={styles.actionGradient}
              >
                <MaterialIcons name="near-me" size={20} color="#000" />
                <Text style={styles.actionText}>Perto de Mim</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/route-planner')}
            >
              <LinearGradient
                colors={['#3FA66B', '#2E8A55']}
                style={styles.actionGradient}
              >
                <MaterialIcons name="directions" size={20} color="#FFF" />
                <Text style={[styles.actionText, { color: '#FFF' }]}>Planear Rota</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search Card */}
          <TouchableOpacity
            style={styles.searchCard}
            onPress={() => router.push('/search')}
          >
            <MaterialIcons name="search" size={24} color="#C8C3B8" />
            <Text style={styles.searchText}>Pesquisar locais...</Text>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Native Map Styles
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  calloutContainer: {
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
    maxWidth: 250,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  calloutCategory: {
    fontSize: 12,
    color: '#C8C3B8',
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  calloutAction: {
    fontSize: 11,
    color: '#C49A6C',
    fontWeight: '500',
  },
  headerOverlay: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  headerStatsText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  layerSelector: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  layerContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  layerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C8C3B8',
  },
  layerTextActive: {
    color: '#FFFFFF',
  },
  layerBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  layerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  selectedCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectedGradient: {
    padding: 16,
  },
  selectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedMeta: {
    fontSize: 12,
    color: '#C8C3B8',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  quickActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  // Web Fallback Styles
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  webHeaderTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray[800],
    fontFamily: Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined,
  },
  section: {
    marginTop: 12,
    marginBottom: 4,
    zIndex: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[800],
  },
  mapModeSwitcherScroll: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  mapModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  mapModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 5,
  },
  mapModeBtnActive: {
    backgroundColor: '#C49A6C',
  },
  mapModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mapModeBtnTextActive: {
    color: '#FFFFFF',
  },
  trailSelector: {
    paddingHorizontal: 16,
    marginTop: 10,
    maxHeight: 45,
  },
  trailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F3',
    borderWidth: 1,
    borderColor: '#F2EDE4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    gap: 5,
  },
  trailChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2F2A',
    maxWidth: 120,
  },
  trailChipMeta: {
    fontSize: 11,
    color: '#C8C3B8',
    fontWeight: '500',
  },
  epochDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trailInfoCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F2EDE4',
  },
  trailInfoName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E5E4E',
    marginBottom: 4,
  },
  trailInfoDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  trailStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  trailStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trailStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2A2F2A',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'capitalize',
  },
  elevationContainer: {
    marginTop: 14,
    backgroundColor: '#FAF8F3',
    borderRadius: 10,
    padding: 12,
  },
  elevationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  elevationChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 1,
  },
  elevationBar: {
    flex: 1,
    borderRadius: 2,
    overflow: 'hidden',
    minHeight: 3,
  },
  elevationBarGradient: {
    flex: 1,
    borderRadius: 2,
  },
  elevationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  elevationLabel: {
    fontSize: 10,
    color: '#C8C3B8',
    fontWeight: '500',
  },
  trailSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    marginTop: 10,
    gap: 8,
  },
  gpxUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 16,
    gap: 5,
  },
  gpxUploadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  timelineContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F2EDE4',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timelineEpochName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E5E4E',
  },
  timelinePeriod: {
    fontSize: 12,
    color: '#64748B',
  },
  timelineCount: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timelineCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C49A6C',
  },
  timelineBar: {
    flexDirection: 'row',
    height: 24,
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineSegment: {
    flex: 1,
    height: 4,
    backgroundColor: '#F2EDE4',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  timelineNode: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F2EDE4',
    borderWidth: 2,
    borderColor: '#C8C3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineNodeInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timelineLabelText: {
    fontSize: 9,
    color: '#C8C3B8',
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  timelineControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  timelineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelinePlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C49A6C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden' as any,
    height: 480,
    backgroundColor: '#2E5E4E',
    position: 'relative' as any,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(15,23,42,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  mapStatsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 10,
  },
  mapStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  mapStatText: {
    fontSize: 12,
    color: '#C8C3B8',
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: {
    color: colors.gray[500],
    fontSize: 14,
  },
  regionSection: {
    marginTop: 24,
  },
  regionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  regionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
    textTransform: 'capitalize',
  },
  regionCount: {
    fontSize: 12,
    color: colors.gray[500],
  },
  itemsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  itemCard: {
    width: 140,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    ...shadows.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[800],
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 11,
    color: colors.gray[500],
    textTransform: 'capitalize',
  },
  webQuickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  searchText: {
    fontSize: 15,
    color: '#64748B',
  },
  regionFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#E8F0ED',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  regionFilterText: {
    flex: 1,
    fontSize: 14,
    color: '#2E5E4E',
  },
  regionFilterClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2E5E4E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Accessibility Filters Styles
  controlButtonActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    borderColor: colors.ocean[500],
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ocean[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  accessibilityPanel: {
    position: 'absolute',
    left: 16,
    right: 70,
    zIndex: 100,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  activeBadge: {
    backgroundColor: colors.ocean[500],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  accessibilityContainer: {
    marginHorizontal: 20,
    marginTop: 8,
  },
  // Proximity Panel Styles
  proximityPanel: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFF',
    borderRadius: borders.radius.xl,
    padding: spacing[4],
    ...shadows.md,
  },
  proximityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  proximityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  proximityPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.terracotta[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  proximityTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: colors.gray[800],
  },
  proximitySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginTop: 1,
  },
  proximityRefreshBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.terracotta[50],
  },
  proximityLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
  },
  proximityLoadingText: {
    color: colors.gray[500],
    fontSize: typography.fontSize.sm,
  },
  proximityList: {
    gap: spacing[3],
    paddingVertical: 4,
  },
  proximityCard: {
    width: 160,
    backgroundColor: colors.background.tertiary,
    borderRadius: borders.radius.lg,
    padding: spacing[3],
    ...shadows.sm,
  },
  proximityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[2],
    borderRadius: borders.radius.md,
    marginBottom: spacing[2],
  },
  proximityDistance: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proximityDistanceText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray[700],
  },
  proximityCardName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.gray[800],
    marginBottom: 2,
    lineHeight: 16,
  },
  proximityCardMeta: {
    fontSize: 10,
    color: colors.gray[500],
    marginBottom: spacing[1],
  },
  proximityIQ: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  proximityIQText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Night Explorer Panel Styles
  nightPanel: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#2E5E4E',
    borderRadius: borders.radius.xl,
    padding: spacing[4],
    ...shadows.md,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  nightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  nightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  nightMoon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nightTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: '#FDE68A',
  },
  nightSubtitle: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  nightFilters: {
    gap: 8,
    paddingVertical: 4,
  },
  nightFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 5,
  },
  nightFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
});
