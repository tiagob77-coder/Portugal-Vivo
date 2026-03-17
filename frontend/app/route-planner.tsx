import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform, Linking } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getCategories, planRoute, RoutePlanRequest,
  generateSmartItinerary, SmartItineraryResponse, SmartItineraryRequest,
  getLocalities,
} from '../src/services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
// Conditional import for WebView
let WebView: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Popular destinations in Portugal
const POPULAR_DESTINATIONS = [
  { name: 'Lisboa', icon: 'location-city' },
  { name: 'Porto', icon: 'location-city' },
  { name: 'Coimbra', icon: 'school' },
  { name: 'Braga', icon: 'church' },
  { name: 'Faro', icon: 'beach-access' },
  { name: 'Évora', icon: 'account-balance' },
  { name: 'Gerês', icon: 'terrain' },
  { name: 'Montesinho', icon: 'forest' },
  { name: 'Serra da Estrela', icon: 'landscape' },
  { name: 'Sintra', icon: 'castle' },
  { name: 'Guarda', icon: 'terrain' },
  { name: 'Bragança', icon: 'castle' },
];

// All 44 categories grouped for selection (using correct subcategory IDs)
const ROUTE_CATEGORIES = [
  { id: 'termas_banhos', name: 'Termas', icon: 'hot-tub', color: '#06B6D4' },
  { id: 'praias_fluviais', name: 'Praias Fluviais', icon: 'pool', color: '#0EA5E9' },
  { id: 'miradouros', name: 'Miradouros', icon: 'landscape', color: '#6366F1' },
  { id: 'cascatas_pocos', name: 'Cascatas', icon: 'water', color: '#14B8A6' },
  { id: 'perolas_portugal', name: 'Aldeias', icon: 'holiday-village', color: '#B08556' },
  { id: 'restaurantes_gastronomia', name: 'Gastronomia', icon: 'restaurant-menu', color: '#EF4444' },
  { id: 'festas_romarias', name: 'Festas e Romarias', icon: 'celebration', color: '#F59E0B' },
  { id: 'percursos_pedestres', name: 'Percursos', icon: 'hiking', color: '#22C55E' },
  { id: 'castelos', name: 'Castelos', icon: 'castle', color: '#92400E' },
  { id: 'museus', name: 'Museus', icon: 'museum', color: '#F59E0B' },
  { id: 'arte_urbana', name: 'Arte Urbana', icon: 'palette', color: '#E11D48' },
  { id: 'praias_bandeira_azul', name: 'Praias', icon: 'beach-access', color: '#2563EB' },
  { id: 'agroturismo_enoturismo', name: 'Enoturismo', icon: 'wine-bar', color: '#7C2D12' },
  { id: 'patrimonio_ferroviario', name: 'Ferroviário', icon: 'train', color: '#6366F1' },
  { id: 'ecovias_passadicos', name: 'Passadiços', icon: 'directions-walk', color: '#84CC16' },
  { id: 'surf', name: 'Surf', icon: 'surfing', color: '#0EA5E9' },
];

const PERIOD_ICONS: Record<string, string> = {
  manha: 'wb-sunny',
  almoco: 'restaurant',
  tarde: 'wb-twilight',
  fim_tarde: 'nightlight',
  noite: 'nightlife',
};

const PERIOD_COLORS: Record<string, string> = {
  manha: '#F59E0B',
  almoco: '#EF4444',
  tarde: '#F97316',
  fim_tarde: '#8B5CF6',
  noite: '#6366F1',
};

