/**
 * Economia Local — markets, artisans, and regional products explorer
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EconomyMarketCard from '../../src/components/EconomyMarketCard';
import { getModuleTheme } from '../../src/theme/colors';

const { width: _SCREEN_WIDTH } = Dimensions.get('window');

// ─── Colors (from centralized theme) ─────────────────────────────────────────

const MT = getModuleTheme('economia');
const C = {
  bg: MT.bg,
  card: MT.card,
  market: MT.accent,
  marketLight: '#FEF3C7',
  artisan: '#7C3AED',
  artisanLight: '#EDE9FE',
  fish: '#0369A1',
  fishLight: '#E0F2FE',
  dop: '#059669',
  dopLight: '#D1FAE5',
  textDark: MT.textPrimary,
  textMed: MT.textSecondary,
  textLight: MT.textMuted,
  border: '#E7E5E4',
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
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
}

const TABS: Tab[] = [
  { key: 'mercados', label: 'Mercados',  icon: 'storefront',   color: C.market  },
  { key: 'artesaos', label: 'Artesãos',  icon: 'palette',      color: C.artisan },
  { key: 'produtos', label: 'Produtos',  icon: 'local-grocery-store', color: C.dop },
];

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EconomiaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabKey>('mercados');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<number | null>(null);

  const currentMonth = new Date().getMonth() + 1;

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
    ? ECONOMY_DATA.produtos.filter((p) => p.season.includes(seasonFilter))
    : ECONOMY_DATA.produtos;

  const activeTabConf = TABS.find((t) => t.key === activeTab)!;

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
            <Text style={styles.headerTitle}>Economia Local</Text>
            <Text style={styles.headerSubtitle}>Mercados · Produtos · Artesãos</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="storefront" size={20} color={C.market} />
          </View>
        </View>

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
                  color={isActive ? '#FFFFFF' : C.textMed}
                />
                <Text
                  style={[
                    styles.tabChipLabel,
                    isActive && styles.tabChipLabelActive,
                  ]}
                >
                  {tab.label}
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
              <Text style={styles.seasonHeaderText}>Filtrar por época</Text>
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
                  Todos
                </Text>
              </TouchableOpacity>
              {MONTH_NAMES.map((name, idx) => {
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
                      {name}
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
            {activeTab === 'mercados' && `${ECONOMY_DATA.mercados.length} mercados e feiras`}
            {activeTab === 'artesaos' && `${ECONOMY_DATA.artesaos.length} ofícios artesanais`}
            {activeTab === 'produtos' && `${filteredProdutos.length} produto${filteredProdutos.length !== 1 ? 's' : ''} encontrado${filteredProdutos.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* ── Content List ───────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {/* Mercados */}
          {activeTab === 'mercados' &&
            ECONOMY_DATA.mercados.map((item) => (
              <EconomyMarketCard
                key={item.id}
                item={item}
                variant="market"
                expanded={expandedId === item.id}
                onPress={() => handleCardPress(item.id)}
              />
            ))}

          {/* Artesãos */}
          {activeTab === 'artesaos' &&
            ECONOMY_DATA.artesaos.map((item) => (
              <EconomyMarketCard
                key={item.id}
                item={item}
                variant="artisan"
                expanded={expandedId === item.id}
                onPress={() => handleCardPress(item.id)}
              />
            ))}

          {/* Produtos */}
          {activeTab === 'produtos' &&
            filteredProdutos.map((item) => (
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
              <Text style={styles.emptyStateTitle}>Sem produtos nesta época</Text>
              <Text style={styles.emptyStateText}>
                Tente outro mês ou selecione &quot;Todos&quot;.
              </Text>
            </View>
          )}
        </View>

        {/* ── Info Footer ────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Dados curados com base em fontes regionais e tradição oral.
          </Text>
        </View>

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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
