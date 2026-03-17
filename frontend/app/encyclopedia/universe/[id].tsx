/**
 * Universe Detail Page - Encyclopedia
 * Shows articles and items for a specific universe
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import api, {
  getEncyclopediaUniverse,
  EncyclopediaArticle,
} from '../../../src/services/api';
import { HeritageItem } from '../../../src/types';

const { width: _width } = Dimensions.get('window');

const REGIONS = [
  { id: 'todas', name: 'Todas' },
  { id: 'norte', name: 'Norte' },
  { id: 'centro', name: 'Centro' },
  { id: 'lisboa', name: 'Lisboa' },
  { id: 'alentejo', name: 'Alentejo' },
  { id: 'algarve', name: 'Algarve' },
  { id: 'acores', name: 'Açores' },
  { id: 'madeira', name: 'Madeira' },
];

// Subcategory display names map
const SUBCAT_NAMES: Record<string, string> = {
  percursos_pedestres: 'Percursos Pedestres', aventura_natureza: 'Aventura e Natureza',
  natureza_especializada: 'Natureza Especializada', fauna_autoctone: 'Fauna Autóctone',
  flora_autoctone: 'Flora Autóctone', flora_botanica: 'Flora Botânica',
  biodiversidade_avistamentos: 'Biodiversidade', miradouros: 'Miradouros',
  barragens_albufeiras: 'Barragens e Albufeiras', cascatas_pocos: 'Cascatas e Poços',
  praias_fluviais: 'Praias Fluviais', arqueologia_geologia: 'Arqueologia e Geologia',
  moinhos_azenhas: 'Moinhos e Azenhas', ecovias_passadicos: 'Ecovias e Passadiços',
  castelos: 'Castelos', palacios_solares: 'Palácios e Solares', museus: 'Museus',
  oficios_artesanato: 'Ofícios e Artesanato', termas_banhos: 'Termas e Banhos',
  patrimonio_ferroviario: 'Património Ferroviário', arte_urbana: 'Arte Urbana',
  restaurantes_gastronomia: 'Restaurantes', tabernas_historicas: 'Tabernas Históricas',
  mercados_feiras: 'Mercados e Feiras', produtores_dop: 'Produtores DOP',
  agroturismo_enoturismo: 'Agroturismo e Enoturismo', pratos_tipicos: 'Pratos Típicos',
  docaria_regional: 'Doçaria Regional', musica_tradicional: 'Música Tradicional',
  festivais_musica: 'Festivais de Música', festas_romarias: 'Festas e Romarias',
  surf: 'Surf', praias_fluviais_mar: 'Praias Fluviais (Mar)', praias_bandeira_azul: 'Praias Bandeira Azul',
  rotas_tematicas: 'Rotas Temáticas', grande_expedicao: 'Grande Expedição 2026',
  perolas_portugal: 'Pérolas de Portugal', alojamentos_rurais: 'Alojamentos Rurais',
  parques_campismo: 'Parques de Campismo', pousadas_juventude: 'Pousadas de Juventude',
  agentes_turisticos: 'Agentes Turísticos', entidades_operadores: 'Entidades e Operadores',
  guia_viajante: 'Guia do Viajante', transportes: 'Transportes',
};

export default function UniverseDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [selectedRegion, setSelectedRegion] = useState('todas');
  const [selectedSubcategory, setSelectedSubcategory] = useState('todas');
  const [subcatSearch, setSubcatSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingItems, setLoadingItems] = useState(false);

  const { data: universe, isLoading, error } = useQuery({
    queryKey: ['encyclopedia-universe', id],
    queryFn: () => getEncyclopediaUniverse(id!),
    enabled: !!id,
  });

  // Fetch subcategory counts (refreshes when region changes)
  const { data: subcatCounts } = useQuery({
    queryKey: ['subcat-counts', id, selectedRegion],
    queryFn: async () => {
      const params: any = {};
      if (selectedRegion && selectedRegion !== 'todas') params.region = selectedRegion;
      const res = await api.get(`/encyclopedia/universe/${id}/subcategory-counts`, { params });
      return res.data as { total: number; counts: Record<string, number> };
    },
    enabled: !!id,
    staleTime: 300000, // 5 min
  });

  // Filter subcategories by search text
  const filteredCategories = useMemo(() => {
    if (!universe?.categories) return [];
    if (!subcatSearch.trim()) return universe.categories;
    const q = subcatSearch.trim().toLowerCase();
    return universe.categories.filter((cat: string) => {
      const name = (SUBCAT_NAMES[cat] || cat).toLowerCase();
      return name.includes(q);
    });
  }, [universe?.categories, subcatSearch]);

  // Load items when id, region or subcategory changes
  useEffect(() => {
    if (!id) return;
    
    const loadItems = async () => {
      setLoadingItems(true);
      try {
        const params: any = { skip: 0, limit: 100 };
        if (selectedRegion && selectedRegion !== 'todas') {
          params.region = selectedRegion;
        }
        if (selectedSubcategory && selectedSubcategory !== 'todas') {
          params.category = selectedSubcategory;
        }
        const response = await api.get(`/encyclopedia/universe/${id}/items`, { params });
        setItems(response.data?.items || []);
        setTotalItems(response.data?.total || 0);
      } catch (err) {
        console.error('Encyclopedia: Error loading items:', err);
        setItems([]);
        setTotalItems(0);
      } finally {
        setLoadingItems(false);
      }
    };
    
    loadItems();
  }, [id, selectedRegion, selectedSubcategory]);

  const allItems = items;
  const _itemsLoading = loadingItems;

  const _renderArticleCard = (article: EncyclopediaArticle) => (
    <TouchableOpacity
      key={article.id}
      style={styles.articleCard}
      onPress={() => router.push(`/encyclopedia/article/${article.slug || article.id}`)}
      activeOpacity={0.8}
    >
      {article.image_url ? (
        <Image
          source={{ uri: article.image_url }}
          style={styles.articleImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.articleImage, styles.articleImagePlaceholder]}>
          <MaterialIcons name="article" size={32} color="#64748B" />
        </View>
      )}
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={styles.articleSummary} numberOfLines={3}>{article.summary}</Text>
        <View style={styles.articleMeta}>
          <View style={styles.metaItem}>
            <MaterialIcons name="visibility" size={14} color="#64748B" />
            <Text style={styles.metaText}>{article.views}</Text>
          </View>
          {article.tags && article.tags.length > 0 && (
            <View style={styles.tagContainer}>
              <Text style={styles.tagText}>{article.tags[0]}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderItemCard = (item: HeritageItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.itemCard}
      onPress={() => router.push(`/heritage/${item.id}`)}
      activeOpacity={0.8}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.itemThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.itemThumb, styles.itemThumbPlaceholder, { backgroundColor: (universe?.color || '#C49A6C') + '20' }]}>
          <MaterialIcons name="place" size={24} color={universe?.color || '#C49A6C'} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category} • {item.region}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#64748B" />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C49A6C" />
        <Text style={styles.loadingText}>A carregar universo...</Text>
      </View>
    );
  }

  if (error || !universe) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Universo não encontrado</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} data-testid="universe-detail-page">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <LinearGradient
          colors={[universe.color + 'DD', universe.color]}
          style={styles.hero}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <MaterialIcons
            name={universe.icon as any}
            size={56}
            color="#FFFFFF"
          />
          <Text style={styles.heroTitle}>{universe.name}</Text>
          <Text style={styles.heroDescription}>{universe.description}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <MaterialIcons name="place" size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroStatValue}>{universe.total_items}</Text>
              <Text style={styles.heroStatLabel}>locais</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <MaterialIcons name="article" size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroStatValue}>{universe.total_articles}</Text>
              <Text style={styles.heroStatLabel}>artigos</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Region Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.regionFilters}
        >
          {REGIONS.map((region) => (
            <TouchableOpacity
              key={region.id}
              style={[
                styles.regionChip,
                selectedRegion === region.id && { backgroundColor: universe.color },
              ]}
              onPress={() => setSelectedRegion(region.id)}
            >
              <Text
                style={[
                  styles.regionChipText,
                  selectedRegion === region.id && styles.regionChipTextActive,
                ]}
              >
                {region.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Subcategory Filter with search + counters */}
        {universe?.categories && universe.categories.length > 1 && (
          <View>
            {/* Quick search for subcategories */}
            {universe.categories.length > 6 && (
              <View style={styles.subcatSearchContainer}>
                <MaterialIcons name="search" size={18} color="#64748B" />
                <TextInput
                  style={styles.subcatSearchInput}
                  placeholder="Filtrar subcategorias..."
                  placeholderTextColor="#64748B"
                  value={subcatSearch}
                  onChangeText={setSubcatSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {subcatSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setSubcatSearch('')}>
                    <MaterialIcons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
            >
              <TouchableOpacity
                style={[
                  styles.regionChip,
                  selectedSubcategory === 'todas' && { backgroundColor: universe.color },
                ]}
                onPress={() => setSelectedSubcategory('todas')}
                data-testid="subcat-todas"
              >
                <Text style={[
                  styles.regionChipText,
                  selectedSubcategory === 'todas' && styles.regionChipTextActive,
                ]}>
                  Todas{subcatCounts ? ` (${subcatCounts.total})` : ''}
                </Text>
              </TouchableOpacity>
              {filteredCategories.map((cat: string) => {
                const isComingSoon = ['alojamentos_rurais', 'agentes_turisticos', 'entidades_operadores'].includes(cat);
                const count = subcatCounts?.counts?.[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.regionChip,
                      selectedSubcategory === cat && { backgroundColor: universe.color },
                      isComingSoon && { opacity: 0.5 },
                    ]}
                    onPress={() => {
                      if (isComingSoon) {
                        Alert.alert(
                          'Brevemente disponível',
                          `${SUBCAT_NAMES[cat] || cat} estará disponível na fase de parcerias. Fique atento!`,
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                      setSelectedSubcategory(cat);
                    }}
                    data-testid={`subcat-${cat}`}
                  >
                    <Text style={[
                      styles.regionChipText,
                      selectedSubcategory === cat && styles.regionChipTextActive,
                      isComingSoon && { fontStyle: 'italic' },
                    ]} numberOfLines={1}>
                      {SUBCAT_NAMES[cat] || cat}{isComingSoon ? ' (em breve)' : count !== undefined ? ` (${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Results info */}
          <View style={styles.resultsInfo}>
            <Text style={styles.resultsText}>
              A mostrar {allItems.length} de {totalItems || universe?.total_items || 0} locais
            </Text>
            {loadingItems && <ActivityIndicator size="small" color={universe.color} />}
          </View>

          {allItems.length > 0 ? (
            <View style={styles.itemsList}>
              {allItems.map(renderItemCard)}
            </View>
          ) : loadingItems ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={universe.color} />
              <Text style={styles.loadingStateText}>A carregar locais...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={48} color="#64748B" />
              <Text style={styles.emptyText}>Sem resultados</Text>
              <Text style={styles.emptySubtext}>
                Não foram encontrados locais para esta região
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E5E4E',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
  },
  backBtn: {
    backgroundColor: '#264E41',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  hero: {
    padding: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 300,
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  heroStat: {
    alignItems: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 6,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#264E41',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#C49A6C',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  articlesGrid: {
    gap: 12,
  },
  articleCard: {
    flexDirection: 'row',
    backgroundColor: '#264E41',
    borderRadius: 12,
    overflow: 'hidden',
  },
  articleImage: {
    width: 120,
    height: 120,
  },
  articleImagePlaceholder: {
    backgroundColor: '#2A2F2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  articleContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  articleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  articleSummary: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    flex: 1,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  tagContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    color: '#C49A6C',
    fontWeight: '500',
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  itemThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemCategory: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  categoriesRow: {
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  subcatSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  subcatSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FAF8F3',
    padding: 0,
  },
  regionFilters: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  regionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#264E41',
    marginRight: 8,
  },
  regionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  regionChipTextActive: {
    color: '#FFFFFF',
  },
  resultsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 6,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingStateText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
