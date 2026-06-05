import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getNearbyPOIs, getNearbyCategoryCounts, getCategories } from '../src/services/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useTheme } from '../src/context/ThemeContext';
import { palette, categoryColors, withOpacity } from '../src/theme/colors';
import logger from '../src/utils/logger';

function makeStyles(C: Record<string, string>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
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
      color: C.text,
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
      color: C.textSub,
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
      color: C.accent,
    },
    statLabel: {
      fontSize: 11,
      color: C.textSub,
      marginTop: 2,
    },
    radiusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.card,
      gap: 12,
    },
    radiusLabel: {
      fontSize: 13,
      color: C.textSub,
    },
    radiusChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: C.card,
      borderRadius: 20,
      marginRight: 8,
    },
    radiusChipActive: {
      backgroundColor: C.accent,
    },
    radiusChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textSub,
    },
    radiusChipTextActive: {
      color: C.bg,
    },
    categoriesContainer: {
      borderBottomWidth: 1,
      borderBottomColor: C.card,
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
      backgroundColor: C.card,
      borderRadius: 20,
      marginRight: 8,
      gap: 6,
    },
    categoryChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: C.textSub,
    },
    categoryChipTextActive: {
      color: C.bg,
    },
    categoryCount: {
      backgroundColor: C.border,
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
      color: C.textSub,
    },
    categoryCountTextActive: {
      color: C.bg,
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
      color: C.text,
      marginTop: 16,
    },
    loadingSubtext: {
      fontSize: 14,
      color: C.textMuted,
      marginTop: 4,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
      marginTop: 16,
    },
    errorText: {
      fontSize: 14,
      color: C.textSub,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.accent,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 24,
      gap: 8,
    },
    retryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: C.bg,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 20,
    },
    poiCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.card,
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
      color: C.textSub,
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
      color: C.text,
      marginBottom: 4,
    },
    poiAddress: {
      fontSize: 12,
      color: C.textSub,
      marginBottom: 6,
    },
    tagsRow: {
      flexDirection: 'row',
      gap: 6,
    },
    tag: {
      backgroundColor: C.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    tagText: {
      fontSize: 10,
      color: C.textSub,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: C.text,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
  });
}