export default function RoutePlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium } = useAuth();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [maxDetour, setMaxDetour] = useState(50);
  const [showResults, setShowResults] = useState(false);
  const [smartResult, setSmartResult] = useState<SmartItineraryResponse | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);

  const { data: _categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const planMutation = useMutation({
    mutationFn: (request: RoutePlanRequest) => planRoute(request),
    onSuccess: () => {
      setShowResults(true);
    },
  });

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handlePlanRoute = async () => {
    if (!origin.trim() || !destination.trim()) {
      return;
    }

    // Premium gate for smart itinerary
    if (!isPremium) {
      router.push('/premium');
      return;
    }

    // Try smart itinerary first for the destination locality
    setSmartLoading(true);
    try {
      const result = await generateSmartItinerary({
        locality: destination.trim(),
        days: 1,
        categories: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
        pace: 'moderado',
        max_radius_km: maxDetour,
      });
      setSmartResult(result);
      setShowResults(true);
    } catch {
      // Fallback to classic route planning
      planMutation.mutate({
        origin: origin.trim(),
        destination: destination.trim(),
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        max_detour_km: maxDetour,
        max_stops: 10,
      });
    } finally {
      setSmartLoading(false);
    }
  };

  const selectDestination = (name: string, isOrigin: boolean) => {
    if (isOrigin) {
      setOrigin(name);
    } else {
      setDestination(name);
    }
  };

  const openInGoogleMaps = (item: any) => {
    const query = encodeURIComponent(`${item.name}, ${item.address || 'Portugal'}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const openFullRoute = () => {
    if (!planMutation.data) return;
    
    const stops = planMutation.data.suggested_stops;
    if (stops.length === 0) return;
    
    // Build Google Maps directions URL with waypoints
    const waypoints = stops
      .filter(s => s.location)
      .map(s => `${s.location?.lat},${s.location?.lng}`)
      .join('|');
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  // Generate map HTML for route visualization
  const getMapHTML = () => {
    if (!planMutation.data) return '';
    
    const stops = planMutation.data.suggested_stops.filter(s => s.location);
    const markers = stops.map((item, index) => `
      {
        position: { lat: ${item.location?.lat}, lng: ${item.location?.lng} },
        title: "${item.name.replace(/"/g, '\\"')}",
        order: ${index + 1}
      }
    `).join(',');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; }
          html, body, #map { height: 100%; width: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          function initMap() {
            const map = new google.maps.Map(document.getElementById('map'), {
              zoom: 7,
              center: { lat: 39.5, lng: -8.0 },
              styles: [
                { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c4a6e" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#2A2F2A" }] },
              ],
            });
            
            const data = [${markers}];
            const bounds = new google.maps.LatLngBounds();
            
            data.forEach((item, index) => {
              const marker = new google.maps.Marker({
                position: item.position,
                map: map,
                title: item.title,
                label: {
                  text: String(item.order),
                  color: '#2E5E4E',
                  fontWeight: 'bold'
                },
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 16,
                  fillColor: '#C49A6C',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
              });
              bounds.extend(item.position);
            });
            
            if (data.length > 0) {
              map.fitBounds(bounds, { padding: 50 });
            }
            
            // Draw route line
            if (data.length > 1) {
              const routePath = new google.maps.Polyline({
                path: data.map(d => d.position),
                geodesic: true,
                strokeColor: '#C49A6C',
                strokeOpacity: 0.8,
                strokeWeight: 3,
              });
              routePath.setMap(map);
            }
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
      
      {/* Header */}
      <LinearGradient
        colors={['#264E41', '#2E5E4E']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Planear Rota</Text>
          <View style={{ width: 44 }} />
        </View>
        <Text style={styles.headerSubtitle}>
          Descubra os melhores pontos de interesse no seu percurso
        </Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {!showResults ? (
          <>
            {/* Origin & Destination */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>De onde para onde?</Text>
              
              <View style={styles.inputContainer}>
                <MaterialIcons name="trip-origin" size={20} color="#22C55E" />
                <TextInput
                  style={styles.input}
                  placeholder="Origem (ex: Lisboa)"
                  placeholderTextColor="#64748B"
                  value={origin}
                  onChangeText={setOrigin}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <MaterialIcons name="place" size={20} color="#EF4444" />
                <TextInput
                  style={styles.input}
                  placeholder="Destino (ex: Montesinho)"
                  placeholderTextColor="#64748B"
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>
            </View>

            {/* Popular Destinations */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Destinos populares</Text>
              <View style={styles.destinationsGrid}>
                {POPULAR_DESTINATIONS.map((dest) => (
                  <TouchableOpacity
                    key={dest.name}
                    style={[
                      styles.destinationChip,
                      (origin === dest.name || destination === dest.name) && styles.destinationChipActive
                    ]}
                    onPress={() => {
                      if (!origin) {
                        selectDestination(dest.name, true);
                      } else if (!destination) {
                        selectDestination(dest.name, false);
                      } else {
                        selectDestination(dest.name, false);
                      }
                    }}
                  >
                    <MaterialIcons 
                      name={dest.icon as any} 
                      size={16} 
                      color={(origin === dest.name || destination === dest.name) ? '#2E5E4E' : '#94A3B8'} 
                    />
                    <Text style={[
                      styles.destinationChipText,
                      (origin === dest.name || destination === dest.name) && styles.destinationChipTextActive
                    ]}>
                      {dest.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Category Filters */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>O que quer descobrir?</Text>
              <Text style={styles.sectionSubtitle}>Selecione as categorias de interesse</Text>
              
              <View style={styles.categoriesGrid}>
                {ROUTE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      selectedCategories.includes(cat.id) && { borderColor: cat.color, borderWidth: 2 }
                    ]}
                    onPress={() => toggleCategory(cat.id)}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                      <MaterialIcons name={cat.icon as any} size={24} color={cat.color} />
                    </View>
                    <Text style={styles.categoryCardText}>{cat.name}</Text>
                    {selectedCategories.includes(cat.id) && (
                      <View style={[styles.categoryCheck, { backgroundColor: cat.color }]}>
                        <MaterialIcons name="check" size={14} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Detour Distance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Distância máxima de desvio</Text>
              <View style={styles.detourOptions}>
                {[25, 50, 75, 100].map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[
                      styles.detourOption,
                      maxDetour === km && styles.detourOptionActive
                    ]}
                    onPress={() => setMaxDetour(km)}
                  >
                    <Text style={[
                      styles.detourOptionText,
                      maxDetour === km && styles.detourOptionTextActive
                    ]}>
                      {km} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Plan Button */}
            <TouchableOpacity
              style={[
                styles.planButton,
                (!origin.trim() || !destination.trim()) && styles.planButtonDisabled
              ]}
              onPress={handlePlanRoute}
              disabled={!origin.trim() || !destination.trim() || planMutation.isPending || smartLoading}
            >
              {(planMutation.isPending || smartLoading) ? (
                <ActivityIndicator color="#2E5E4E" />
              ) : (
                <>
                  <MaterialIcons name={isPremium ? 'auto-awesome' : 'lock'} size={20} color="#2E5E4E" />
                  <Text style={styles.planButtonText}>
                    {isPremium ? 'Planear Rota Inteligente' : 'Planear Rota — Premium'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : smartResult ? (
          <>
            {/* Smart Itinerary Results */}
            <View style={styles.resultsHeader}>
              <TouchableOpacity
                style={styles.backToFormButton}
                onPress={() => { setShowResults(false); setSmartResult(null); }}
              >
                <MaterialIcons name="arrow-back" size={20} color="#C49A6C" />
                <Text style={styles.backToFormText}>Nova pesquisa</Text>
              </TouchableOpacity>
            </View>

            {/* Route Summary */}
            <View style={styles.routeSummary}>
              <View style={styles.routeEndpoints}>
                <View style={styles.routePoint}>
                  <MaterialIcons name="place" size={20} color="#C49A6C" />
                  <Text style={styles.routePointText}>
                    {smartResult.locality || smartResult.region}
                  </Text>
                </View>
              </View>
              <View style={styles.routeStats}>
                <View style={styles.routeStat}>
                  <MaterialIcons name="place" size={18} color="#C49A6C" />
                  <Text style={styles.routeStatValue}>{smartResult.summary.total_pois} POIs</Text>
                </View>
                <View style={styles.routeStat}>
                  <MaterialIcons name="schedule" size={18} color="#C49A6C" />
                  <Text style={styles.routeStatValue}>{Math.round(smartResult.summary.total_minutes / 60)}h</Text>
                </View>
                <View style={styles.routeStat}>
                  <MaterialIcons name="category" size={18} color="#C49A6C" />
                  <Text style={styles.routeStatValue}>{smartResult.summary.category_count} categorias</Text>
                </View>
              </View>
            </View>

            {/* Smart Itinerary by Period */}
            {smartResult.itinerary.map((day) => (
              <View key={day.day}>
                {day.periods.map((period) => (
                  <View key={period.period} style={styles.periodSection}>
                    <View style={styles.periodHeader}>
                      <MaterialIcons
                        name={(PERIOD_ICONS[period.period] || 'schedule') as any}
                        size={16}
                        color={PERIOD_COLORS[period.period] || '#94A3B8'}
                      />
                      <Text style={[styles.periodTitle, { color: PERIOD_COLORS[period.period] || '#FAF8F3' }]}>
                        {period.label} ({period.start_time})
                      </Text>
                    </View>

                    {period.pois.map((item, index) => (
                      <View key={item.id} style={styles.stopCard}>
                        <View style={styles.stopNumber}>
                          <Text style={styles.stopNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.stopContent}>
                          <Text style={styles.stopName}>{item.name}</Text>
                          <Text style={styles.stopCategory}>{item.category}</Text>
                          {item.description ? (
                            <Text style={styles.stopDescription} numberOfLines={2}>{item.description}</Text>
                          ) : null}
                          <View style={styles.stopMetaRow}>
                            <View style={styles.stopMetaItem}>
                              <MaterialIcons name="schedule" size={12} color="#94A3B8" />
                              <Text style={styles.stopMetaText}>{item.visit_minutes} min visita</Text>
                            </View>
                            {item.travel_from_previous_min > 0 && (
                              <View style={styles.stopMetaItem}>
                                <MaterialIcons name="directions-car" size={12} color="#3B82F6" />
                                <Text style={styles.stopMetaText}>
                                  {item.distance_from_previous_km} km / {item.travel_from_previous_min} min
                                </Text>
                              </View>
                            )}
                            {item.iq_score ? (
                              <View style={styles.stopMetaItem}>
                                <MaterialIcons name="insights" size={12} color="#C49A6C" />
                                <Text style={[styles.stopMetaText, { color: '#C49A6C' }]}>
                                  IQ {Math.round(item.iq_score)}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.stopActions}>
                            <TouchableOpacity
                              style={styles.stopAction}
                              onPress={() => router.push(`/heritage/${item.id}`)}
                            >
                              <MaterialIcons name="info" size={16} color="#C49A6C" />
                              <Text style={styles.stopActionText}>Ver detalhes</Text>
                            </TouchableOpacity>
                            {item.location && (
                              <TouchableOpacity
                                style={styles.stopAction}
                                onPress={() => openInGoogleMaps(item)}
                              >
                                <MaterialIcons name="map" size={16} color="#C49A6C" />
                                <Text style={styles.stopActionText}>Ver no mapa</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : planMutation.data ? (
          <>
            {/* Results Header */}
            <View style={styles.resultsHeader}>
              <TouchableOpacity 
                style={styles.backToFormButton}
                onPress={() => setShowResults(false)}
              >
                <MaterialIcons name="arrow-back" size={20} color="#C49A6C" />
                <Text style={styles.backToFormText}>Nova pesquisa</Text>
              </TouchableOpacity>
            </View>

            {/* Route Summary */}
            <View style={styles.routeSummary}>
              <View style={styles.routeEndpoints}>
                <View style={styles.routePoint}>
                  <MaterialIcons name="trip-origin" size={20} color="#22C55E" />
                  <Text style={styles.routePointText}>{planMutation.data.origin}</Text>
                </View>
                <MaterialIcons name="more-vert" size={20} color="#3D4A3D" />
                <View style={styles.routePoint}>
                  <MaterialIcons name="place" size={20} color="#EF4444" />
                  <Text style={styles.routePointText}>{planMutation.data.destination}</Text>
                </View>
              </View>
              
              <View style={styles.routeStats}>
                <View style={styles.routeStat}>
                  <MaterialIcons name="straighten" size={18} color="#C49A6C" />
                  <Text style={styles.routeStatValue}>{planMutation.data.total_distance_km} km</Text>
                </View>
                <View style={styles.routeStat}>
                  <MaterialIcons name="schedule" size={18} color="#C49A6C" />
                  <Text style={styles.routeStatValue}>{planMutation.data.estimated_duration_hours}h</Text>
                </View>
                <View style={styles.routeStat}>
                  <MaterialIcons name="place" size={18} color="#C49A6C" />
                  <Text style={styles.routeStatValue}>{planMutation.data.suggested_stops.length} paragens</Text>
                </View>
              </View>
            </View>

            {/* Route Description */}
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionTitle}>Sobre esta rota</Text>
              <Text style={styles.descriptionText}>{planMutation.data.route_description}</Text>
            </View>

            {/* Map Preview */}
            {Platform.OS !== 'web' && WebView && planMutation.data.suggested_stops.length > 0 && (
              <View style={styles.mapContainer}>
                <WebView
                  source={{ html: getMapHTML() }}
                  style={styles.map}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                />
              </View>
            )}

            {/* Open in Google Maps */}
            <TouchableOpacity style={styles.openMapsButton} onPress={openFullRoute}>
              <MaterialIcons name="directions" size={20} color="#2E5E4E" />
              <Text style={styles.openMapsButtonText}>Abrir rota completa no Google Maps</Text>
            </TouchableOpacity>

            {/* Suggested Stops */}
            {planMutation.data.suggested_stops.length > 0 && (
              <View style={styles.stopsSection}>
                <Text style={styles.stopsSectionTitle}>
                  Paragens sugeridas ({planMutation.data.suggested_stops.length})
                </Text>
                
                {planMutation.data.suggested_stops.map((item, index) => (
                  <View key={item.id} style={styles.stopCard}>
                    <View style={styles.stopNumber}>
                      <Text style={styles.stopNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stopContent}>
                      <Text style={styles.stopName}>{item.name}</Text>
                      <Text style={styles.stopCategory}>{item.category}</Text>
                      <Text style={styles.stopDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                      {item.tags && item.tags.length > 0 && (
                        <View style={styles.stopTags}>
                          {item.tags.slice(0, 3).map((tag, i) => (
                            <View key={i} style={styles.stopTag}>
                              <Text style={styles.stopTagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <View style={styles.stopActions}>
                        <TouchableOpacity 
                          style={styles.stopAction}
                          onPress={() => router.push(`/heritage/${item.id}`)}
                        >
                          <MaterialIcons name="info" size={16} color="#C49A6C" />
                          <Text style={styles.stopActionText}>Ver detalhes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.stopAction}
                          onPress={() => openInGoogleMaps(item)}
                        >
                          <MaterialIcons name="map" size={16} color="#C49A6C" />
                          <Text style={styles.stopActionText}>Ver no mapa</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E5E4E',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FAF8F3',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAF8F3',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FAF8F3',
  },
  destinationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  destinationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#264E41',
    borderRadius: 20,
    gap: 6,
  },
  destinationChipActive: {
    backgroundColor: '#C49A6C',
  },
  destinationChipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  destinationChipTextActive: {
    color: '#2E5E4E',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FAF8F3',
    textAlign: 'center',
  },
  categoryCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detourOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  detourOption: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#264E41',
    borderRadius: 10,
    alignItems: 'center',
  },
  detourOptionActive: {
    backgroundColor: '#C49A6C',
  },
  detourOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  detourOptionTextActive: {
    color: '#2E5E4E',
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C49A6C',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 32,
    gap: 8,
  },
  planButtonDisabled: {
    backgroundColor: '#3D4A3D',
  },
  planButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E5E4E',
  },
  resultsHeader: {
    marginTop: 12,
  },
  backToFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backToFormText: {
    fontSize: 14,
    color: '#C49A6C',
    fontWeight: '600',
  },
  routeSummary: {
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  routeEndpoints: {
    alignItems: 'center',
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routePointText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FAF8F3',
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2F2A',
  },
  routeStat: {
    alignItems: 'center',
    gap: 4,
  },
  routeStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FAF8F3',
  },
  descriptionCard: {
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAF8F3',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#C8C3B8',
    lineHeight: 22,
  },
  mapContainer: {
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  map: {
    flex: 1,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C49A6C',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  openMapsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E5E4E',
  },
  stopsSection: {
    marginTop: 24,
  },
  stopsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
    marginBottom: 16,
  },
  stopCard: {
    flexDirection: 'row',
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#C49A6C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E5E4E',
  },
  stopContent: {
    flex: 1,
  },
  stopName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FAF8F3',
    marginBottom: 4,
  },
  stopCategory: {
    fontSize: 12,
    color: '#C49A6C',
    fontWeight: '500',
    marginBottom: 6,
  },
  stopDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 8,
  },
  stopTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  stopTag: {
    backgroundColor: '#2A2F2A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stopTagText: {
    fontSize: 11,
    color: '#C8C3B8',
  },
  stopActions: {
    flexDirection: 'row',
    gap: 16,
  },
  stopAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stopActionText: {
    fontSize: 13,
    color: '#C49A6C',
    fontWeight: '500',
  },
  // Smart itinerary period styles
  periodSection: {
    marginTop: 16,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAF8F3',
  },
  stopMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  stopMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stopMetaText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
