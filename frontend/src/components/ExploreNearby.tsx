import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE } from '../config/api';
import { palette, withOpacity } from '../theme/colors';

// ========================
// TYPES
// ========================

interface Location {
  lat: number;
  lng: number;
}

interface POI {
  id: string;
  name: string;
  category: string;
  region?: string;
  location: Location;
  iq_score?: number;
  image_url?: string;
  description?: string;
  distance_km: number;
  distance_m: number;
  direction: string;
  walking_minutes: number;
  driving_minutes: number;
  visit_count?: number;
  stop_number?: number;
  cumulative_walking_minutes?: number;
  leg_walking_minutes?: number;
}

interface DiscoverResponse {
  pois: POI[];
  grouped_by_category: Record<string, POI[]>;
  summary: {
    total_found: number;
    returned: number;
    categories_breakdown: Record<string, number>;
    suggested_radius_km: number | null;
  };
}

interface HighlightsResponse {
  closest_poi: POI | null;
  highest_rated: POI | null;
  hidden_gem: POI | null;
  categories_nearby: Record<string, number>;
  suggested_route: POI[];
  total_nearby: number;
}

interface WalkingRouteResponse {
  route: POI[];
  total_walking_minutes: number;
  total_distance_km: number;
  return_to_start_minutes: number;
  total_with_return_minutes: number;
  poi_count: number;
}

interface ExploreNearbyProps {
  onPOIPress?: (poi: POI) => void;
  onRoutePress?: (route: POI[]) => void;
}

// ========================
// GEOLOCATION HELPER
// ========================

const useDeviceLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setError('Geolocalização não suportada neste browser');
          setLoading(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setLoading(false);
          },
          (err) => {
            setError(`Erro de geolocalização: ${err.message}`);
            setLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        // React Native / Expo
        const ExpoLocation = require('expo-location'); // eslint-disable-line @typescript-eslint/no-require-imports
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Permissão de localização negada');
          setLoading(false);
          return;
        }
        const loc = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.High,
        });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setLoading(false);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao obter localização');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { location, error, loading, refresh: requestLocation };
};

// ========================
// API CALLS
// ========================

const fetchDiscover = async (lat: number, lng: number, radius: number, sortBy: string): Promise<DiscoverResponse> => {
  const { data } = await axios.get(`${API_BASE}/explore-nearby/discover`, {
    params: { lat, lng, radius_km: radius, sort_by: sortBy, limit: 30 },
  });
  return data;
};

const fetchHighlights = async (lat: number, lng: number, radius: number): Promise<HighlightsResponse> => {
  const { data } = await axios.get(`${API_BASE}/explore-nearby/highlights`, {
    params: { lat, lng, radius_km: radius },
  });
  return data;
};

const fetchWalkingRoute = async (lat: number, lng: number, maxMinutes: number): Promise<WalkingRouteResponse> => {
  const { data } = await axios.get(`${API_BASE}/explore-nearby/walking-route`, {
    params: { lat, lng, max_minutes: maxMinutes },
  });
  return data;
};

// ========================
// CONSTANTS
// ========================

const RADIUS_OPTIONS = [1, 2, 5, 10, 25];
const SORT_OPTIONS: { key: string; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'distance', label: 'Distância', icon: 'near-me' },
  { key: 'iq_score', label: 'Classificação', icon: 'star' },
  { key: 'popular', label: 'Popular', icon: 'trending-up' },
];

const DIRECTION_ARROWS: Record<string, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘',
  S: '↓', SW: '↙', W: '←', NW: '↖',
};

const CATEGORY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  'Monumento': 'account-balance',
  'Igreja': 'church',
  'Museu': 'museum',
  'Castelo': 'fort',
  'Praia': 'beach-access',
  'Miradouro': 'landscape',
  'Parque': 'park',
  'Jardim': 'local-florist',
  'Ruínas': 'domain-disabled',
};

// ========================
// COMPONENT
// ========================