export default function NearbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const C = {
    bg:        palette.forest[500],
    card:      palette.forest[600],
    cardDeep:  isDark ? palette.forest[800] : palette.forest[700],
    accent:    palette.terracotta[500],
    text:      palette.gray[50],
    textSub:   palette.gray[300],
    textMuted: palette.gray[500],
    border:    palette.gray[800],
  };
  const s = makeStyles(C);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [radius, setRadius] = useState(50);
  const [refreshing, setRefreshing] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

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
        logger.error('Location error:', error);
        setLocationError('Não foi possível obter a sua localização. Verifique se o GPS está ativo.');
      } finally {
        setIsLoadingLocation(false);
      }
    })();
  }, []);

  const {
    data: nearbyData,
    isLoading: isLoadingPOIs,
    refetch,
    error: _poisError
  } = useQuery({
    queryKey: ['nearby', location?.latitude, location?.longitude, radius, selectedCategories],
    queryFn: () => {
      if (!location) throw new Error('No location available');
      return getNearbyPOIs({
        latitude: location.latitude,
        longitude: location.longitude,
        radius_km: radius,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        limit: 50,
      });
    },
    enabled: !!location,
  });

  const { data: categoryCounts } = useQuery({
    queryKey: ['nearbyCounts', location?.latitude, location?.longitude, radius],
    queryFn: () => {
      if (!location) throw new Error('No location available');
      return getNearbyCategoryCounts(location.latitude, location.longitude, radius);
    },
    enabled: !!location,
  });

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (error) {
      logger.error('Error refreshing location:', error);
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
    return categoryColors[categoryId] || palette.gray[500];
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

  if (isLoadingLocation) {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient colors={[C.card, C.bg]} style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerRow}>
            <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={C.text} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Perto de Mim</Text>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>
        <View style={s.centerContent}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={s.loadingText}>A obter a sua localização...</Text>
          <Text style={s.loadingSubtext}>Por favor, aguarde</Text>
        </View>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient colors={[C.card, C.bg]} style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerRow}>
            <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={C.text} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Perto de Mim</Text>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>
        <View style={s.centerContent}>
          <MaterialIcons name="location-off" size={64} color="#EF4444" />
          <Text style={s.errorTitle}>Localização Indisponível</Text>
          <Text style={s.errorText}>{locationError}</Text>
          <TouchableOpacity
            style={s.retryButton}
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
            <MaterialIcons name="refresh" size={20} color={C.bg} />
            <Text style={s.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={[C.card, C.bg]} style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Perto de Mim</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[s.refreshButton, { backgroundColor: withOpacity(C.accent, 0.2) }]}
              onPress={() => router.push('/explore-around' as any)}
            >
              <MaterialIcons name="explore" size={20} color={C.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.refreshButton}
              onPress={onRefresh}
            >
              <MaterialIcons name="my-location" size={22} color={C.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.locationInfo}>
          <MaterialIcons name="location-on" size={18} color="#22C55E" />
          <Text style={s.locationText}>
            {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'A localizar...'}
          </Text>
        </View>

        {categoryCounts && (
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>{categoryCounts.total_pois}</Text>
              <Text style={s.statLabel}>POIs</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{radius} km</Text>
              <Text style={s.statLabel}>Raio</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{categoryCounts.categories.length}</Text>
              <Text style={s.statLabel}>Categorias</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <View style={s.radiusContainer}>
        <Text style={s.radiusLabel}>Raio de pesquisa:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[10, 25, 50, 100].map((r) => (
            <TouchableOpacity
              key={r}
              style={[s.radiusChip, radius === r && s.radiusChipActive]}
              onPress={() => setRadius(r)}
            >
              <Text style={[s.radiusChipText, radius === r && s.radiusChipTextActive]}>
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {categoryCounts && categoryCounts.categories.length > 0 && (
        <View style={s.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoriesContent}>
            {categoryCounts.categories.slice(0, 10).map((cat) => (
              <TouchableOpacity
                key={cat.category}
                style={[
                  s.categoryChip,
                  selectedCategories.includes(cat.category) && {
                    backgroundColor: getCategoryColor(cat.category),
                  }
                ]}
                onPress={() => toggleCategory(cat.category)}
              >
                <Text style={[
                  s.categoryChipText,
                  selectedCategories.includes(cat.category) && s.categoryChipTextActive
                ]}>
                  {getCategoryName(cat.category)}
                </Text>
                <View style={[
                  s.categoryCount,
                  selectedCategories.includes(cat.category) && s.categoryCountActive
                ]}>
                  <Text style={[
                    s.categoryCountText,
                    selectedCategories.includes(cat.category) && s.categoryCountTextActive
                  ]}>
                    {cat.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {isLoadingPOIs ? (
        <View style={s.centerContent}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={s.loadingText}>A procurar POIs próximos...</Text>
        </View>
      ) : nearbyData && nearbyData.pois.length > 0 ? (
        <FlatList
          data={nearbyData.pois}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.accent}
              colors={[C.accent]}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.poiCard}
              onPress={() => router.push(`/heritage/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={s.poiCardLeft}>
                <View style={[s.distanceBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                  <Text style={[s.distanceText, { color: getCategoryColor(item.category) }]}>
                    {item.distance_km < 1
                      ? `${Math.round(item.distance_km * 1000)} m`
                      : `${item.distance_km.toFixed(1)} km`}
                  </Text>
                </View>
                <View style={s.directionBadge}>
                  <MaterialIcons
                    name={getDirectionIcon(item.direction) as any}
                    size={14}
                    color={C.textSub}
                  />
                  <Text style={s.directionText}>{item.direction}</Text>
                </View>
              </View>

              <View style={s.poiCardContent}>
                <View style={[s.categoryBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                  <Text style={[s.categoryBadgeText, { color: getCategoryColor(item.category) }]}>
                    {getCategoryName(item.category)}
                  </Text>
                </View>
                <Text style={s.poiName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.poiAddress} numberOfLines={1}>{item.address}</Text>

                {item.tags && item.tags.length > 0 && (
                  <View style={s.tagsRow}>
                    {item.tags.slice(0, 2).map((tag) => (
                      <View key={`${item.id}-${tag}`} style={s.tag}>
                        <Text style={s.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <MaterialIcons name="chevron-right" size={24} color={C.cardDeep} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={s.centerContent}>
          <MaterialIcons name="location-searching" size={64} color={C.cardDeep} />
          <Text style={s.emptyTitle}>Nenhum POI encontrado</Text>
          <Text style={s.emptyText}>
            Não existem pontos de interesse num raio de {radius} km.
            {selectedCategories.length > 0 ? '\nExperimente remover filtros de categoria.' : '\nExperimente aumentar o raio de pesquisa.'}
          </Text>
        </View>
      )}
    </View>
  );
}
