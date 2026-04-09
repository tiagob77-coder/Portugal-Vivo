import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getNearbyPOIs, getNearbyCategoryCounts, getCategories } from '../src/services/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  termas: '#06B6D4',
  piscinas: '#0EA5E9',
  miradouros: '#6366F1',
  cascatas: '#14B8A6',
  aldeias: '#B08556',
  gastronomia: '#EF4444',
  religioso: '#7C3AED',
  natureza: '#22C55E',
  lendas: '#8B5CF6',
  festas: '#C49A6C',
  default: '#64748B',
};

export default function NearbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [radius, setRadius] = useState(50); // Default 50km radius
  const [refreshing, setRefreshing] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  // Get user location
  useEffect(() => {
    (async () => {
      try {
        setIsLoadingLocation(true);
        setLocationError(null);
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permissão de localização negada. Por favor, ative a localização nas definições.');
          setIsLoadingLocation(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } catch (error) {
        console.error('Location error:', error);
        setLocationError('Não foi possível obter a sua localização. Verifique se o GPS está ativo.');
      } finally {
        setIsLoadingLocation(false);
      }
    })();
  }, []);

  // Fetch nearby POIs
  const { 
    data: nearbyData, 
    isLoading: isLoadingPOIs, 
    refetch,
    error: _poisError
  } = useQuery({
    queryKey: ['nearby', location?.latitude, location?.longitude, radius, selectedCategories],
    queryFn: () => getNearbyPOIs({
      latitude: location!.latitude,
      longitude: location!.longitude,
      radius_km: radius,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      limit: 50,
    }),
    enabled: !!location,
  });

  // Fetch category counts
  const { data: categoryCounts } = useQuery({
    queryKey: ['nearbyCounts', location?.latitude, location?.longitude, radius],
    queryFn: () => getNearbyCategoryCounts(location!.latitude, location!.longitude, radius),
    enabled: !!location,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    
    // Refresh location
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (error) {
      console.error('Error refreshing location:', error);
    }
    
    await refetch();
    setRefreshing(false);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getCategoryColor = (categoryId: string) => {
    return CATEGORY_COLORS[categoryId] || CATEGORY_COLORS.default;
  };

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || categoryId;
  };

  const getDirectionIcon = (direction: string) => {
    const icons: Record<string, string> = {
      'N': 'north',
      'NE': 'north-east',
      'E': 'east',
      'SE': 'south-east',
      'S': 'south',
      'SW': 'south-west',
      'W': 'west',
      'NW': 'north-west',
    };
    return icons[direction] || 'explore';
  };

  // Render loading state
  if (isLoadingLocation) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient colors={['#264E41', '#2E5E4E']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Perto de Mim</Text>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#C49A6C" />
          <Text style={styles.loadingText}>A obter a sua localização...</Text>
          <Text style={styles.loadingSubtext}>Por favor, aguarde</Text>
        </View>
      </View>
    );
  }

  // Render error state
  if (locationError) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient colors={['#264E41', '#2E5E4E']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Perto de Mim</Text>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>
        <View style={styles.centerContent}>
          <MaterialIcons name="location-off" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Localização Indisponível</Text>
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setIsLoadingLocation(true);
              setLocationError(null);
              (async () => {
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({});
                    setLocation({
                      latitude: loc.coords.latitude,
                      longitude: loc.coords.longitude,
                    });
                  } else {
                    setLocationError('Permissão de localização negada.');
                  }
                } catch (_e) {
                  setLocationError('Erro ao obter localização.');
                } finally {
                  setIsLoadingLocation(false);
                }
              })();
            }}
          >
            <MaterialIcons name="refresh" size={20} color="#2E5E4E" />
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient colors={['#264E41', '#2E5E4E']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Perto de Mim</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: 'rgba(196,154,108,0.2)' }]}
              onPress={() => router.push('/explore-around' as any)}
            >
              <MaterialIcons name="explore" size={20} color="#C49A6C" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <MaterialIcons name="my-location" size={22} color="#C49A6C" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Info */}
        <View style={styles.locationInfo}>
          <MaterialIcons name="location-on" size={18} color="#22C55E" />
          <Text style={styles.locationText}>
            {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'A localizar...'}
          </Text>
        </View>
        
        {/* Stats */}
        {categoryCounts && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{categoryCounts.total_pois}</Text>
              <Text style={styles.statLabel}>POIs</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{radius} km</Text>
              <Text style={styles.statLabel}>Raio</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{categoryCounts.categories.length}</Text>
              <Text style={styles.statLabel}>Categorias</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Radius Selector */}
      <View style={styles.radiusContainer}>
        <Text style={styles.radiusLabel}>Raio de pesquisa:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[10, 25, 50, 100].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusChip, radius === r && styles.radiusChipActive]}
              onPress={() => setRadius(r)}
            >
              <Text style={[styles.radiusChipText, radius === r && styles.radiusChipTextActive]}>
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Category Filters */}
      {categoryCounts && categoryCounts.categories.length > 0 && (
        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
            {categoryCounts.categories.slice(0, 10).map((cat) => (
              <TouchableOpacity
                key={cat.category}
                style={[
                  styles.categoryChip,
                  selectedCategories.includes(cat.category) && {
                    backgroundColor: getCategoryColor(cat.category),
                  }
                ]}
                onPress={() => toggleCategory(cat.category)}
              >
                <Text style={[
                  styles.categoryChipText,
                  selectedCategories.includes(cat.category) && styles.categoryChipTextActive
                ]}>
                  {getCategoryName(cat.category)}
                </Text>
                <View style={[
                  styles.categoryCount,
                  selectedCategories.includes(cat.category) && styles.categoryCountActive
                ]}>
                  <Text style={[
                    styles.categoryCountText,
                    selectedCategories.includes(cat.category) && styles.categoryCountTextActive
                  ]}>
                    {cat.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* POI List */}
      {isLoadingPOIs ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#C49A6C" />
          <Text style={styles.loadingText}>A procurar POIs próximos...</Text>
        </View>
      ) : nearbyData && nearbyData.pois.length > 0 ? (
        <FlatList
          data={nearbyData.pois}
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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.poiCard}
              onPress={() => router.push(`/heritage/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.poiCardLeft}>
                <View style={[styles.distanceBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                  <Text style={[styles.distanceText, { color: getCategoryColor(item.category) }]}>
                    {item.distance_km < 1 
                      ? `${Math.round(item.distance_km * 1000)} m` 
                      : `${item.distance_km.toFixed(1)} km`}
                  </Text>
                </View>
                <View style={styles.directionBadge}>
                  <MaterialIcons 
                    name={getDirectionIcon(item.direction) as any} 
                    size={14} 
                    color="#94A3B8" 
                  />
                  <Text style={styles.directionText}>{item.direction}</Text>
                </View>
              </View>
              
              <View style={styles.poiCardContent}>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                  <Text style={[styles.categoryBadgeText, { color: getCategoryColor(item.category) }]}>
                    {getCategoryName(item.category)}
                  </Text>
                </View>
                <Text style={styles.poiName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.poiAddress} numberOfLines={1}>{item.address}</Text>
                
                {item.tags && item.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {item.tags.slice(0, 2).map((tag, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              
              <MaterialIcons name="chevron-right" size={24} color="#3D4A3D" />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.centerContent}>
          <MaterialIcons name="location-searching" size={64} color="#3D4A3D" />
          <Text style={styles.emptyTitle}>Nenhum POI encontrado</Text>
          <Text style={styles.emptyText}>
            Não existem pontos de interesse num raio de {radius} km.
            {selectedCategories.length > 0 ? '\nExperimente remover filtros de categoria.' : '\nExperimente aumentar o raio de pesquisa.'}
          </Text>
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(51, 65, 85, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C49A6C',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  radiusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#264E41',
    gap: 12,
  },
  radiusLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  radiusChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#264E41',
    borderRadius: 20,
    marginRight: 8,
  },
  radiusChipActive: {
    backgroundColor: '#C49A6C',
  },
  radiusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  radiusChipTextActive: {
    color: '#2E5E4E',
  },
  categoriesContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#264E41',
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#264E41',
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  categoryChipTextActive: {
    color: '#2E5E4E',
  },
  categoryCount: {
    backgroundColor: '#2A2F2A',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  categoryCountActive: {
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C8C3B8',
  },
  categoryCountTextActive: {
    color: '#2E5E4E',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FAF8F3',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FAF8F3',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C49A6C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E5E4E',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  poiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  poiCardLeft: {
    alignItems: 'center',
    gap: 6,
  },
  distanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  directionText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  poiCardContent: {
    flex: 1,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  poiName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FAF8F3',
    marginBottom: 4,
  },
  poiAddress: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tag: {
    backgroundColor: '#2A2F2A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    color: '#C8C3B8',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
