/**
 * Advanced Search Page
 * Results grouped by type with region chips and counters
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import OptimizedImage from '../src/components/OptimizedImage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { SearchBar } from '../src/components/SearchBar';
import AnimatedListItem from '../src/components/AnimatedListItem';
import SkeletonCard from '../src/components/SkeletonCard';
import EmptyState from '../src/components/EmptyState';

import { API_URL } from '../src/config/api';
const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

interface SearchResult {
  id: string;
  name: string;
  description?: string;
  category: string;
  category_name?: string;
  region?: string;
  average_rating?: number;
  image_url?: string;
  type?: string; // 'poi' | 'route' | 'event' | 'article'
}

const REGIONS = [
  { id: 'norte', name: 'Norte' },
  { id: 'centro', name: 'Centro' },
  { id: 'lisboa', name: 'Lisboa' },
  { id: 'alentejo', name: 'Alentejo' },
  { id: 'algarve', name: 'Algarve' },
  { id: 'acores', name: 'Açores' },
  { id: 'madeira', name: 'Madeira' },
];

const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  poi: { label: 'Pontos de Interesse', icon: 'place' },
  route: { label: 'Rotas', icon: 'route' },
  event: { label: 'Eventos', icon: 'event' },
  article: { label: 'Artigos', icon: 'article' },
};

const search = async (query: string, regions?: string[]) => {
  const res = await fetch(`${API_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, regions, limit: 50 }),
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
};

const getPopularSearches = async () => {
  const res = await fetch(`${API_URL}/api/search/popular`);
  if (!res.ok) throw new Error('Failed');
  return res.json();
};

export default function SearchPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();

  const [searchQuery, setSearchQuery] = useState(params.q || '');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const { data: popularData } = useQuery({
    queryKey: ['popularSearches'],
    queryFn: getPopularSearches,
    enabled: !searchQuery,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['search', searchQuery, selectedRegions],
    queryFn: () => search(searchQuery, selectedRegions.length ? selectedRegions : undefined),
    enabled: searchQuery.length >= 2,
  });

  const toggleRegion = (id: string) => {
    setSelectedRegions(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  if (searchData?.results) {
    for (const item of searchData.results) {
      const type = item.type || 'poi';
      (grouped[type] = grouped[type] || []).push(item);
    }
  }
  const totalResults = searchData?.total || 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} data-testid="search-page">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <SearchBar
            placeholder="Pesquisar património..."
            onSearch={setSearchQuery}
            autoFocus={!params.q}
            initialQuery={searchQuery}
          />
        </View>
      </View>

      {/* Region chips - always visible */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionBar} contentContainerStyle={styles.regionBarContent}>
        {REGIONS.map(r => (
          <TouchableOpacity
            key={r.id}
            style={[styles.regionChip, selectedRegions.includes(r.id) && styles.regionChipActive]}
            onPress={() => toggleRegion(r.id)}
          >
            <Text style={[styles.regionChipText, selectedRegions.includes(r.id) && styles.regionChipTextActive]}>
              {r.name}
            </Text>
          </TouchableOpacity>
        ))}
        {selectedRegions.length > 0 && (
          <TouchableOpacity style={styles.clearChip} onPress={() => setSelectedRegions([])}>
            <MaterialIcons name="close" size={14} color="#C65D3B" />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Results */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {searchLoading ? (
          <View style={{ paddingTop: 16 }}>
            <SkeletonCard variant="heritage" count={4} />
          </View>
        ) : searchQuery.length >= 2 && searchData ? (
          <>
            <Text style={styles.resultsSummary}>
              {totalResults} resultado{totalResults !== 1 ? 's' : ''} para &quot;{searchData.query}&quot;
            </Text>

            {totalResults === 0 ? (
              <EmptyState
                icon="search-off"
                title="Sem resultados"
                subtitle="Tente pesquisar com outros termos ou remova os filtros de região"
                actionLabel={selectedRegions.length > 0 ? "Limpar filtros" : undefined}
                onAction={selectedRegions.length > 0 ? () => setSelectedRegions([]) : undefined}
              />
            ) : (
              Object.entries(grouped).map(([type, items]) => {
                const info = GROUP_LABELS[type] || { label: type, icon: 'folder' };
                return (
                  <View key={type} style={styles.group}>
                    <View style={styles.groupHeader}>
                      <MaterialIcons name={info.icon as any} size={18} color="#C49A6C" />
                      <Text style={styles.groupTitle}>{info.label}</Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countText}>{items.length}</Text>
                      </View>
                    </View>
                    {items.map((item, itemIndex) => (
                      <AnimatedListItem key={item.id} index={itemIndex} stagger={50}>
                      <TouchableOpacity
                        style={styles.resultCard}
                        onPress={() => router.push(`/heritage/${item.id}`)}
                        data-testid={`result-${item.id}`}
                      >
                        {item.image_url ? (
                          <OptimizedImage
                            uri={item.image_url}
                            style={{ width: 64, height: 64, borderRadius: 10, marginRight: 12 }}
                          />
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                          <View style={styles.resultMeta}>
                            <View style={styles.catBadge}>
                              <Text style={styles.catBadgeText}>{item.category_name || item.category}</Text>
                            </View>
                            {item.region && <Text style={styles.regionText}>{item.region}</Text>}
                            {item.average_rating != null && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <MaterialIcons name="star" size={12} color="#C49A6C" />
                                <Text style={styles.ratingText}>{item.average_rating.toFixed(1)}</Text>
                              </View>
                            )}
                          </View>
                          {item.description && (
                            <Text style={styles.resultDesc} numberOfLines={2}>{item.description}</Text>
                          )}
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color="#475569" />
                      </TouchableOpacity>
                      </AnimatedListItem>
                    ))}
                  </View>
                );
              })
            )}
          </>
        ) : (
          /* Empty state: popular searches */
          <>
            <Text style={styles.sectionTitle}>Pesquisas Populares</Text>
            <View style={styles.chipsWrap}>
              {(popularData?.suggested_searches || ['Cascatas', 'Termas', 'Gastronomia', 'Piscinas', 'Lendas']).map((term: string) => (
                <TouchableOpacity key={term} style={styles.popularChip} onPress={() => setSearchQuery(term)}>
                  <MaterialIcons name="trending-up" size={16} color="#C49A6C" />
                  <Text style={styles.popularChipText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2E5E4E' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  backButton: { padding: 6 },
  regionBar: { maxHeight: 44 },
  regionBarContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center', flexDirection: 'row' },
  regionChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#264E41', borderWidth: 1, borderColor: '#2A4A3E',
  },
  regionChipActive: { backgroundColor: '#C49A6C', borderColor: '#C49A6C' },
  regionChipText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  regionChipTextActive: { color: '#1a0f0a', fontWeight: '700' },
  clearChip: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(198,93,59,0.15)', alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  mutedText: { color: '#64748B', fontSize: 14 },
  resultsSummary: { color: '#64748B', fontSize: 13, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  group: { marginBottom: 24 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  groupTitle: { fontSize: 16, fontWeight: '700', color: '#E2E8F0', fontFamily: serif },
  countBadge: { backgroundColor: 'rgba(196,154,108,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 12, color: '#C49A6C', fontWeight: '700' },
  resultCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E3A2F', borderRadius: 12, padding: 14, marginBottom: 8,
  },
  resultName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  catBadge: { backgroundColor: 'rgba(196,154,108,0.15)', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 4 },
  catBadgeText: { fontSize: 11, color: '#C49A6C', textTransform: 'capitalize' },
  regionText: { fontSize: 12, color: '#64748B', textTransform: 'capitalize' },
  ratingText: { fontSize: 12, color: '#C49A6C', fontWeight: '600' },
  resultDesc: { fontSize: 13, color: '#94A3B8', lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#E2E8F0', marginBottom: 12, fontFamily: serif },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  popularChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#264E41',
  },
  popularChipText: { fontSize: 14, color: '#E2E8F0' },
});
