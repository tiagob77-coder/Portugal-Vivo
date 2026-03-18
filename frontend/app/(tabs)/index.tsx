import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getCategories, getHeritageItems, getStats, getRegions } from '../../src/services/api';
import CategoryCard from '../../src/components/CategoryCard';
import HeritageCard from '../../src/components/HeritageCard';
import { Category, HeritageItem, Region } from '../../src/types';
import { useTheme, palette, withOpacity } from '../../src/theme';

const ALL_REGION: Region = { id: 'all', name: 'Todas', color: '' };

// ============================================================
// Super-categorias: agrupam as 43 categorias em 7 temas claros
// (Lei de Miller: 7±2 chunks cognitivos)
// ============================================================
interface SuperCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  categoryIds: string[];
}

const SUPER_CATEGORIES: SuperCategory[] = [
  {
    id: 'all',
    label: 'Tudo',
    icon: 'apps',
    color: palette.forest[500],
    categoryIds: [],
  },
  {
    id: 'natureza',
    label: 'Natureza',
    icon: 'park',
    color: palette.forest[400],
    categoryIds: [
      'percursos_pedestres', 'aventura_natureza', 'natureza_especializada',
      'fauna_autoctone', 'flora_autoctone', 'flora_botanica',
      'biodiversidade_avistamentos', 'miradouros', 'barragens_albufeiras',
      'cascatas_pocos', 'praias_fluviais', 'arqueologia_geologia',
      'moinhos_azenhas', 'ecovias_passadicos', 'areas_protegidas',
      // legacy
      'percursos', 'cascatas', 'moinhos', 'rios', 'florestas',
      'fauna', 'minerais', 'cogumelos', 'aventura', 'piscinas',
    ],
  },
  {
    id: 'patrimonio',
    label: 'Património',
    icon: 'account-balance',
    color: palette.terracotta[600],
    categoryIds: [
      'castelos', 'palacios_solares', 'museus', 'oficios_artesanato',
      'termas_banhos', 'patrimonio_ferroviario', 'arte_urbana',
      // legacy
      'aldeias', 'religioso', 'arqueologia', 'saberes', 'termas',
      'arte', 'crencas',
    ],
  },
  {
    id: 'gastronomia',
    label: 'Gastronomia',
    icon: 'restaurant',
    color: palette.rust[500],
    categoryIds: [
      'restaurantes_gastronomia', 'tabernas_historicas', 'mercados_feiras',
      'produtores_dop', 'agroturismo_enoturismo', 'pratos_tipicos',
      'docaria_regional',
      // legacy
      'gastronomia', 'tascas', 'produtos',
    ],
  },
  {
    id: 'mar',
    label: 'Mar & Praias',
    icon: 'waves',
    color: palette.ocean[500],
    categoryIds: [
      'surf', 'praias_fluviais_mar', 'praias_bandeira_azul',
    ],
  },
  {
    id: 'cultura',
    label: 'Cultura',
    icon: 'celebration',
    color: '#7C3AED',
    categoryIds: [
      'musica_tradicional', 'festivais_musica', 'festas_romarias',
      // legacy
      'lendas', 'festas', 'comunidade',
    ],
  },
  {
    id: 'experiencias',
    label: 'Experiências',
    icon: 'explore',
    color: palette.terracotta[500],
    categoryIds: [
      'rotas_tematicas', 'grande_expedicao', 'perolas_portugal',
      'alojamentos_rurais', 'parques_campismo', 'pousadas_juventude',
      'agentes_turisticos', 'entidades_operadores', 'guia_viajante',
      'transportes',
      // legacy
      'rotas',
    ],
  },
];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedSuper, setSelectedSuper] = useState('all');
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

  // Filter categories by selected super-category
  const visibleCategories = useMemo(() => {
    if (selectedSuper === 'all') return categoriesWithCounts;
    const superCat = SUPER_CATEGORIES.find(s => s.id === selectedSuper);
    if (!superCat) return categoriesWithCounts;
    const filtered = categoriesWithCounts.filter(c => superCat.categoryIds.includes(c.id));
    // Fallback: if no match (API uses different IDs), show all
    return filtered.length > 0 ? filtered : categoriesWithCounts;
  }, [categoriesWithCounts, selectedSuper]);

  const handleCategoryPress = (category: Category) => {
    setSelectedCategory(category.id);
    setViewMode('items');
  };

  const handleItemPress = (item: HeritageItem) => {
    router.push(`/heritage/${item.id}`);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.length > 2) setViewMode('items');
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedRegion('all');
    setSearchQuery('');
    setViewMode('categories');
  };

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);
  const activeSuperCat = SUPER_CATEGORIES.find(s => s.id === selectedSuper)!;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {Platform.OS === 'web' && (
        <Head>
          <title>Explorar — Portugal Vivo | 43 Categorias de Património</title>
          <meta name="description" content="Explore mais de 6.300 locais únicos em Portugal: castelos, aldeias históricas, cascatas, gastronomia, trilhos, praias e muito mais. 7 regiões, 43 categorias." />
          <meta property="og:title" content="Explorar — Portugal Vivo" />
          <meta property="og:description" content="6.300+ pontos de interesse cultural, natural e gastronómico em Portugal. Filtre por tema e região." />
          <link rel="canonical" href="https://portugal-vivo.app/explorar" />
        </Head>
      )}
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Explorar</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Descubra o melhor de Portugal</Text>
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
            accessibilityLabel="Pesquisar locais e pontos de interesse"
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Limpar pesquisa"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Super-categorias — reduz carga cognitiva de 43 → 7 opções */}
      {viewMode === 'categories' && !searchQuery && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.superCatScroll}
          contentContainerStyle={styles.superCatContent}
          accessibilityLabel="Filtrar por tema"
        >
          {SUPER_CATEGORIES.map(sc => {
            const isActive = selectedSuper === sc.id;
            return (
              <TouchableOpacity
                key={sc.id}
                style={[
                  styles.superChip,
                  { borderColor: isActive ? sc.color : colors.border },
                  isActive && { backgroundColor: sc.color },
                ]}
                onPress={() => setSelectedSuper(sc.id)}
                accessibilityLabel={sc.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <MaterialIcons
                  name={sc.icon as any}
                  size={15}
                  color={isActive ? '#FFFFFF' : sc.color}
                />
                <Text style={[
                  styles.superChipText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary },
                  isActive && { fontWeight: '700' },
                ]}>
                  {sc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Region Filter — visível quando super-cat está seleccionada */}
      {(selectedSuper !== 'all' || viewMode === 'items') && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
          accessibilityLabel="Filtrar por região"
        >
          {regions.map(region => (
            <TouchableOpacity
              key={region.id}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedRegion === region.id && {
                  backgroundColor: withOpacity(activeSuperCat?.color || colors.accent, 0.12),
                  borderColor: activeSuperCat?.color || colors.accent,
                },
              ]}
              onPress={() => setSelectedRegion(region.id)}
              accessibilityLabel={`Região: ${region.name}`}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedRegion === region.id }}
            >
              <Text style={[
                styles.filterChipText,
                { color: colors.textSecondary },
                selectedRegion === region.id && { color: activeSuperCat?.color || colors.accent, fontWeight: '700' },
              ]}>
                {region.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Breadcrumb */}
      {(selectedCategory || searchQuery) && (
        <View style={styles.breadcrumb}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={clearFilters}
            accessibilityLabel="Voltar às categorias"
            accessibilityRole="button"
          >
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

      {/* Contagem visível de categorias */}
      {viewMode === 'categories' && !searchQuery && !categoriesLoading && (
        <View style={styles.countRow}>
          <Text style={[styles.countText, { color: colors.textMuted }]}>
            {visibleCategories.length}{selectedSuper !== 'all' ? ` categorias em ${activeSuperCat?.label}` : ' categorias'}
          </Text>
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
              {visibleCategories.map((category) => (
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
              tintColor={colors.accent}
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
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  headerSubtitle: { fontSize: 14, marginTop: 2 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },
  // Super-categorias
  superCatScroll: { maxHeight: 46, marginBottom: 8 },
  superCatContent: { paddingHorizontal: 20, gap: 8 },
  superChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  superChipText: { fontSize: 13, fontWeight: '500' },
  // Region filter
  filtersScroll: { maxHeight: 40, marginBottom: 8 },
  filtersContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  // Breadcrumb
  breadcrumb: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 10, gap: 12,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 14, fontWeight: '600' },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4,
  },
  selectedBadgeText: { fontSize: 12, fontWeight: '600' },
  // Count label
  countRow: { paddingHorizontal: 20, marginBottom: 6 },
  countText: { fontSize: 12 },
  // Grid
  content: { flex: 1 },
  categoriesGrid: { paddingHorizontal: 20, paddingBottom: 20 },
  gridContainer: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  loader: { marginTop: 40 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, marginTop: 12 },
});
