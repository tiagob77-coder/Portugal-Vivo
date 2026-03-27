import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, ImageBackground, Platform, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getRoute, getRouteItems, getCategories } from '../../src/services/api';
import HeritageCard from '../../src/components/HeritageCard';
import * as Location from 'expo-location';
import { ShareButton } from '../../src/components/ShareButton';

// Conditional import for WebView
let WebView: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const CATEGORY_COLORS: Record<string, string> = {
  vinho: '#7C3AED',
  pao: '#B08556',
  azeite: '#84CC16',
  cultural: '#EC4899',
  religioso: '#6366F1',
  arqueologia: '#78716C',
  natureza: '#22C55E',
};

const CATEGORY_ICONS: Record<string, string> = {
  vinho: 'local-bar',
  pao: 'bakery-dining',
  azeite: 'local-florist',
  cultural: 'museum',
  religioso: 'church',
  arqueologia: 'architecture',
  natureza: 'forest',
};

const CATEGORY_IMAGES: Record<string, string> = {
  vinho: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80',
  pao: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80',
  azeite: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80',
  cultural: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  religioso: 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800&q=80',
  arqueologia: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&q=80',
  natureza: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
};

const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  norte: { lat: 41.1579, lng: -8.6291 },
  centro: { lat: 40.2033, lng: -8.4103 },
  lisboa: { lat: 38.7223, lng: -9.1393 },
  alentejo: { lat: 38.5667, lng: -7.9 },
  algarve: { lat: 37.0179, lng: -7.9304 },
  acores: { lat: 37.7833, lng: -25.5 },
  madeira: { lat: 32.6669, lng: -16.9241 },
};

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [_locationPermission, setLocationPermission] = useState<boolean>(false);

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ['route', id],
    queryFn: () => getRoute(id!),
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['routeItems', id],
    queryFn: () => getRouteItems(id!),
    enabled: !!id,
  });

  // Inject SEO meta tags on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !route || typeof document === 'undefined') return;

    const title = `${route.name} — Portugal Vivo`;
    const desc = route.description?.slice(0, 160) || `Rota ${route.name} no Portugal Vivo`;
    const image = route.image_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80';
    const url = window.location.href;

    document.title = title;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el); }
      el.content = content;
    };
    const setMetaName = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };

    setMeta('og:title', title);
    setMeta('og:description', desc);
    setMeta('og:image', image);
    setMeta('og:url', url);
    setMeta('og:type', 'article');
    setMeta('og:site_name', 'Portugal Vivo');
    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', title);
    setMetaName('twitter:description', desc);
    setMetaName('twitter:image', image);
    setMetaName('description', desc);
  }, [route]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  // Get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationPermission(true);
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error('Location error:', error);
      }
    })();
  }, []);

  const color = CATEGORY_COLORS[route?.category || ''] || '#6366F1';
  const icon = CATEGORY_ICONS[route?.category || ''] || 'route';
  const coverImage = CATEGORY_IMAGES[route?.category || ''] || CATEGORY_IMAGES.natureza;
  
  // Get route start coordinates (first item or region default)
  const routeStartCoords = items.length > 0 && items[0].location 
    ? items[0].location 
    : REGION_COORDS[route?.region || 'lisboa'] || REGION_COORDS.lisboa;

  // Define stops for the route (items with location)
  const stops = (items || []).filter(i => i?.location).map((item, idx) => ({
    id: item.id,
    name: item.name,
    lat: item.location?.lat || 0,
    lng: item.location?.lng || 0,
    category: item.category,
    order: idx + 1,
  }));

  const openNavigation = () => {
    const destination = `${routeStartCoords.lat},${routeStartCoords.lng}`;
    const _label = encodeURIComponent(route?.name || 'Destino');
    
    let url: string;
    
    if (Platform.OS === 'ios') {
      // iOS: Try Google Maps first, fallback to Apple Maps
      url = `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback to Apple Maps
          Linking.openURL(`maps://app?daddr=${destination}`);
        }
      });
      return;
    } else if (Platform.OS === 'android') {
      // Android: Use geo intent which opens in default maps app
      url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    } else {
      // Web
      url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      window.open(url, '_blank');
      return;
    }
    
    Linking.openURL(url).catch(err => {
      console.error('Failed to open navigation:', err);
      Alert.alert('Erro', 'Não foi possível abrir a navegação. Verifique se tem o Google Maps instalado.');
    });
  };

  if (routeLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#C49A6C" />
      </View>
    );
  }

  if (!route) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Rota não encontrada</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Hero Image */}
      <ImageBackground
        source={{ uri: coverImage }}
        style={[styles.heroImage, { paddingTop: insets.top }]}
        imageStyle={styles.heroImageStyle}
      >
        <View style={styles.heroOverlay}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
            </TouchableOpacity>
            <ShareButton
              title={route.name}
              description={`Explora a rota ${route.name} com ${stops.length} paragens no Portugal Vivo! \u{1F5FA}\u{FE0F}`}
              url={`https://project-analyzer-131.preview.emergentagent.com/route/${id}`}
            />
          </View>
          
          {/* Hero Content */}
          <View style={styles.heroContent}>
            <View style={[styles.categoryBadge, { backgroundColor: color + '40' }]}>
              <MaterialIcons name={icon as any} size={16} color={color} />
              <Text style={[styles.categoryText, { color }]}>
                {route.category.charAt(0).toUpperCase() + route.category.slice(1)}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{route.name}</Text>
            {route.region && (
              <View style={styles.heroMeta}>
                <MaterialIcons name="place" size={14} color="#C49A6C" />
                <Text style={styles.heroMetaText}>{route.region.charAt(0).toUpperCase() + route.region.slice(1)}</Text>
              </View>
            )}
          </View>
        </View>
      </ImageBackground>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Route Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <MaterialIcons name="place" size={22} color="#3B82F6" />
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>Pontos</Text>
          </View>
          {route.duration_hours && (
            <View style={styles.statItem}>
              <MaterialIcons name="schedule" size={22} color="#C49A6C" />
              <Text style={styles.statValue}>{route.duration_hours}h</Text>
              <Text style={styles.statLabel}>Duração</Text>
            </View>
          )}
          {route.distance_km && (
            <View style={styles.statItem}>
              <MaterialIcons name="straighten" size={22} color="#22C55E" />
              <Text style={styles.statValue}>{route.distance_km}km</Text>
              <Text style={styles.statLabel}>Distância</Text>
            </View>
          )}
          <View style={styles.statItem}>
            <MaterialIcons name="star" size={22} color="#EAB308" />
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Avaliação</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre esta Rota</Text>
          <Text style={styles.description}>{route.description}</Text>
        </View>

        {/* Interactive Route Map */}
        <View style={styles.section}>
          <View style={styles.mapHeader}>
            <Text style={styles.sectionTitle}>Mapa da Rota</Text>
            <View style={styles.mapHeaderButtons}>
              <TouchableOpacity style={styles.addStopButton} onPress={() => {
                Alert.alert(
                  'Adicionar Paragem',
                  'Em breve poderá adicionar novos locais à rota!',
                  [{ text: 'OK' }]
                );
              }}>
                <MaterialIcons name="add-location" size={16} color="#22C55E" />
                <Text style={styles.addStopButtonText}>Adicionar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.openMapsButton} onPress={openNavigation}>
                <MaterialIcons name="directions" size={16} color="#C49A6C" />
                <Text style={styles.openMapsButtonText}>Navegar</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.interactiveMapContainer}>
            {Platform.OS !== 'web' && WebView ? (
              <WebView
                source={{ 
                  html: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;width:100%;overflow:hidden}
#map{height:100%;width:100%}
.gm-style-iw{max-width:220px!important}
.info-window{padding:4px}
.info-title{font-size:14px;font-weight:700;color:#264E41;margin-bottom:4px}
.info-desc{font-size:12px;color:#64748B;line-height:1.4}
.info-order{display:inline-block;background:${color};color:white;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;margin-right:6px}
</style>
<script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry"></script>
</head>
<body>
<div id="map"></div>
<script>
const routeColor = '${color}';
const stops = ${JSON.stringify(items.filter(i => i.location).map((item, idx) => ({
  order: idx + 1,
  name: item.name,
  description: item.description?.slice(0, 100) + '...' || '',
  lat: item.location?.lat,
  lng: item.location?.lng
})))};

const userLat = ${userLocation?.lat || 'null'};
const userLng = ${userLocation?.lng || 'null'};
const defaultLat = ${routeStartCoords.lat};
const defaultLng = ${routeStartCoords.lng};
const routeName = '${route.name.replace(/'/g, "\\'")}';
const regionName = '${(route.region || 'portugal').charAt(0).toUpperCase() + (route.region || 'portugal').slice(1)}';

function initMap() {
  const map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: defaultLat, lng: defaultLng},
    zoom: stops.length > 0 ? 10 : 9,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy',
    styles: [
      {featureType:'poi',stylers:[{visibility:'off'}]},
      {featureType:'transit',stylers:[{visibility:'off'}]}
    ]
  });
  
  if (stops.length === 0) {
    // No stops - show route start region with info
    new google.maps.Marker({
      position: {lat: defaultLat, lng: defaultLng},
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 18,
        fillColor: routeColor,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 3
      },
      title: routeName
    });
    
    const infoWindow = new google.maps.InfoWindow({
      content: '<div class="info-window"><div class="info-title">' + routeName + '</div><div class="info-desc">Região: ' + regionName + '<br>Paragens em breve...</div></div>',
      maxWidth: 250
    });
    infoWindow.setPosition({lat: defaultLat, lng: defaultLng});
    infoWindow.open(map);
    return;
  }

  const bounds = new google.maps.LatLngBounds();

  const pathCoords = [];
  const markers = [];
  
  stops.forEach((stop, index) => {
    const position = {lat: stop.lat, lng: stop.lng};
    pathCoords.push(position);
    bounds.extend(position);
    
    const marker = new google.maps.Marker({
      position: position,
      map: map,
      label: {
        text: String(stop.order),
        color: 'white',
        fontSize: '12px',
        fontWeight: '700'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 16,
        fillColor: routeColor,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 3
      },
      title: stop.name
    });
    
    const infoContent = '<div class="info-window">' +
      '<div class="info-title"><span class="info-order">' + stop.order + '</span>' + stop.name + '</div>' +
      (stop.description ? '<div class="info-desc">' + stop.description + '</div>' : '') +
      '</div>';
    
    const infoWindow = new google.maps.InfoWindow({
      content: infoContent,
      maxWidth: 250
    });
    
    marker.addListener('click', () => {
      markers.forEach(m => m.infoWindow && m.infoWindow.close());
      infoWindow.open(map, marker);
    });
    
    marker.infoWindow = infoWindow;
    markers.push(marker);
  });
  
  // Draw route path
  if (pathCoords.length > 1) {
    const routePath = new google.maps.Polyline({
      path: pathCoords,
      geodesic: true,
      strokeColor: routeColor,
      strokeOpacity: 0.8,
      strokeWeight: 4
    });
    routePath.setMap(map);
  }
  
  // User location marker
  if (userLat && userLng) {
    const userPosition = {lat: userLat, lng: userLng};
    bounds.extend(userPosition);
    
    new google.maps.Marker({
      position: userPosition,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3B82F6',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 3
      },
      title: 'A sua posição'
    });
  }
  
  map.fitBounds(bounds, {top: 50, bottom: 50, left: 50, right: 50});
  
  // Open first marker info
  if (markers.length > 0) {
    setTimeout(() => markers[0].infoWindow.open(map, markers[0]), 500);
  }
}

