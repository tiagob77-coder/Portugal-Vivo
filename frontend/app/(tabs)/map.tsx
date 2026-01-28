import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getCategories, getMapItems } from '../../src/services/api';
import { HeritageItem, Category } from '../../src/types';
import HeritageCard from '../../src/components/HeritageCard';

const { width, height } = Dimensions.get('window');

const REGION_NAMES: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa e Vale do Tejo',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

const REGIONS = [
  { id: 'all', name: 'Todas as Regiões', icon: 'public' },
  { id: 'norte', name: 'Norte', icon: 'landscape' },
  { id: 'centro', name: 'Centro', icon: 'terrain' },
  { id: 'lisboa', name: 'Lisboa', icon: 'location-city' },
  { id: 'alentejo', name: 'Alentejo', icon: 'wb-sunny' },
  { id: 'algarve', name: 'Algarve', icon: 'beach-access' },
  { id: 'acores', name: 'Açores', icon: 'waves' },
  { id: 'madeira', name: 'Madeira', icon: 'local-florist' },
];

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['mapItems', selectedCategories],
    queryFn: () => getMapItems(selectedCategories.length > 0 ? selectedCategories : undefined),
  });

  // Filter items by region
  const items = selectedRegion === 'all' 
    ? allItems 
    : allItems.filter(item => item.region === selectedRegion);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleItemPress = (item: HeritageItem) => {
    router.push(`/heritage/${item.id}`);
  };

  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || '#F59E0B';
  };

  const getCategoryIcon = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.icon || 'place';
  };

  // Group items by region for the list view
  const groupedByRegion = items.reduce((acc: Record<string, HeritageItem[]>, item) => {
    const region = item.region;
    if (!acc[region]) acc[region] = [];
    acc[region].push(item);
    return acc;
  }, {});

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Mapa Cultural</Text>
            <Text style={styles.headerSubtitle}>
              {items.length} pontos de interesse com localização
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <MaterialIcons 
              name="tune" 
              size={24} 
              color={showFilters || selectedCategories.length > 0 ? '#F59E0B' : '#F8FAFC'} 
            />
            {selectedCategories.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{selectedCategories.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Category Filters */}
        {showFilters && (
          <View style={styles.filtersSection}>
            <Text style={styles.filtersLabel}>Filtrar por categoria:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}
            >
              {categories.slice(0, 12).map((category) => (
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
                    size={14} 
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
                <MaterialIcons name="clear" size={16} color="#F59E0B" />
                <Text style={styles.clearButtonText}>Limpar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Region Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.regionTabs}
        contentContainerStyle={styles.regionTabsContent}
      >
        {REGIONS.map((region) => (
          <TouchableOpacity
            key={region.id}
            style={[
              styles.regionTab,
              selectedRegion === region.id && styles.regionTabActive,
            ]}
            onPress={() => setSelectedRegion(region.id)}
          >
            <MaterialIcons 
              name={region.icon as any} 
              size={18} 
              color={selectedRegion === region.id ? '#F59E0B' : '#94A3B8'} 
            />
            <Text style={[
              styles.regionTabText,
              selectedRegion === region.id && styles.regionTabTextActive,
            ]}>
              {region.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>A carregar pontos...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="map" size={64} color="#64748B" />
          <Text style={styles.emptyText}>Nenhum ponto encontrado</Text>
          <Text style={styles.emptySubtext}>Tente alterar os filtros</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.mapItem}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.mapItemIcon, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                <MaterialIcons 
                  name={getCategoryIcon(item.category) as any} 
                  size={24} 
                  color={getCategoryColor(item.category)} 
                />
              </View>
              <View style={styles.mapItemContent}>
                <Text style={styles.mapItemName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.mapItemMeta}>
                  <MaterialIcons name="place" size={12} color="#94A3B8" />
                  <Text style={styles.mapItemRegion}>
                    {REGION_NAMES[item.region] || item.region}
                  </Text>
                  {item.location && (
                    <Text style={styles.mapItemCoords}>
                      {item.location.lat.toFixed(2)}, {item.location.lng.toFixed(2)}
                    </Text>
                  )}
                </View>
                {item.address && (
                  <Text style={styles.mapItemAddress} numberOfLines={1}>{item.address}</Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#64748B" />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Map Legend */}
      <View style={[styles.legend, { paddingBottom: insets.bottom || 16 }]}>
        <View style={styles.legendItem}>
          <MaterialIcons name="location-on" size={16} color="#22C55E" />
          <Text style={styles.legendText}>Localização disponível</Text>
        </View>
        <Text style={styles.legendNote}>
          Mapa interativo disponível no dispositivo móvel
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#F59E0B20',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  filtersSection: {
    marginTop: 12,
  },
  filtersLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  filtersScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
    gap: 4,
  },
  categoryChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  regionTabs: {
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  regionTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  regionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    marginRight: 8,
    gap: 6,
  },
  regionTabActive: {
    backgroundColor: '#F59E0B20',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  regionTabText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  regionTabTextActive: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  listContent: {
    paddingVertical: 12,
  },
  mapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mapItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mapItemContent: {
    flex: 1,
  },
  mapItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  mapItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapItemRegion: {
    fontSize: 12,
    color: '#94A3B8',
  },
  mapItemCoords: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 8,
  },
  mapItemAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#1E293B',
    marginLeft: 76,
  },
  legend: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  legendNote: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
