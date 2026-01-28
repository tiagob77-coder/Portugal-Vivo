import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getCategories, getMapItems } from '../../src/services/api';
import { HeritageItem, Category } from '../../src/types';

const { width, height } = Dimensions.get('window');

// Conditionally import MapView for native platforms
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('Maps not available');
  }
}

const PORTUGAL_REGION = {
  latitude: 39.5,
  longitude: -8.0,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

const GOOGLE_MAPS_API_KEY = 'AIzaSyDjEkvguNALmvkSNapWvkUDTrT9juoU3RE';

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<HeritageItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['mapItems', selectedCategories],
    queryFn: () => getMapItems(selectedCategories.length > 0 ? selectedCategories : undefined),
  });

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleMarkerPress = (item: HeritageItem) => {
    setSelectedItem(item);
  };

  const handleItemPress = () => {
    if (selectedItem) {
      router.push(`/heritage/${selectedItem.id}`);
    }
  };

  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || '#F59E0B';
  };

  const getCategoryIcon = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.icon || 'place';
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={PORTUGAL_REGION}
        showsUserLocation
        showsCompass
        showsScale
        mapType="standard"
      >
        {items.map((item) => (
          item.location && (
            <Marker
              key={item.id}
              coordinate={{
                latitude: item.location.lat,
                longitude: item.location.lng,
              }}
              onPress={() => handleMarkerPress(item)}
              pinColor={getCategoryColor(item.category)}
            />
          )
        ))}
      </MapView>

      {/* Header Overlay */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mapa Cultural</Text>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <MaterialIcons 
              name="filter-list" 
              size={24} 
              color={selectedCategories.length > 0 ? '#F59E0B' : '#F8FAFC'} 
            />
            {selectedCategories.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{selectedCategories.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text style={styles.loadingText}>A carregar pontos...</Text>
          </View>
        )}

        {/* Items Count */}
        {!isLoading && (
          <Text style={styles.itemsCount}>
            {items.length} pontos no mapa
          </Text>
        )}
      </View>

      {/* Category Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {categories.slice(0, 10).map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategories.includes(category.id) && {
                    backgroundColor: category.color + '30',
                    borderColor: category.color,
                  },
                ]}
                onPress={() => toggleCategory(category.id)}
              >
                <MaterialIcons 
                  name={category.icon as any} 
                  size={16} 
                  color={selectedCategories.includes(category.id) ? category.color : '#94A3B8'} 
                />
                <Text style={[
                  styles.categoryChipText,
                  selectedCategories.includes(category.id) && { color: category.color },
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedCategories.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSelectedCategories([])}
            >
              <Text style={styles.clearButtonText}>Limpar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Selected Item Card */}
      {selectedItem && (
        <TouchableOpacity 
          style={[styles.itemCard, { paddingBottom: insets.bottom + 16 }]}
          onPress={handleItemPress}
          activeOpacity={0.95}
        >
          <View style={styles.itemCardHeader}>
            <View style={[
              styles.itemCategoryBadge, 
              { backgroundColor: getCategoryColor(selectedItem.category) + '20' }
            ]}>
              <MaterialIcons 
                name={getCategoryIcon(selectedItem.category) as any} 
                size={14} 
                color={getCategoryColor(selectedItem.category)} 
              />
            </View>
            <TouchableOpacity onPress={() => setSelectedItem(null)}>
              <MaterialIcons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.itemName}>{selectedItem.name}</Text>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {selectedItem.description}
          </Text>
          {selectedItem.address && (
            <View style={styles.itemAddress}>
              <MaterialIcons name="place" size={14} color="#94A3B8" />
              <Text style={styles.itemAddressText}>{selectedItem.address}</Text>
            </View>
          )}
          <View style={styles.itemCardFooter}>
            <Text style={styles.viewMoreText}>Ver detalhes</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#F59E0B" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  itemsCount: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  filtersContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingVertical: 12,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  clearButton: {
    alignSelf: 'center',
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  itemCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemCategoryBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 12,
  },
  itemAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  itemAddressText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  itemCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  viewMoreText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
  },
});