initMap();
</script>
</body>
</html>` 
                }}
                style={styles.interactiveMapWebView}
                scrollEnabled={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
                mixedContentMode="always"
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.mapLoadingContainer}>
                    <ActivityIndicator size="large" color="#C49A6C" />
                    <Text style={styles.mapLoadingText}>A carregar mapa interativo...</Text>
                  </View>
                )}
                onError={(e: any) => console.error('WebView error:', e.nativeEvent)}
              />
            ) : Platform.OS === 'web' ? (
              <View style={styles.webMapContainer}>
                {items.filter(i => i.location).length > 0 ? (
                  <iframe
                    src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${routeStartCoords.lat},${routeStartCoords.lng}&zoom=10`}
                    style={{ width: '100%', height: '100%', borderRadius: 12, border: 'none' }}
                    title="Route Map"
                    loading="lazy"
                    allowFullScreen
                  />
                ) : (
                  <ImageBackground
                    source={{ 
                      uri: `https://maps.googleapis.com/maps/api/staticmap?center=${routeStartCoords.lat},${routeStartCoords.lng}&zoom=10&size=600x400&maptype=roadmap&markers=color:0x${color.replace('#', '')}%7C${routeStartCoords.lat},${routeStartCoords.lng}&key=${GOOGLE_MAPS_API_KEY}`
                    }}
                    style={styles.staticMapImage}
                    imageStyle={{ borderRadius: 12 }}
                  >
                    <View style={styles.mapOverlayInfo}>
                      <Text style={styles.mapInfoText}>{route.name}</Text>
                      <Text style={styles.mapInfoSubtext}>Região: {(route.region || 'Portugal').charAt(0).toUpperCase() + (route.region || 'Portugal').slice(1)}</Text>
                    </View>
                  </ImageBackground>
                )}
              </View>
            ) : (
              <View style={styles.mapFallback}>
                <MaterialIcons name="map" size={32} color="#64748B" />
                <Text style={styles.mapFallbackText}>Mapa não disponível</Text>
              </View>
            )}
          </View>
          
          {/* Route Legend */}
          <View style={styles.routeLegend}>
            <View style={styles.legendRow}>
              <View style={[styles.legendMarker, { backgroundColor: color }]}>
                <Text style={styles.legendMarkerText}>1</Text>
              </View>
              <Text style={styles.legendDescription}>Paragens da rota (toque para ver detalhes)</Text>
            </View>
            {userLocation && (
              <View style={styles.legendRow}>
                <View style={[styles.legendMarker, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.legendDescription}>A sua posição atual</Text>
              </View>
            )}
            <View style={styles.legendRow}>
              <View style={[styles.legendLine, { backgroundColor: color }]} />
              <Text style={styles.legendDescription}>Trajeto da rota</Text>
            </View>
          </View>
        </View>

        {/* Route Points */}
        {items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pontos de Interesse ({items.length})</Text>
            {items.map((item, index) => (
              <View key={item.id}>
                <View style={styles.routePointNumber}>
                  <View style={[styles.pointCircle, { backgroundColor: color }]}>
                    <Text style={styles.pointNumber}>{index + 1}</Text>
                  </View>
                  {index < items.length - 1 && <View style={[styles.pointLine, { backgroundColor: color + '40' }]} />}
                </View>
                <HeritageCard
                  item={item}
                  categories={categories}
                  onPress={() => router.push(`/heritage/${item.id}`)}
                />
              </View>
            ))}
          </View>
        )}

        {/* Tags */}
        {route.tags && route.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {route.tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.tagText, { color }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.actionButtonSecondary} onPress={() => {
          Alert.alert('Em breve', 'Funcionalidade de guardar rota em desenvolvimento');
        }}>
          <MaterialIcons name="bookmark-border" size={22} color="#FAF8F3" />
          <Text style={styles.actionButtonTextSecondary}>Guardar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionButtonPrimary, { backgroundColor: color }]} onPress={openNavigation}>
          <MaterialIcons name="navigation" size={22} color="#FFFFFF" />
          <Text style={styles.actionButtonTextPrimary}>Iniciar Navegação</Text>
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
    height: 260,
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'space-between',
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
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    padding: 20,
    paddingBottom: 24,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: 14,
    color: '#C49A6C',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2F2A',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#C8C3B8',
    lineHeight: 24,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addStopButtonText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
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
  interactiveMapContainer: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#264E41',
  },
  interactiveMapWebView: {
    flex: 1,
    borderRadius: 12,
  },
  webMapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  staticMapImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  mapOverlayInfo: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    margin: 12,
    borderRadius: 10,
  },
  mapInfoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FAF8F3',
    marginBottom: 2,
  },
  mapInfoSubtext: {
    fontSize: 12,
    color: '#94A3B8',
  },
  routeLegend: {
    marginTop: 12,
    backgroundColor: '#264E41',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  legendMarkerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  legendLine: {
    width: 22,
    height: 4,
    borderRadius: 2,
  },
  legendDescription: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  miniMapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#264E41',
  },
  mapOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapOverlayLight: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  mapLegend: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  legendText: {
    fontSize: 11,
    color: '#FAF8F3',
    fontWeight: '500',
  },
  mapMarkerPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
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
  coordsInfo: {
    marginTop: 12,
    gap: 8,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coordsLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  coordsText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  miniMapWebView: {
    flex: 1,
    borderRadius: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapFallbackText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  distanceText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  routePointNumber: {
    position: 'absolute',
    left: 0,
    top: 16,
    alignItems: 'center',
    zIndex: 1,
  },
  pointCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pointLine: {
    width: 2,
    height: 80,
    marginTop: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#2E5E4E',
    borderTopWidth: 1,
    borderTopColor: '#264E41',
    gap: 12,
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#264E41',
    gap: 6,
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    color: '#FAF8F3',
    fontWeight: '600',
  },
  actionButtonPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonTextPrimary: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
