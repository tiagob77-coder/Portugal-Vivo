/**
 * Enciclopédia Viva - Page
 * Deep knowledge base interconnected with geolocations
 * Based on Strategic Report Section 6
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getEncyclopediaUniverses,
  getEncyclopediaFeatured,
  searchEncyclopedia,
  EncyclopediaUniverse,
  EncyclopediaArticle,
} from '../../src/services/api';

const { width } = Dimensions.get('window');

export default function EncyclopediaPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { data: universes, isLoading: universesLoading } = useQuery({
    queryKey: ['encyclopedia-universes'],
    queryFn: getEncyclopediaUniverses,
  });

  const { data: featured, isLoading: featuredLoading } = useQuery({
    queryKey: ['encyclopedia-featured'],
    queryFn: getEncyclopediaFeatured,
  });

  const { data: searchResults, isLoading: searchLoading, refetch: searchRefetch } = useQuery({
    queryKey: ['encyclopedia-search', searchQuery],
    queryFn: () => searchEncyclopedia(searchQuery, 20),
    enabled: searchQuery.length > 2,
  });

  const handleSearch = () => {
    if (searchQuery.length > 2) {
      setIsSearching(true);
      searchRefetch();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  const renderUniverseCard = (universe: EncyclopediaUniverse) => (
    <TouchableOpacity
      key={universe.id}
      style={styles.universeCard}
      onPress={() => router.push(`/encyclopedia/universe/${universe.id}`)}
      activeOpacity={0.8}
      data-testid={`universe-${universe.id}`}
    >
      <LinearGradient
        colors={[universe.color + 'CC', universe.color]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.universeGradient}
      >
        <MaterialIcons
          name={universe.icon as any}
          size={32}
          color="#FFFFFF"
        />
        <Text style={styles.universeName}>{universe.name}</Text>
        <Text style={styles.universeDescription} numberOfLines={2}>
          {universe.description}
        </Text>
        <View style={styles.universeStats}>
          <View style={styles.universeStat}>
            <MaterialIcons name="article" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.universeStatText}>{universe.article_count}</Text>
          </View>
          <View style={styles.universeStat}>
            <MaterialIcons name="place" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.universeStatText}>{universe.item_count}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderArticleCard = (article: EncyclopediaArticle, size: 'small' | 'large' = 'small') => (
    <TouchableOpacity
      key={article.id}
      style={[styles.articleCard, size === 'large' && styles.articleCardLarge]}
      onPress={() => router.push(`/encyclopedia/article/${article.slug || article.id}` as any)}
      activeOpacity={0.8}
    >
      {article.image_url ? (
        <Image
          source={{ uri: article.image_url }}
          style={[styles.articleImage, size === 'large' && styles.articleImageLarge]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.articleImagePlaceholder, size === 'large' && styles.articleImageLarge]}>
          <MaterialIcons name="article" size={24} color="#64748B" />
        </View>
      )}
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={styles.articleSummary} numberOfLines={2}>{article.summary}</Text>
        <View style={styles.articleMeta}>
          <MaterialIcons name="visibility" size={12} color="#64748B" />
          <Text style={styles.articleMetaText}>{article.views} visualizações</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const isLoading = universesLoading || featuredLoading;

  if (isLoading && !universes) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C49A6C" />
        <Text style={styles.loadingText}>A carregar enciclopédia...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} data-testid="encyclopedia-page">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Enciclopédia Viva</Text>
            <Text style={styles.headerSubtitle}>Conhecimento profundo sobre Portugal</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={22} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar artigos, locais..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <MaterialIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results */}
        {isSearching && searchQuery.length > 2 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="search" size={20} color="#C49A6C" />
              <Text style={styles.sectionTitle}>Resultados para &quot;{searchQuery}&quot;</Text>
            </View>
            {searchLoading ? (
              <ActivityIndicator size="small" color="#C49A6C" style={{ padding: 20 }} />
            ) : searchResults?.total === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="search-off" size={48} color="#64748B" />
                <Text style={styles.emptyText}>Sem resultados encontrados</Text>
              </View>
            ) : (
              <View style={styles.searchResults}>
                {searchResults?.articles.map(article => renderArticleCard(article, 'small'))}
                {searchResults?.items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemCard}
                    onPress={() => router.push(`/heritage/${item.id}`)}
                  >
                    <View style={styles.itemIcon}>
                      <MaterialIcons name="place" size={20} color="#C49A6C" />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.itemCategory}>{item.category} • {item.region}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#64748B" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Universes Grid */}
        {!isSearching && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="auto-awesome" size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Universos do Conhecimento</Text>
              </View>
              <View style={styles.universesGrid}>
                {universes?.map(renderUniverseCard)}
              </View>
            </View>

            {/* Featured Articles */}
            {featured?.top_articles && featured.top_articles.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="star" size={20} color="#C49A6C" />
                  <Text style={styles.sectionTitle}>Artigos em Destaque</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.articlesRow}
                >
                  {featured.top_articles.map(article => renderArticleCard(article, 'large'))}
                </ScrollView>
              </View>
            )}

            {/* Universe Highlights */}
            {featured?.universe_highlights && featured.universe_highlights.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="explore" size={20} color="#22C55E" />
                  <Text style={styles.sectionTitle}>Explorar por Tema</Text>
                </View>
                {featured.universe_highlights.map(({ universe, featured_article }) => (
                  <TouchableOpacity
                    key={universe.id}
                    style={styles.highlightCard}
                    onPress={() => router.push(`/encyclopedia/universe/${universe.id}`)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.highlightIcon, { backgroundColor: universe.color + '20' }]}>
                      <MaterialIcons
                        name={universe.icon as any}
                        size={24}
                        color={universe.color}
                      />
                    </View>
                    <View style={styles.highlightInfo}>
                      <Text style={styles.highlightTitle}>{universe.name}</Text>
                      {featured_article && (
                        <Text style={styles.highlightArticle} numberOfLines={1}>
                          Em destaque: {featured_article.title}
                        </Text>
                      )}
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#64748B" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Quick Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{universes?.length || 6}</Text>
                <Text style={styles.statLabel}>Universos</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {universes?.reduce((sum, u) => sum + u.item_count, 0) || 0}
                </Text>
                <Text style={styles.statLabel}>Locais</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {universes?.reduce((sum, u) => sum + u.article_count, 0) || 0}
                </Text>
                <Text style={styles.statLabel}>Artigos</Text>
              </View>
            </View>
          </>
        )}

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#264E41',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  universesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  universeCard: {
    width: (width - 48) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  universeGradient: {
    padding: 16,
    minHeight: 140,
  },
  universeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  universeDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  universeStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  universeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  universeStatText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  articlesRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  articleCard: {
    width: 160,
    backgroundColor: '#264E41',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 8,
  },
  articleCardLarge: {
    width: 220,
  },
  articleImage: {
    width: '100%',
    height: 90,
  },
  articleImageLarge: {
    height: 120,
  },
  articleImagePlaceholder: {
    width: '100%',
    height: 90,
    backgroundColor: '#2A2F2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  articleContent: {
    padding: 12,
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  articleSummary: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  articleMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  searchResults: {
    paddingHorizontal: 20,
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemCategory: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  highlightIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightInfo: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  highlightArticle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    marginHorizontal: 20,
    backgroundColor: '#264E41',
    borderRadius: 12,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#C49A6C',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2A2F2A',
    marginVertical: 4,
  },
});
