/**
 * Música Tradicional — Portuguese traditional music explorer
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MusicCard, { MusicItem } from '../../src/components/MusicCard';
import { getModuleTheme, withOpacity } from '../../src/theme/colors';

// ─── Colors (from centralized theme) ─────────────────────────────────────────

const MT = getModuleTheme('musica');
const C = {
  bg: MT.bg,
  card: MT.card,
  accent: MT.accent,
  accentLight: MT.accentMuted,
  textDark: MT.textPrimary,
  textMed: MT.textSecondary,
  textLight: MT.textMuted,
  border: '#2D1B4E',
  headerFrom: MT.bg,
  purple: '#8B5CF6',
  purpleLight: withOpacity('#8B5CF6', 0.12),
  unesco: '#F59E0B',
  unescoLight: withOpacity('#F59E0B', 0.12),
};

// ─── Static Music Data ────────────────────────────────────────────────────────

const MUSIC_DATA: MusicItem[] = [
  {
    id: 'fado-lisboa',
    name: 'Fado de Lisboa',
    type: 'fado',
    region: 'Lisboa',
    municipality: 'Lisboa',
    description_short: 'O fado lisboeta, canção urbana nascida nos bairros populares, Património Imaterial da Humanidade pela UNESCO desde 2011.',
    lat: 38.7223,
    lng: -9.1393,
    iq_score: 99,
    unesco: true,
    instruments: ['Guitarra portuguesa', 'Viola de fado'],
    artists: ['Amália Rodrigues', 'Mariza', 'Ana Moura', 'Camané'],
    venues: ['Clube de Fado', 'A Severa', 'Tasca do Chico'],
  },
  {
    id: 'fado-coimbra',
    name: 'Fado de Coimbra',
    type: 'fado',
    region: 'Centro',
    municipality: 'Coimbra',
    description_short: 'Fado académico cantado exclusivamente por homens, ligado à Universidade de Coimbra e às tradições estudantis.',
    lat: 40.2033,
    lng: -8.4103,
    iq_score: 96,
    instruments: ['Guitarra de Coimbra', 'Viola'],
    artists: ['José Afonso', 'Adriano Correia de Oliveira', 'Luís Goes'],
  },
  {
    id: 'guitarra-portuguesa',
    name: 'Guitarra Portuguesa',
    type: 'instrumento',
    region: 'Lisboa',
    municipality: 'Lisboa',
    description_short: 'Instrumento de cordas dedilhadas com forma de pera, símbolo sonoro do fado e da identidade musical portuguesa.',
    lat: 38.7140,
    lng: -9.1400,
    iq_score: 97,
    instruments: ['Guitarra portuguesa de Lisboa', 'Guitarra de Coimbra'],
  },
  {
    id: 'rancho-folclorico-minho',
    name: 'Rancho Folclórico do Minho',
    type: 'folclore',
    region: 'Minho',
    municipality: 'Viana do Castelo',
    description_short: 'Grupos de danças e cantares tradicionais minhotos, com trajes coloridos e coreografias ancestrais de celebração comunitária.',
    lat: 41.6931,
    lng: -8.8340,
    iq_score: 93,
    instruments: ['Concertina', 'Bombo', 'Cavaquinho', 'Ferrinhos'],
  },
  {
    id: 'cante-alentejano',
    name: 'Cante Alentejano',
    type: 'canto_polifonico',
    region: 'Alentejo',
    municipality: 'Serpa',
    description_short: 'Canto coral polifónico a duas vozes do Alentejo, Património Imaterial da Humanidade pela UNESCO desde 2014.',
    lat: 37.9393,
    lng: -7.5973,
    iq_score: 98,
    unesco: true,
  },
  {
    id: 'viola-campanica',
    name: 'Viola Campaniça',
    type: 'instrumento',
    region: 'Alentejo',
    municipality: 'Odemira',
    description_short: 'Viola tradicional do Baixo Alentejo, com sonoridade única e papel central no acompanhamento do cante alentejano.',
    lat: 37.5966,
    lng: -8.6390,
    iq_score: 88,
  },
  {
    id: 'corridinho-algarvio',
    name: 'Corridinho Algarvio',
    type: 'danca_tradicional',
    region: 'Algarve',
    municipality: 'Loulé',
    description_short: 'Dança tradicional rápida e alegre do Algarve, executada em pares com passos giratórios ao som do acordeão.',
    lat: 37.1379,
    lng: -8.0200,
    iq_score: 85,
    instruments: ['Acordeão', 'Harmónica', 'Viola'],
  },
  {
    id: 'pauliteiros-miranda',
    name: 'Pauliteiros de Miranda',
    type: 'danca_tradicional',
    region: 'Trás-os-Montes',
    municipality: 'Miranda do Douro',
    description_short: 'Dança guerreira masculina com paus e espadas, de origem celta, preservada nas terras de Miranda do Douro.',
    lat: 41.4950,
    lng: -6.2740,
    iq_score: 94,
    instruments: ['Gaita de foles', 'Bombo', 'Caixa'],
  },
  {
    id: 'gaita-foles-transmontana',
    name: 'Gaita de Foles Transmontana',
    type: 'instrumento',
    region: 'Trás-os-Montes',
    municipality: 'Bragança',
    description_short: 'Instrumento de sopro ancestral de Trás-os-Montes, com fole de pele de cabra e ponteiro melódico de madeira.',
    lat: 41.8057,
    lng: -6.7590,
    iq_score: 91,
  },
  {
    id: 'adufeiras-monsanto',
    name: 'Adufeiras de Monsanto',
    type: 'canto_tradicional',
    region: 'Centro',
    municipality: 'Idanha-a-Nova',
    description_short: 'Tradição feminina de canto acompanhado pelo adufe, tambor quadrado de pele dupla, na região raiana da Beira Baixa.',
    lat: 39.9987,
    lng: -7.1133,
    iq_score: 90,
    instruments: ['Adufe'],
  },
  {
    id: 'festival-musicas-mundo',
    name: 'Festival Músicas do Mundo',
    type: 'festival',
    region: 'Alentejo',
    municipality: 'Sines',
    description_short: 'Festival internacional de world music em Sines, terra natal de Vasco da Gama, com palcos junto ao mar e artistas de todo o mundo.',
    lat: 37.9564,
    lng: -8.8786,
    iq_score: 87,
  },
  {
    id: 'festival-fado-lisboa',
    name: 'Festival de Fado de Lisboa',
    type: 'festival',
    region: 'Lisboa',
    municipality: 'Lisboa',
    description_short: 'Festival anual dedicado ao fado em Lisboa, reunindo fadistas consagrados e novas vozes nos palcos da capital.',
    lat: 38.7117,
    lng: -9.1365,
    iq_score: 86,
  },
  {
    id: 'tunas-academicas',
    name: 'Tunas Académicas',
    type: 'tuna',
    region: 'Centro',
    municipality: 'Coimbra',
    description_short: 'Grupos musicais universitários de tradição secular, com capa e batina, que interpretam serenatas e canções estudantis.',
    lat: 40.2090,
    lng: -8.4250,
    iq_score: 82,
  },
  {
    id: 'cavaquinho-minhoto',
    name: 'Cavaquinho Minhoto',
    type: 'instrumento',
    region: 'Minho',
    municipality: 'Braga',
    description_short: 'Pequeno cordofone de quatro cordas originário do Minho, antepassado do ukulele havaiano e do cavaquinho brasileiro.',
    lat: 41.5518,
    lng: -8.4229,
    iq_score: 89,
  },
];

// ─── Tab Config ───────────────────────────────────────────────────────────────

type TypeFilter = 'todos' | MusicItem['type'];

interface TypeTab {
  key: TypeFilter;
  label: string;
}

const TYPE_TABS: TypeTab[] = [
  { key: 'todos',             label: 'Todos'        },
  { key: 'fado',              label: 'Fado'          },
  { key: 'folclore',          label: 'Folclore'      },
  { key: 'instrumento',       label: 'Instrumentos'  },
  { key: 'danca_tradicional', label: 'Danças'        },
  { key: 'canto_polifonico',  label: 'Canto'         },
  { key: 'canto_tradicional', label: 'Canto'         },
  { key: 'festival',          label: 'Festivais'     },
  { key: 'tuna',              label: 'Tunas'         },
];

const TYPE_COLORS: Record<string, string> = {
  todos:              '#8B5CF6',
  fado:               '#8B5CF6',
  folclore:           '#EC4899',
  instrumento:        '#06B6D4',
  danca_tradicional:  '#F97316',
  canto_polifonico:   '#10B981',
  canto_tradicional:  '#10B981',
  festival:           '#EAB308',
  tuna:               '#6366F1',
};

const REGIONS = ['Todos', 'Minho', 'Norte', 'Trás-os-Montes', 'Centro', 'Lisboa', 'Alentejo', 'Algarve'];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MusicaTradicional() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [regionFilter, setRegionFilter] = useState<string>('Todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const unescoCount = MUSIC_DATA.filter((m) => m.unesco).length;

  // Apply filters — merge canto_polifonico and canto_tradicional under 'Canto'
  const filtered = MUSIC_DATA.filter((m) => {
    const matchType =
      typeFilter === 'todos' ||
      m.type === typeFilter ||
      (typeFilter === 'canto_polifonico' && m.type === 'canto_tradicional') ||
      (typeFilter === 'canto_tradicional' && m.type === 'canto_polifonico');
    const matchRegion = regionFilter === 'Todos' || m.region === regionFilter;
    return matchType && matchRegion;
  });

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleTypeTab = (key: TypeFilter) => {
    setTypeFilter(key);
    setExpandedId(null);
  };

  const activeColor = TYPE_COLORS[typeFilter] || C.purple;

  // Deduplicate Canto tabs (canto_polifonico and canto_tradicional share label)
  const displayTabs = TYPE_TABS.filter(
    (tab, idx, arr) => arr.findIndex((t) => t.label === tab.label) === idx
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Música Tradicional</Text>
            <Text style={styles.headerSubtitle}>Fado &middot; Folclore &middot; Instrumentos &middot; Danças</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="music-note" size={20} color={C.accent} />
          </View>
        </View>

        {/* ── Type Tabs ───────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {displayTabs.map((tab) => {
            const isActive = typeFilter === tab.key;
            const color = TYPE_COLORS[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabChip,
                  isActive && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() => handleTypeTab(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabChipLabel, isActive && styles.tabChipLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Region Filter ───────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.regionScroll}
          contentContainerStyle={styles.regionContent}
        >
          {REGIONS.map((r) => {
            const isActive = regionFilter === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.regionChip, isActive && styles.regionChipActive]}
                onPress={() => setRegionFilter(r)}
                activeOpacity={0.8}
              >
                <Text style={[styles.regionChipText, isActive && styles.regionChipTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── UNESCO Banner ──────────────────────────────────────────────── */}
        {unescoCount > 0 && (
          <View style={styles.unescoBanner}>
            <MaterialIcons name="star" size={18} color={C.unesco} />
            <Text style={styles.unescoBannerText}>
              {unescoCount} tradição{unescoCount !== 1 ? 'ões' : ''} com reconhecimento UNESCO
            </Text>
          </View>
        )}

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, { backgroundColor: activeColor }]} />
          <Text style={styles.summaryText}>
            {filtered.length} tradição{filtered.length !== 1 ? 'ões' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* ── Music List ─────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {filtered.map((item) => (
            <MusicCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onPress={() => handleCardPress(item.id)}
            />
          ))}

          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="celebration" size={40} color={C.textLight} />
              <Text style={styles.emptyStateTitle}>Sem tradições nesta categoria</Text>
              <Text style={styles.emptyStateText}>
                Tenta outro tipo ou região para descobrir a música tradicional portuguesa.
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={13} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Dados: DGPC &middot; UNESCO &middot; Associações Culturais
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
    backgroundColor: C.headerFrom,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.accent + '40',
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
    color: C.textMed,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Type Tabs
  tabsScroll: {
    marginBottom: 4,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabChip: {
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

  // Region Filter
  regionScroll: {
    marginBottom: 4,
    marginTop: 6,
  },
  regionContent: {
    paddingHorizontal: 20,
    gap: 6,
  },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  regionChipActive: {
    backgroundColor: '#2D1B4E',
    borderColor: '#4C2A85',
  },
  regionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  regionChipTextActive: {
    color: '#C4B5FD',
  },

  // UNESCO Banner
  unescoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: C.unescoLight,
    borderWidth: 1,
    borderColor: withOpacity('#F59E0B', 0.25),
  },
  unescoBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.unesco,
    flex: 1,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 10,
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

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    gap: 12,
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
    paddingHorizontal: 24,
    lineHeight: 19,
  },

  // Footer
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginTop: 28,
  },
  infoFooterText: {
    fontSize: 11,
    color: C.textLight,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 16,
  },
});