const ExploreNearby: React.FC<ExploreNearbyProps> = ({ onPOIPress, onRoutePress }) => {
  const { location, error: locError, loading: locLoading, refresh: refreshLocation } = useDeviceLocation();
  const [selectedRadius, setSelectedRadius] = useState(5);
  const [sortBy, setSortBy] = useState('distance');
  const [activeTab, setActiveTab] = useState<'discover' | 'route'>('discover');

  const {
    data: discoverData,
    isLoading: discoverLoading,
    refetch: refetchDiscover,
  } = useQuery({
    queryKey: ['explore-discover', location?.lat, location?.lng, selectedRadius, sortBy],
    queryFn: () => fetchDiscover(location!.lat, location!.lng, selectedRadius, sortBy),
    enabled: !!location,
  });

  const {
    data: highlightsData,
    isLoading: highlightsLoading,
  } = useQuery({
    queryKey: ['explore-highlights', location?.lat, location?.lng, selectedRadius],
    queryFn: () => fetchHighlights(location!.lat, location!.lng, selectedRadius),
    enabled: !!location,
  });

  const {
    data: walkingData,
    isLoading: walkingLoading,
  } = useQuery({
    queryKey: ['explore-walking', location?.lat, location?.lng],
    queryFn: () => fetchWalkingRoute(location!.lat, location!.lng, 60),
    enabled: !!location && activeTab === 'route',
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLocation();
    await refetchDiscover();
    setRefreshing(false);
  }, [refreshLocation, refetchDiscover]);

  // Loading state
  if (locLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.terracotta[500]} />
        <Text style={styles.loadingText}>A obter localização...</Text>
      </View>
    );
  }

  // Error state
  if (locError || !location) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="location-off" size={48} color="#94A3B8" />
        <Text style={styles.errorText}>{locError || 'Localização indisponível'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshLocation}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getCategoryIcon = (category: string): keyof typeof MaterialIcons.glyphMap => {
    return CATEGORY_ICONS[category] || 'place';
  };

  const renderHighlightCard = (
    poi: POI | null,
    title: string,
    icon: keyof typeof MaterialIcons.glyphMap,
    color: string
  ) => {
    if (!poi) return null;
    return (
      <TouchableOpacity style={styles.highlightCard} onPress={() => onPOIPress?.(poi)}>
        <View style={[styles.highlightIconWrap, { backgroundColor: color + '20' }]}>
          <MaterialIcons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.highlightLabel}>{title}</Text>
        <Text style={styles.highlightName} numberOfLines={1}>{poi.name}</Text>
        <Text style={styles.highlightMeta}>
          {poi.distance_km} km {DIRECTION_ARROWS[poi.direction] || ''} {poi.direction}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPOICard = (poi: POI) => (
    <TouchableOpacity
      key={poi.id}
      style={styles.poiCard}
      onPress={() => onPOIPress?.(poi)}
    >
      <View style={styles.poiHeader}>
        <MaterialIcons name={getCategoryIcon(poi.category)} size={22} color={palette.terracotta[500]} />
        <View style={styles.poiInfo}>
          <Text style={styles.poiName} numberOfLines={1}>{poi.name}</Text>
          <Text style={styles.poiCategory}>{poi.category}{poi.region ? ` · ${poi.region}` : ''}</Text>
        </View>
        {poi.iq_score != null && (
          <View style={styles.iqBadge}>
            <Text style={styles.iqText}>{Math.round(poi.iq_score)}</Text>
          </View>
        )}
      </View>

      {poi.description ? (
        <Text style={styles.poiDescription} numberOfLines={2}>{poi.description}</Text>
      ) : null}

      <View style={styles.poiMeta}>
        <View style={styles.metaItem}>
          <MaterialIcons name="straighten" size={14} color="#94A3B8" />
          <Text style={styles.metaValue}>{poi.distance_km} km</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.directionArrow}>{DIRECTION_ARROWS[poi.direction] || ''}</Text>
          <Text style={styles.metaValue}>{poi.direction}</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialIcons name="directions-walk" size={14} color="#94A3B8" />
          <Text style={styles.metaValue}>{poi.walking_minutes} min</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialIcons name="directions-car" size={14} color="#94A3B8" />
          <Text style={styles.metaValue}>{poi.driving_minutes} min</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderWalkingRoute = () => {
    if (walkingLoading) {
      return (
        <View style={styles.routeLoading}>
          <ActivityIndicator size="small" color={palette.terracotta[500]} />
          <Text style={styles.loadingText}>A calcular rota...</Text>
        </View>
      );
    }

    if (!walkingData || walkingData.route.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialIcons name="directions-walk" size={40} color="#475569" />
          <Text style={styles.emptyText}>Sem POIs alcançáveis a pé nesta zona</Text>
        </View>
      );
    }

    return (
      <View>
        <View style={styles.routeSummary}>
          <View style={styles.routeStat}>
            <Text style={styles.routeStatValue}>{walkingData.poi_count}</Text>
            <Text style={styles.routeStatLabel}>Paragens</Text>
          </View>
          <View style={styles.routeStat}>
            <Text style={styles.routeStatValue}>{walkingData.total_walking_minutes}</Text>
            <Text style={styles.routeStatLabel}>min caminhada</Text>
          </View>
          <View style={styles.routeStat}>
            <Text style={styles.routeStatValue}>{walkingData.total_distance_km}</Text>
            <Text style={styles.routeStatLabel}>km total</Text>
          </View>
          <View style={styles.routeStat}>
            <Text style={styles.routeStatValue}>+{walkingData.return_to_start_minutes}</Text>
            <Text style={styles.routeStatLabel}>min regresso</Text>
          </View>
        </View>

        {walkingData.route.map((poi, index) => (
          <TouchableOpacity
            key={poi.id}
            style={styles.routeStop}
            onPress={() => onPOIPress?.(poi)}
          >
            <View style={styles.routeStopNumber}>
              <Text style={styles.stopNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.routeStopInfo}>
              <Text style={styles.routeStopName} numberOfLines={1}>{poi.name}</Text>
              <Text style={styles.routeStopMeta}>
                {poi.category} · {poi.leg_walking_minutes} min a pé · {poi.cumulative_walking_minutes} min total
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#475569" />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.startRouteButton}
          onPress={() => onRoutePress?.(walkingData.route)}
        >
          <MaterialIcons name="directions-walk" size={20} color="#0F172A" />
          <Text style={styles.startRouteText}>Iniciar Rota</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const grouped = discoverData?.grouped_by_category || {};
  const summary = discoverData?.summary;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.terracotta[500]}
          colors={[palette.terracotta[500]]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <MaterialIcons name="explore" size={24} color={palette.terracotta[500]} />
        <Text style={styles.title}>Explorar Perto de Mim</Text>
      </View>

      {/* Highlights Section */}
      {!highlightsLoading && highlightsData && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.highlightsRow}>
          {renderHighlightCard(highlightsData.closest_poi, 'Mais Perto', 'near-me', '#3B82F6')}
          {renderHighlightCard(highlightsData.highest_rated, 'Melhor Classificado', 'star', '#F59E0B')}
          {renderHighlightCard(highlightsData.hidden_gem, 'Joia Escondida', 'auto-awesome', '#8B5CF6')}
        </ScrollView>
      )}

      {/* Radius Selector */}
      <View style={styles.selectorSection}>
        <Text style={styles.selectorLabel}>Raio</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusChip, selectedRadius === r && styles.radiusChipActive]}
              onPress={() => setSelectedRadius(r)}
            >
              <Text style={[styles.radiusChipText, selectedRadius === r && styles.radiusChipTextActive]}>
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sort Selector */}
      <View style={styles.selectorSection}>
        <Text style={styles.selectorLabel}>Ordenar</Text>
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
              onPress={() => setSortBy(opt.key)}
            >
              <MaterialIcons
                name={opt.icon}
                size={14}
                color={sortBy === opt.key ? '#0F172A' : '#94A3B8'}
              />
              <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'discover' && styles.tabButtonActive]}
          onPress={() => setActiveTab('discover')}
        >
          <MaterialIcons
            name="explore"
            size={16}
            color={activeTab === 'discover' ? palette.terracotta[500] : '#94A3B8'}
          />
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Descobrir
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'route' && styles.tabButtonActive]}
          onPress={() => setActiveTab('route')}
        >
          <MaterialIcons
            name="directions-walk"
            size={16}
            color={activeTab === 'route' ? palette.terracotta[500] : '#94A3B8'}
          />
          <Text style={[styles.tabText, activeTab === 'route' && styles.tabTextActive]}>
            Rota a Pé
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'discover' ? (
        <View style={styles.content}>
          {discoverLoading ? (
            <View style={styles.routeLoading}>
              <ActivityIndicator size="small" color={palette.terracotta[500]} />
              <Text style={styles.loadingText}>A procurar POIs...</Text>
            </View>
          ) : summary && summary.total_found === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={40} color="#475569" />
              <Text style={styles.emptyText}>Sem POIs neste raio</Text>
              {summary.suggested_radius_km && (
                <TouchableOpacity
                  style={styles.suggestButton}
                  onPress={() => setSelectedRadius(summary.suggested_radius_km!)}
                >
                  <Text style={styles.suggestText}>
                    Tentar {summary.suggested_radius_km} km
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            Object.entries(grouped).map(([category, pois]) => (
              <View key={category} style={styles.categoryGroup}>
                <View style={styles.categoryHeader}>
                  <MaterialIcons name={getCategoryIcon(category)} size={18} color={palette.terracotta[500]} />
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <View style={styles.categoryCount}>
                    <Text style={styles.categoryCountText}>{pois.length}</Text>
                  </View>
                </View>
                {pois.map(renderPOICard)}
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={styles.content}>
          {renderWalkingRoute()}
        </View>
      )}

      {/* Summary Footer */}
      {summary && summary.total_found > 0 && activeTab === 'discover' && (
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryText}>
            {summary.returned} de {summary.total_found} POIs num raio de {selectedRadius} km
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

// ========================
// STYLES
// ========================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 32,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.terracotta[500],
  },
  retryText: {
    color: palette.terracotta[500],
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F1F5F9',
  },

  // Highlights
  highlightsRow: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  highlightCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginRight: 10,
    width: 150,
    borderWidth: 1,
    borderColor: '#334155',
  },
  highlightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  highlightLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 4,
  },
  highlightMeta: {
    fontSize: 12,
    color: palette.terracotta[500],
    marginTop: 4,
    fontWeight: '600',
  },

  // Selectors
  selectorSection: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  selectorRow: {
    flexDirection: 'row',
  },
  radiusChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  radiusChipActive: {
    backgroundColor: palette.terracotta[500],
    borderColor: palette.terracotta[500],
  },
  radiusChipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  radiusChipTextActive: {
    color: '#0F172A',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  sortChipActive: {
    backgroundColor: palette.terracotta[500],
    borderColor: palette.terracotta[500],
  },
  sortChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#0F172A',
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#0F172A',
  },
  tabText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  tabTextActive: {
    color: palette.terracotta[500],
  },

  // Content
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },

  // Category groups
  categoryGroup: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    flex: 1,
  },
  categoryCount: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryCountText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },

  // POI Cards
  poiCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  poiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  poiInfo: {
    flex: 1,
  },
  poiName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  poiCategory: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  iqBadge: {
    backgroundColor: withOpacity(palette.terracotta[500], 0.13),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: withOpacity(palette.terracotta[500], 0.25),
  },
  iqText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.terracotta[500],
  },
  poiDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
    lineHeight: 18,
  },
  poiMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaValue: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  directionArrow: {
    fontSize: 14,
    color: palette.terracotta[500],
  },

  // Walking Route
  routeLoading: {
    padding: 32,
    alignItems: 'center',
  },
  routeSummary: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'space-around',
  },
  routeStat: {
    alignItems: 'center',
  },
  routeStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.terracotta[500],
  },
  routeStatLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  routeStopNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.terracotta[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  routeStopInfo: {
    flex: 1,
  },
  routeStopName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  routeStopMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  startRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.terracotta[500],
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  startRouteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
    textAlign: 'center',
  },
  suggestButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: withOpacity(palette.terracotta[500], 0.13),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.terracotta[500],
  },
  suggestText: {
    color: palette.terracotta[500],
    fontSize: 14,
    fontWeight: '600',
  },

  // Summary Footer
  summaryFooter: {
    padding: 16,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 12,
    color: '#475569',
  },
});

export default ExploreNearby;
