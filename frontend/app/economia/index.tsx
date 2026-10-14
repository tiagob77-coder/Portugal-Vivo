/**
 * Economia Local — markets, artisans, and regional products explorer
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import EconomyMarketCard from '../../src/components/EconomyMarketCard';
import { getModuleTheme, withOpacity, onColor } from '../../src/theme/colors';
import { API_BASE } from '../../src/config/api';
import ModuleHighlights from '../../src/components/module/ModuleHighlights';
import ModuleGuideCta from '../../src/components/module/ModuleGuideCta';
import ModuleHistory from '../../src/components/module/ModuleHistory';
import ModuleLinks from '../../src/components/module/ModuleLinks';

// ─── Colors (from centralized theme) ─────────────────────────────────────────

const MT = getModuleTheme('economia');
const C = {
  bg: MT.bg,
  card: MT.card,
  market: MT.accent,
  // Deriva do accent do módulo para acompanhar o tema escuro
  marketLight: MT.accentMuted,
  artisan: '#7C3AED',
  artisanLight: '#EDE9FE',
  fish: '#0369A1',
  fishLight: '#E0F2FE',
  dop: '#059669',
  dopLight: '#D1FAE5',
  textDark: MT.textPrimary,
  textMed: MT.textSecondary,
  textLight: MT.textMuted,
  border: withOpacity(MT.textPrimary, 0.12),
  // Texto sobre o accent — o accent é claro, logo pede texto escuro
  onMarket: onColor(MT.accent),
  accent: '#C2410C',
};

// ─── Static Data ──────────────────────────────────────────────────────────────

const ECONOMY_DATA = {
  mercados: [
    { id: 'mercado-bolhao', name: 'Mercado do Bolhão', city: 'Porto', region: 'Norte',
      lat: 41.149, lng: -8.608, type: 'mercado_municipal',
      schedule: 'Seg-Sáb 8h-20h', products: ['Peixe fresco', 'Hortícolas', 'Flores', 'Queijos'],
      description: 'Mercado histórico de ferro forjado (1850), ícone gastronómico do Porto.',
      tags: ['DOP', 'Fresco', 'Tradicional'], rating: 4.8 },
    { id: 'mercado-ribeira', name: 'Mercado da Ribeira', city: 'Lisboa', region: 'Lisboa',
      lat: 38.706, lng: -9.147, type: 'mercado_municipal',
      schedule: 'Diário 10h-00h', products: ['Tascas premium', 'Artesanato', 'Vinhos'],
      description: 'Espaço gastronómico modernizado com produtores locais e chefs portugueses.',
      tags: ['Gourmet', 'Premium', 'Turismo'], rating: 4.5 },
    { id: 'mercado-livramento', name: 'Mercado do Livramento', city: 'Setúbal', region: 'Lisboa',
      lat: 38.524, lng: -8.892, type: 'mercado_municipal',
      schedule: 'Seg-Sáb 7h-14h', products: ['Peixe', 'Marisco', 'Fruta', 'Legumes'],
      description: 'Um dos maiores mercados de peixe da Península Ibérica, com azulejos únicos.',
      tags: ['Peixe', 'Marisco', 'Arrábida'], rating: 4.9 },
    { id: 'feira-barcelos', name: 'Feira de Barcelos', city: 'Barcelos', region: 'Norte',
      lat: 41.538, lng: -8.618, type: 'feira',
      schedule: 'Quintas-feiras', products: ['Artesanato', 'Galo', 'Cerâmica', 'Têxteis'],
      description: 'A maior feira semanal da Península Ibérica, berço do Galo de Barcelos.',
      tags: ['Artesanato', 'Imaterial', 'Tradição'], rating: 4.7 },
    { id: 'mercado-olhao', name: 'Mercado de Olhão', city: 'Olhão', region: 'Algarve',
      lat: 37.028, lng: -7.840, type: 'mercado_municipal',
      schedule: 'Seg-Sáb 7h-13h', products: ['Atum', 'Polvo', 'Marisco', 'Algas'],
      description: 'Dois pavilhões mouriscos (1912) com o melhor peixe do Algarve.',
      tags: ['Peixe', 'Mouriscos', 'Barlavento'], rating: 4.8 },
  ],
  artesaos: [
    { id: 'rendas-viana', name: 'Rendas de Viana', city: 'Viana do Castelo', region: 'Norte',
      craft: 'Rendas e bordados', materials: ['Linho', 'Algodão'],
      story: 'Tradição de 400 anos de bordados a ponto de caseado, usados no traje minhoto.',
      tags: ['Imaterial UNESCO', 'Tradicional'] },
    { id: 'ceramica-alentejo', name: 'Olaria Alentejana', city: 'Redondo', region: 'Alentejo',
      craft: 'Cerâmica pintada', materials: ['Barro', 'Pigmentos naturais'],
      story: 'Louça de barro com motivos geométricos da tradição árabe-portuguesa.',
      tags: ['DOP', 'Artesanato'] },
    { id: 'cestaria-douro', name: 'Cestaria do Douro', city: 'Peso da Régua', region: 'Norte',
      craft: 'Cestaria em vime', materials: ['Vime', 'Castanheiro'],
      story: 'Cestos tradicionais usados nas vindimas do Douro há séculos.',
      tags: ['Tradição', 'Duriense'] },
  ],
  produtos: [
    { id: 'bacalhau', name: 'Bacalhau', category: 'peixe', season: [1,2,3,10,11,12],
      origin: 'Costa Norte Atlântico', dop: false,
      story: 'O "fiel amigo" — Portugal consume 20% do bacalhau mundial.' },
    { id: 'vinho-verde', name: 'Vinho Verde', category: 'bebida', season: [6,7,8,9],
      origin: 'Minho', dop: true,
      story: 'DOC mais extensa de Portugal, vinhos frescos e aromáticos.' },
    { id: 'pastel-belem', name: 'Pastel de Belém', category: 'panificacao', season: [1,2,3,4,5,6,7,8,9,10,11,12],
      origin: 'Lisboa', dop: false,
      story: 'Receita secreta desde 1837, produzida apenas na Fábrica de Belém.' },
    { id: 'sal-setubal', name: 'Sal de Setúbal', category: 'condimento', season: [6,7,8,9],
      origin: 'Estuário do Sado', dop: true,
      story: 'Colhido à mão nas salinas do Sado por tradição milenar.' },
    { id: 'queijo-serra', name: 'Queijo Serra da Estrela', category: 'laticinios', season: [11,12,1,2,3],
      origin: 'Serra da Estrela', dop: true,
      story: 'DOP desde 1996, produzido com leite de ovelha Bordaleira.' },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'mercados' | 'artesaos' | 'produtos';

interface Tab {
  key: TabKey;
  labelKey: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
}

const TABS: Tab[] = [
  { key: 'mercados', labelKey: 'modulesCulture.economia.tabs.mercados',  icon: 'storefront',   color: C.market  },
  { key: 'artesaos', labelKey: 'modulesCulture.economia.tabs.artesaos',  icon: 'palette',      color: C.artisan },
  { key: 'produtos', labelKey: 'modulesCulture.economia.tabs.produtos',  icon: 'local-grocery-store', color: C.dop },
];

// Translated at render: modulesCulture.shared.monthsShort.<key>
const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EconomiaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<TabKey>('mercados');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<number | null>(null);
  // Bound the initial render — these lists can hold ~100 cards inside a plain
  // ScrollView (no virtualization). Reset the window when the tab changes.
  const PAGE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  useEffect(() => setVisibleCount(PAGE), [activeTab, seasonFilter]);

  const currentMonth = new Date().getMonth() + 1;

  const { data: marketsData, isLoading: loadingMarkets } = useQuery({
    queryKey: ['economy-markets'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/economy/markets?limit=100`);
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: artisansData, isLoading: loadingArtisans } = useQuery({
    queryKey: ['economy-artisans'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/economy/artisans?limit=100`);
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['economy-products'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/economy/products?limit=100`);
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const mercados = marketsData?.results ?? ECONOMY_DATA.mercados;
  const artesaos = artisansData?.results ?? ECONOMY_DATA.artesaos;
  const produtos = productsData?.results ?? ECONOMY_DATA.produtos;
  const isLoading = loadingMarkets || loadingArtisans || loadingProducts;

  // Initialise season filter to current month when switching to Produtos tab
  const handleTabPress = (key: TabKey) => {
    setActiveTab(key);
    setExpandedId(null);
    if (key === 'produtos' && seasonFilter === null) {
      setSeasonFilter(currentMonth);
    }
  };

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filtered produtos based on season chip selection
  const filteredProdutos = seasonFilter
    ? produtos.filter((p: any) => p.season?.includes(seasonFilter))
    : produtos;

  const activeTabConf = TABS.find((tab) => tab.key === activeTab)!;
  const activeList =
    activeTab === 'mercados' ? mercados : activeTab === 'artesaos' ? artesaos : filteredProdutos;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back" size={22} color={C.market} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{t('modulesCulture.economia.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('modulesCulture.economia.subtitle')}</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="storefront" size={20} color={C.market} />
          </View>
        </View>
        <ModuleGuideCta module="economia" />


        {/* ── Tab Selector ───────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabChip,
                  isActive && { backgroundColor: tab.color, borderColor: tab.color },
                ]}
                onPress={() => handleTabPress(tab.key)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={15}
                  color={isActive ? C.onMarket : C.textMed}
                />
                <Text
                  style={[
                    styles.tabChipLabel,
                    isActive && styles.tabChipLabelActive,
                  ]}
                >
                  {t(tab.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Season Filter (Produtos only) ──────────────────────────────── */}
        {activeTab === 'produtos' && (
          <View style={styles.seasonSection}>
            <View style={styles.seasonHeader}>
              <MaterialIcons name="calendar-today" size={13} color={C.textLight} />
              <Text style={styles.seasonHeaderText}>{t('modulesCulture.economia.filterBySeason')}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.seasonChipsContent}
            >
              <TouchableOpacity
                style={[
                  styles.seasonChip,
                  seasonFilter === null && styles.seasonChipActive,
                ]}
                onPress={() => setSeasonFilter(null)}
              >
                <Text
                  style={[
                    styles.seasonChipText,
                    seasonFilter === null && styles.seasonChipTextActive,
                  ]}
                >
                  {t('modulesCulture.shared.all')}
                </Text>
              </TouchableOpacity>
              {MONTH_KEYS.map((monthKey, idx) => {
                const month = idx + 1;
                const isActive = seasonFilter === month;
                const isCurrent = month === currentMonth;
                return (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.seasonChip,
                      isActive && styles.seasonChipActive,
                      isCurrent && styles.seasonChipCurrent,
                    ]}
                    onPress={() => setSeasonFilter(isActive ? null : month)}
                  >
                    <Text
                      style={[
                        styles.seasonChipText,
                        isActive && styles.seasonChipTextActive,
                        isCurrent && !isActive && styles.seasonChipTextCurrent,
                      ]}
                    >
                      {t(`modulesCulture.shared.monthsShort.${monthKey}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Summary Row ────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, { backgroundColor: activeTabConf.color }]} />
          <Text style={styles.summaryText}>
            {activeTab === 'mercados' && t('modulesCulture.economia.marketsCount', { count: ECONOMY_DATA.mercados.length })}
            {activeTab === 'artesaos' && t('modulesCulture.economia.artisansCount', { count: ECONOMY_DATA.artesaos.length })}
            {activeTab === 'produtos' && (filteredProdutos.length === 1
              ? t('modulesCulture.economia.oneProductFound', { count: filteredProdutos.length })
              : t('modulesCulture.economia.productsFound', { count: filteredProdutos.length }))}
          </Text>
        </View>

        {/* ── Content List ───────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {isLoading && (
            <ActivityIndicator size="large" color={C.market} style={{ marginVertical: 32 }} />
          )}

          {/* Mercados */}
          {!isLoading && activeTab === 'mercados' &&
            mercados.slice(0, visibleCount).map((item: any) => (
              <EconomyMarketCard
                key={item.id}
                item={item}
                variant="market"
                expanded={expandedId === item.id}
                onPress={() => handleCardPress(item.id)}
              />
            ))}

          {/* Artesãos */}
          {!isLoading && activeTab === 'artesaos' &&
            artesaos.slice(0, visibleCount).map((item: any) => (
              <EconomyMarketCard
                key={item.id}
                item={item}
                variant="artisan"
                expanded={expandedId === item.id}
                onPress={() => handleCardPress(item.id)}
              />
            ))}

          {/* Produtos */}
          {!isLoading && activeTab === 'produtos' &&
            filteredProdutos.slice(0, visibleCount).map((item: any) => (
              <EconomyMarketCard
                key={item.id}
                item={item}
                variant="product"
                expanded={expandedId === item.id}
                onPress={() => handleCardPress(item.id)}
              />
            ))}

          {/* Empty state for season filter */}
          {activeTab === 'produtos' && filteredProdutos.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={36} color={C.textLight} />
              <Text style={styles.emptyStateTitle}>{t('modulesCulture.economia.emptyTitle')}</Text>
              <Text style={styles.emptyStateText}>
                {t('modulesCulture.economia.emptyText')}
              </Text>
            </View>
          )}

          {!isLoading && activeList.length > visibleCount && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => setVisibleCount((v) => v + PAGE)}
              accessibilityRole="button"
              accessibilityLabel={t('modulesCulture.economia.seeMoreA11y')}
            >
              <Text style={styles.loadMoreText}>
                {t('modulesCulture.economia.seeMore', { count: activeList.length - visibleCount })}
              </Text>
              <MaterialIcons name="expand-more" size={18} color={activeTabConf.color} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Info Footer ────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            {t('modulesCulture.economia.sources')}
          </Text>
        </View>

        {/* ── História e Ligações (módulo temático) ─────────────────────── */}
        <ModuleHistory module="economia" />
        <ModuleHighlights module="economia" />
        <ModuleLinks module="economia" />

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.marketLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.market + '30',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.textDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.textLight,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.marketLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabsScroll: {
    marginBottom: 6,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textMed,
  },
  tabChipLabelActive: {
    color: C.onMarket,
  },

  // Season filter
  seasonSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  seasonHeaderText: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  seasonChipsContent: {
    gap: 6,
  },
  seasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  seasonChipActive: {
    backgroundColor: C.dop,
    borderColor: C.dop,
  },
  seasonChipCurrent: {
    borderColor: C.accent,
    borderWidth: 2,
  },
  seasonChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  seasonChipTextActive: {
    color: C.onMarket,
  },
  seasonChipTextCurrent: {
    color: C.accent,
    fontWeight: '700',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 12,
    color: C.textLight,
    fontWeight: '500',
  },

  // List
  listContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textLight,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textMed,
  },
  emptyStateText: {
    fontSize: 13,
    color: C.textLight,
    textAlign: 'center',
  },

  // Footer
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  infoFooterText: {
    fontSize: 11,
    color: C.textLight,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 16,
  },
});
