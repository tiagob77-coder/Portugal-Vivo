import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getCategories, getHeritageItems, getStats, getRegions } from '../../src/services/api';
import CategoryCard from '../../src/components/CategoryCard';
import HeritageCard from '../../src/components/HeritageCard';
import { Category, HeritageItem, Region } from '../../src/types';
import { useTheme, palette, withOpacity } from '../../src/theme';

const ALL_REGION: Region = { id: 'all', name: 'Todas', color: '' };

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [viewMode, setViewMode] = useState<'categories' | 'items'>('categories');

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: apiRegions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: getRegions,
  });

  const regions: Region[] = useMemo(() => [ALL_REGION, ...apiRegions], [apiRegions]);

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const { data: items = [], isLoading: itemsLoading, refetch } = useQuery({
    queryKey: ['heritage', selectedCategory, selectedRegion, searchQuery],
    queryFn: () => getHeritageItems({
      category: selectedCategory || undefined,
      region: selectedRegion !== 'all' ? selectedRegion : undefined,
      search: searchQuery || undefined,
      limit: 50,
    }),
    enabled: viewMode === 'items' || !!searchQuery,
  });

  const categoriesWithCounts = useMemo<(Category & { count: number })[]>(() => {
    if (!categories) return [];
    return categories.map(cat => ({
      ...cat,
      count: stats?.categories?.find((s: any) => s.id === cat.id)?.count || 0,
    }));
  }, [categories, stats]);

  const handleCategoryPress = (category: Category) => {
    setSelectedCategory(category.id);
    setViewMode('items');
  };

  const handleItemPress = (item: HeritageItem) => {
    router.push(`/heritage/${item.id}`);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.length > 2) {
      setViewMode('items');
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedRegion('all');
    setSearchQuery('');
    setViewMode('categories');
  };

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Explorar</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Património Vivo de Portugal</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Pesquisar lendas, festas, lugares..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Region Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {regions.map(region => (
          <TouchableOpacity
            key={region.id}
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedRegion === region.id && { backgroundColor: withOpacity(colors.accent, 0.12), borderColor: colors.accent },
            ]}
            onPress={() => setSelectedRegion(region.id)}
          >
            <Text style={[
              styles.filterChipText,
              { color: colors.textSecondary },
              selectedRegion === region.id && { color: colors.accent },
            ]}>
              {region.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* View Toggle */}
      {(selectedCategory || searchQuery) && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity style={styles.backButton} onPress={clearFilters}>
            <MaterialIcons name="arrow-back" size={20} color={colors.accent} />
            <Text style={[styles.backText, { color: colors.accent }]}>Categorias</Text>
          </TouchableOpacity>
          {selectedCategoryData && (
            <View style={[styles.selectedBadge, { backgroundColor: selectedCategoryData.color + '20' }]}>
              <MaterialIcons name={selectedCategoryData.icon as any} size={14} color={selectedCategoryData.color} />
              <Text style={[styles.selectedBadgeText, { color: selectedCategoryData.color }]}>
                {selectedCategoryData.name}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      {viewMode === 'categories' && !searchQuery ? (
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.categoriesGrid}
        >
          {categoriesLoading ? (
            <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
          ) : (
            <View style={styles.gridContainer}>
              {categoriesWithCounts.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  count={category.count}
                  onPress={() => handleCategoryPress(category)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HeritageCard
              item={item}
              categories={categories}
              onPress={() => handleItemPress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={itemsLoading}
              onRefresh={refetch}
              tintColor="#F59E0B"
            />
          }
          ListEmptyComponent={
            itemsLoading ? (
              <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="search-off" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Nenhum resultado encontrado</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  filtersScroll: {
    maxHeight: 44,
    marginBottom: 12,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipActive: {},
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {},
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  categoriesGrid: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});
