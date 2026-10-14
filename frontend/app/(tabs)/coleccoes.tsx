/**
 * Enciclopédia Viva - Main page with Universe cards
 * Matches the dark green background mockup with vibrant colored cards
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { palette } from '../../src/theme/colors';
import { useTheme } from '../../src/context/ThemeContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { CONTENT_MAX_WIDTH_WIDE } from '../../src/theme/breakpoints';
import { HIT_SLOP } from '../../src/theme/spacing';
import api from '../../src/services/api';

const CARD_GAP = 12;
const REGIONS = ['Norte', 'Centro', 'Lisboa', 'Alentejo', 'Algarve'];

export default function ColeccoesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { contentMaxWidthWide, columns } = useResponsive();
  // Grid adaptativa: 2 colunas no telemóvel, mais em tablet/web (mobile-first).
  const numColumns = columns(160, CARD_GAP, 4);
  const cardWidth = (contentMaxWidthWide - 20 * 2 - CARD_GAP * (numColumns - 1)) / numColumns;
  const [selectedUniverse, setSelectedUniverse] = useState<any>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);

  const { data: universes, isLoading } = useQuery({
    queryKey: ['encyclopedia-universes'],
    queryFn: async () => { const res = await api.get('/encyclopedia/universes'); return res.data; },
  });

  const { data: universeDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['encyclopedia-universe', selectedUniverse?.id],
    queryFn: async () => { const res = await api.get(`/encyclopedia/universe/${selectedUniverse.id}`); return res.data; },
    enabled: !!selectedUniverse,
  });

  const { data: browseData, isLoading: browseLoading } = useQuery({
    queryKey: ['collection-browse-items', selectedUniverse?.id, selectedRegion],
    queryFn: async () => {
      const cats = selectedUniverse.categories.join(',');
      let url = `/map/items?categories=${cats}&limit=2000`;
      if (selectedRegion) url += `&region=${selectedRegion}`;
      const res = await api.get(url);
      return res.data;
    },
    enabled: !!selectedUniverse,
  });

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    try {
      const res = await api.get(`/collections/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data);
    } catch { }
  };

  const items = browseData?.items || universeDetail?.items || [];

  // =====================
  // UNIVERSE DETAIL VIEW
  // =====================
  if (selectedUniverse) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Detail Header */}
          <LinearGradient colors={[selectedUniverse.color, selectedUniverse.color + 'CC']} style={styles.detailHeader}>
            <TouchableOpacity
              onPress={() => setSelectedUniverse(null)}
              style={styles.backBtn}
              hitSlop={HIT_SLOP}
              data-testid="back-from-universe"
              accessibilityLabel={t('coreTabs.collections.backToUniverses')}
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.detailHeaderContent}>
              <MaterialIcons name={selectedUniverse.icon} size={36} color="rgba(255,255,255,0.9)" />
              <Text style={styles.detailTitle}>{selectedUniverse.name}</Text>
              <Text style={styles.detailDescription}>{selectedUniverse.seo_description || selectedUniverse.description}</Text>
              <View style={styles.detailStats}>
                <View style={styles.detailStat}>
                  <MaterialIcons name="place" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.detailStatText}>{t('coreTabs.units.places', { count: selectedUniverse.item_count })}</Text>
                </View>
                <View style={styles.detailStat}>
                  <MaterialIcons name="article" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.detailStatText}>{t('coreTabs.units.articles', { count: selectedUniverse.article_count })}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Region Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionFilters} contentContainerStyle={styles.regionFiltersContent}>
            <TouchableOpacity
              style={[styles.regionChip, { backgroundColor: !selectedRegion ? colors.accent : colors.surfaceAlt }]}
              onPress={() => setSelectedRegion(null)}
              accessibilityLabel={t('coreTabs.collections.filterAllRegions')}
              accessibilityRole="tab"
              accessibilityState={{ selected: !selectedRegion }}
            >
              <Text style={[styles.regionChipText, { color: !selectedRegion ? '#FFF' : colors.textSecondary }]}>{t('common.all')}</Text>
            </TouchableOpacity>
            {REGIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.regionChip, { backgroundColor: selectedRegion === r ? colors.accent : colors.surfaceAlt }]}
                onPress={() => setSelectedRegion(selectedRegion === r ? null : r)}
                accessibilityLabel={t('coreTabs.collections.filterByRegion', { region: r })}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedRegion === r }}
              >
                <Text style={[styles.regionChipText, { color: selectedRegion === r ? '#FFF' : colors.textSecondary }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Items List */}
          {(browseLoading || detailLoading) ? (
            <ActivityIndicator size="large" color={selectedUniverse.color} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.itemsList}>
              {items.slice(0, 50).map((item: any, idx: number) => (
                <TouchableOpacity
                  key={item.id || idx}
                  style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                  onPress={() => item.id && router.push(`/heritage/${item.id}`)}
                  activeOpacity={0.8}
                  data-testid={`item-${idx}`}
                  accessibilityLabel={t('coreTabs.shared.view', { name: item.name })}
                  accessibilityRole="button"
                >
                  <View style={styles.itemHeader}>
                    <View style={[styles.itemIcon, { backgroundColor: selectedUniverse.color + '18' }]}>
                      <MaterialIcons name={selectedUniverse.icon} size={18} color={selectedUniverse.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.itemMetaRow}>
                        {item.region && (
                          <View style={[styles.itemRegionTag, { backgroundColor: selectedUniverse.color + '15' }]}>
                            <Text style={[styles.itemRegionText, { color: selectedUniverse.color }]}>{item.region}</Text>
                          </View>
                        )}
                        {item.category && <Text style={[styles.itemCategory, { color: colors.textMuted }]}>{item.category}</Text>}
                      </View>
                    </View>
                    {item.iq_score && (
                      <View style={[styles.iqBadge, { backgroundColor: selectedUniverse.color + '15' }]}>
                        <Text style={[styles.iqScore, { color: selectedUniverse.color }]}>{Math.round(item.iq_score)}</Text>
                      </View>
                    )}
                  </View>
                  {item.description && <Text style={[styles.itemDesc, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>}
                </TouchableOpacity>
              ))}
              {items.length === 0 && !browseLoading && (
                <View style={styles.emptyState}>
                  <MaterialIcons name="search-off" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('coreTabs.collections.noResults')}</Text>
                </View>
              )}
              <Text style={[styles.showingCount, { color: colors.textMuted }]}>
                {t('coreTabs.collections.showing', { shown: Math.min(items.length, 50), total: selectedUniverse.item_count })}
              </Text>
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    );
  }

  // =====================
  // MAIN OVERVIEW VIEW (Mockup Design)
  // =====================
  return (
    <View style={[styles.container, { backgroundColor: palette.forest[500], paddingTop: insets.top }]} data-testid="encyclopedia-page">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.mainHeader}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.mainBackBtn}
            hitSlop={HIT_SLOP}
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.mainTitle}>{t('coreTabs.collections.title')}</Text>
          <Text style={styles.mainSubtitle}>{t('coreTabs.collections.subtitle')}</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('coreTabs.collections.searchPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={(text) => { setSearchQuery(text); if (text.length < 2) setSearchResults(null); }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            data-testid="encyclopedia-search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(''); setSearchResults(null); }}
              accessibilityLabel={t('coreTabs.shared.clearSearch')}
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        {searchResults && (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.searchResultsTitle}>{t('coreTabs.collections.resultsFor', { count: searchResults.total, query: searchQuery })}</Text>
            {searchResults.results?.map((group: any) => (
              <View key={group.id} style={styles.searchGroup}>
                <View style={styles.searchGroupHeader}>
                  <View style={[styles.searchGroupDot, { backgroundColor: group.color }]} />
                  <Text style={styles.searchGroupName}>{group.label} ({group.items?.length || 0})</Text>
                </View>
                {group.items?.slice(0, 5).map((item: any, idx: number) => (
                  <View key={item.id || idx} style={styles.searchItem}>
                    <Text style={styles.searchItemName}>{item.name}</Text>
                    <Text style={styles.searchItemMeta}>{item.region || item.concelho}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Section Title */}
        {!searchResults && (
          <View style={styles.sectionTitleRow}>
            <MaterialIcons name="auto-awesome" size={20} color="#8E24AA" />
            <Text style={styles.sectionTitle}>{t('coreTabs.collections.universes')}</Text>
          </View>
        )}

        {/* Universe Cards Grid */}
        {!searchResults && (
          isLoading ? (
            <ActivityIndicator size="large" color={palette.terracotta[500]} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.cardsGrid}>
              {(universes || []).map((universe: any) => (
                <TouchableOpacity
                  key={universe.id}
                  style={[styles.universeCard, { backgroundColor: universe.color, width: cardWidth }]}
                  onPress={() => router.push(`/encyclopedia/universe/${universe.id}`)}
                  activeOpacity={0.85}
                  data-testid={`universe-${universe.id}`}
                  accessibilityLabel={t('coreTabs.shared.openUniverse', { name: universe.name })}
                  accessibilityRole="button"
                >
                  <MaterialIcons name={universe.icon} size={32} color="rgba(255,255,255,0.9)" style={styles.cardIcon} />
                  <Text style={styles.cardTitle} numberOfLines={2}>{universe.name}</Text>
                  <Text style={styles.cardDescription} numberOfLines={3}>{universe.seo_description || universe.description}</Text>
                  <View style={styles.cardStats}>
                    <View style={styles.cardStat}>
                      <MaterialIcons name="article" size={14} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.cardStatText}>{universe.article_count}</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <MaterialIcons name="place" size={14} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.cardStatText}>{universe.item_count}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Main Header (dark green page)
  mainHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  mainBackBtn: { width: 40, height: 40, justifyContent: 'center' },
  mainTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  mainSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginTop: 16, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF' },

  // Search Results
  searchResultsContainer: { paddingHorizontal: 20, marginBottom: 16 },
  searchResultsTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  searchGroup: { marginBottom: 12 },
  searchGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  searchGroupDot: { width: 10, height: 10, borderRadius: 5 },
  searchGroupName: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  searchItem: { paddingLeft: 18, paddingVertical: 4 },
  searchItemName: { fontSize: 13, color: '#FFF' },
  searchItemMeta: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

  // Section Title
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  // Cards Grid
  cardsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: CARD_GAP,
    alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH_WIDE,
  },
  universeCard: {
    borderRadius: 20, padding: 18,
    minHeight: 200, justifyContent: 'space-between',
  },
  cardIcon: { marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', lineHeight: 21, marginBottom: 6 },
  cardDescription: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 17, marginBottom: 12 },
  cardStats: { flexDirection: 'row', gap: 16 },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

  // Detail Header
  detailHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  detailHeaderContent: { gap: 8, marginTop: 4 },
  detailTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  detailDescription: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  detailStats: { flexDirection: 'row', gap: 20, marginTop: 8 },
  detailStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailStatText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  // Region Filters
  regionFilters: { marginTop: 16, marginBottom: 8 },
  regionFiltersContent: { paddingHorizontal: 20, gap: 8 },
  regionChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  regionChipText: { fontSize: 13, fontWeight: '600' },

  // Items
  itemsList: { paddingHorizontal: 20, gap: 8, marginTop: 8 },
  itemCard: { borderRadius: 16, padding: 14, borderWidth: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  itemRegionTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  itemRegionText: { fontSize: 10, fontWeight: '600' },
  itemCategory: { fontSize: 10, textTransform: 'capitalize' },
  itemDesc: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  iqBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iqScore: { fontSize: 13, fontWeight: '800' },
  showingCount: { textAlign: 'center', fontSize: 12, marginTop: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 15 },
});
