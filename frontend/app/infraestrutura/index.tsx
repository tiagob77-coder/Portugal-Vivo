/**
 * Infraestrutura Natural — passadiços, pontes suspensas, ecovias, miradouros e torres
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InfrastructureCard, { Infrastructure } from '../../src/components/InfrastructureCard';
import { getModuleTheme, withOpacity } from '../../src/theme/colors';

// ─── Colors (from centralized theme) ─────────────────────────────────────────

const MT = getModuleTheme('infraestrutura');
const C = {
  bg:        MT.bg,
  card:      MT.card,
  accent:    MT.accent,
  accentDim: '#166534',
  textDark:  MT.textPrimary,
  textMed:   MT.textSecondary,
  textLight: MT.textMuted,
  border:    '#14532D',
  chipBg:    '#0F2D18',
  amber:     '#D97706',
  amberBg:   '#78350F',
};

// ─── Static Data ──────────────────────────────────────────────────────────────

const INFRA_DATA: Infrastructure[] = [
  {
    id: 'passadicos-paiva',
    name: 'Passadiços do Paiva',
    type: 'passadico',
    subtype: 'montanha',
    region: 'Arouca',
    municipality: 'Arouca',
    description_short: 'Um dos trilhos de passadiço mais icónicos da Europa, com 8,7 km ao longo do rio Paiva entre penedos e quedas de água.',
    description_long: 'Classificado como um dos melhores trilhos do mundo, os Passadiços do Paiva atravessam a Geopark Arouca ao longo do rio Paiva. O percurso oferece vistas deslumbrantes sobre as gargantas fluviais e a rica biodiversidade da região.',
    length_m: 8700,
    difficulty: 'media',
    access_type: 'livre',
    is_family_friendly: false,
    is_dog_friendly: false,
    best_season: ['Primavera', 'Verão', 'Outono'],
    opening_hours: 'Aberto diariamente 8h-19h (época alta)',
    lat: 40.9351,
    lng: -8.2535,
    iq_score: 98,
  },
  {
    id: 'passadico-sete-lagoas',
    name: 'Passadiço das Sete Lagoas',
    type: 'passadico',
    subtype: 'ribeirinho',
    region: 'Gerês',
    municipality: 'Terras de Bouro',
    description_short: 'Percurso de 2,1 km junto às lagoas glaciares do Parque Nacional da Peneda-Gerês, com flora endémica e paisagem intocada.',
    length_m: 2100,
    difficulty: 'facil',
    access_type: 'livre',
    is_family_friendly: true,
    best_season: ['Primavera', 'Verão'],
    lat: 41.7718,
    lng: -8.1547,
    iq_score: 87,
  },
  {
    id: 'passadico-carreco',
    name: 'Passadiço de Carreço',
    type: 'passadico',
    subtype: 'costeiro',
    region: 'Viana do Castelo',
    municipality: 'Viana do Castelo',
    description_short: 'Passadiço costeiro de 1,2 km sobre o Atlântico, com vistas sobre a costa verde do Minho e acesso a praias isoladas.',
    length_m: 1200,
    difficulty: 'facil',
    access_type: 'livre',
    is_accessible: true,
    is_family_friendly: true,
    best_season: ['Primavera', 'Verão', 'Outono'],
    lat: 41.8042,
    lng: -8.8697,
    iq_score: 82,
  },
  {
    id: 'ponte-516-arouca',
    name: 'Ponte 516 Arouca',
    type: 'ponte_suspensa',
    subtype: 'montanha',
    region: 'Arouca',
    municipality: 'Arouca',
    description_short: 'A mais longa ponte suspensa pedonal do mundo com 516 m de comprimento e 175 m de altura sobre o rio Paiva.',
    description_long: 'Inaugurada em 2021, a Ponte 516 Arouca detém o recorde mundial de ponte pedonal suspensa mais longa. A travessia oferece vistas vertiginosas sobre o canhão do rio Paiva e a paisagem granítica da Serra da Freita.',
    length_m: 516,
    height_m: 175,
    difficulty: 'media',
    access_type: 'pago',
    safety_restrictions: 'Proibida a crianças com menos de 1 m de altura. Não recomendada a pessoas com vertigem.',
    best_season: ['Primavera', 'Verão', 'Outono'],
    opening_hours: 'Ter-Dom 9h-18h (bilheteira fecha às 17h)',
    lat: 40.9274,
    lng: -8.2458,
    iq_score: 96,
  },
  {
    id: 'ponte-rio-paiva',
    name: 'Ponte Sobre o Rio Paiva',
    type: 'ponte_suspensa',
    subtype: 'montanha',
    region: 'Arouca',
    municipality: 'Arouca',
    description_short: 'Ponte suspensa de 252 m sobre o rio Paiva, ponto de partida e chegada dos Passadiços do Paiva.',
    length_m: 252,
    difficulty: 'facil',
    access_type: 'pago',
    best_season: ['Primavera', 'Verão', 'Outono'],
    lat: 40.9389,
    lng: -8.2612,
    iq_score: 88,
  },
  {
    id: 'ecovia-tamega',
    name: 'Ecovia do Tâmega',
    type: 'ecovia',
    subtype: 'ferroviario',
    region: 'Amarante',
    municipality: 'Amarante',
    description_short: 'Antiga linha ferroviária do Tâmega reconvertida em percurso de 35 km para ciclistas e pedestres ao longo do rio.',
    description_long: 'Percorre a antiga Linha do Tâmega, desativada em 2009, atravessando viadutos, tuneis e aldeias históricas entre Amarante e Chaves.',
    length_m: 35000,
    difficulty: 'facil',
    access_type: 'livre',
    is_dog_friendly: true,
    is_family_friendly: true,
    best_season: ['Primavera', 'Verão', 'Outono'],
    lat: 41.2706,
    lng: -8.0792,
    iq_score: 84,
  },
  {
    id: 'ecovia-litoral-norte',
    name: 'Ecovia do Litoral Norte',
    type: 'ecovia',
    subtype: 'costeiro',
    region: 'Viana do Castelo',
    municipality: 'Viana do Castelo',
    description_short: 'Itinerário costeiro de 22 km entre praias, dunas e estuários da costa verde do Alto Minho.',
    length_m: 22000,
    difficulty: 'facil',
    access_type: 'livre',
    is_accessible: true,
    is_family_friendly: true,
    best_season: ['Primavera', 'Verão'],
    lat: 41.6961,
    lng: -8.8346,
    iq_score: 79,
  },
  {
    id: 'via-verde-dao',
    name: 'Via Verde do Dão',
    type: 'via_verde',
    subtype: 'ferroviario',
    region: 'Viseu',
    municipality: 'Viseu',
    description_short: 'Antiga Linha do Dão reconvertida em 48 km de via verde para ciclismo e pedestrianismo entre Viseu e Santa Comba Dão.',
    description_long: 'Inaugurada em 2017, a Via Verde do Dão é uma das mais completas vias verdes do país. Atravessa vales vinhateiros, albufeiras e aldeias rurais numa experiência imersiva no Dão profundo.',
    length_m: 48000,
    difficulty: 'facil',
    access_type: 'livre',
    is_dog_friendly: true,
    is_family_friendly: true,
    best_season: ['Primavera', 'Verão', 'Outono'],
    opening_hours: 'Aberto todo o ano',
    lat: 40.6560,
    lng: -7.9122,
    iq_score: 86,
  },
  {
    id: 'miradouro-sao-jeronimo',
    name: 'Miradouro de São Jerónimo',
    type: 'miradouro',
    subtype: 'montanha',
    region: 'Serra da Estrela',
    municipality: 'Seia',
    description_short: 'Ponto mais alto da Serra da Estrela com vistas de 360° sobre planaltos glaciares, lagoas e a Cova da Beira.',
    difficulty: 'dificil',
    access_type: 'livre',
    best_season: ['Verão', 'Outono'],
    safety_restrictions: 'Estrada pode estar cortada por neve de novembro a março. Verificar condições antes de partir.',
    lat: 40.3239,
    lng: -7.5996,
    iq_score: 91,
  },
  {
    id: 'miradouro-portas-rodao',
    name: 'Miradouro das Portas do Ródão',
    type: 'miradouro',
    subtype: 'geologico',
    region: 'Vila Velha de Ródão',
    municipality: 'Vila Velha de Ródão',
    description_short: 'Vista privilegiada sobre o corte geológico do rio Tejo nas Portas do Ródão, habitat do abutre-do-egipto.',
    access_type: 'livre',
    is_accessible: true,
    best_season: ['Primavera', 'Verão', 'Outono', 'Inverno'],
    lat: 39.6511,
    lng: -7.6627,
    iq_score: 83,
  },
  {
    id: 'miradouro-facho',
    name: 'Miradouro do Facho',
    type: 'miradouro',
    subtype: 'costeiro',
    region: 'Madeira',
    municipality: 'Machico',
    description_short: 'Pico volcânico no extremo leste da Madeira com vista panorâmica sobre o Oceano Atlântico, Porto Santo e as Desertas.',
    difficulty: 'media',
    access_type: 'livre',
    best_season: ['Primavera', 'Verão', 'Outono'],
    lat: 32.7280,
    lng: -16.7309,
    iq_score: 89,
  },
  {
    id: 'miradouro-ponta-madrugada',
    name: 'Miradouro da Ponta da Madrugada',
    type: 'miradouro',
    subtype: 'costeiro',
    region: 'Açores',
    municipality: 'Nordeste',
    description_short: 'O ponto mais oriental dos Açores e de toda a União Europeia, com vistas sobre o Atlântico ao nascer do sol.',
    access_type: 'livre',
    best_season: ['Primavera', 'Verão'],
    lat: 37.7927,
    lng: -25.1283,
    iq_score: 92,
  },
  {
    id: 'torre-paul-arzila',
    name: 'Torre de Observação de Aves do Paul de Arzila',
    type: 'torre_observacao',
    region: 'Coimbra',
    municipality: 'Coimbra',
    description_short: 'Torre de observação ornitológica na Reserva Natural do Paul de Arzila, habitat de garças, patos e espécies migratórias raras.',
    access_type: 'livre',
    is_family_friendly: true,
    best_season: ['Inverno', 'Primavera'],
    opening_hours: 'Aberto durante o dia, sem restrições',
    lat: 40.1622,
    lng: -8.5388,
    iq_score: 76,
  },
  {
    id: 'passadico-algares',
    name: 'Passadiço da Praia Fluvial de Algares',
    type: 'passadico',
    subtype: 'ribeirinho',
    region: 'Constância',
    municipality: 'Constância',
    description_short: 'Passadiço familiar de acesso à praia fluvial do rio Zêzere em Constância, com zonas de lazer e sombra natural.',
    difficulty: 'facil',
    access_type: 'livre',
    is_accessible: true,
    is_family_friendly: true,
    best_season: ['Primavera', 'Verão'],
    lat: 39.4617,
    lng: -8.3358,
    iq_score: 71,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type InfraType = Infrastructure['type'] | 'todos';
type AccessFilter = 'todos' | 'acessivel' | 'familia' | 'cao';

interface TypeTab {
  key: InfraType;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}

const TYPE_TABS: TypeTab[] = [
  { key: 'todos',           label: 'Todos',           icon: 'grid-view' },
  { key: 'passadico',       label: 'Passadiços',      icon: 'directions-walk' },
  { key: 'ponte_suspensa',  label: 'Pontes Suspensas', icon: 'link' },
  { key: 'ecovia',          label: 'Ecovias',          icon: 'nature' },
  { key: 'miradouro',       label: 'Miradouros',       icon: 'landscape' },
  { key: 'torre_observacao', label: 'Torres',          icon: 'cell-tower' },
];

const ACCESS_FILTERS: { key: AccessFilter; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'acessivel', label: 'Acessível' },
  { key: 'familia',  label: 'Família' },
  { key: 'cao',      label: 'Cão' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InfraestruturaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeType, setActiveType]     = useState<InfraType>('todos');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('todos');
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter logic
  const filtered = INFRA_DATA.filter((item) => {
    const typeMatch = activeType === 'todos' || item.type === activeType;
    const accessMatch =
      accessFilter === 'todos'    ? true :
      accessFilter === 'acessivel' ? item.is_accessible === true :
      accessFilter === 'familia'  ? item.is_family_friendly === true :
      accessFilter === 'cao'      ? item.is_dog_friendly === true :
      true;
    return typeMatch && accessMatch;
  });

  const count = filtered.length;

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
            <Text style={styles.headerTitle}>Infraestrutura Natural</Text>
            <Text style={styles.headerSubtitle}>
              Passadiços · Pontes · Ecovias · Miradouros
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="terrain" size={20} color={C.accent} />
          </View>
        </View>

        {/* ── Type Tabs ──────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {TYPE_TABS.map((tab) => {
            const isActive = activeType === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabChip, isActive && styles.tabChipActive]}
                onPress={() => { setActiveType(tab.key); setExpandedId(null); }}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={15}
                  color={isActive ? '#FFFFFF' : C.textMed}
                />
                <Text style={[styles.tabChipLabel, isActive && styles.tabChipLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Accessibility Filter Row ────────────────────────────────────── */}
        <View style={styles.filterSection}>
          <View style={styles.filterLabelRow}>
            <MaterialIcons name="filter-list" size={13} color={C.textLight} />
            <Text style={styles.filterLabelText}>Filtrar por acessibilidade</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsContent}
          >
            {ACCESS_FILTERS.map((f) => {
              const isActive = accessFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setAccessFilter(f.key)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Summary Row ────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, { backgroundColor: C.accent }]} />
          <Text style={styles.summaryText}>
            {count} {count === 1 ? 'infraestrutura encontrada' : 'infraestruturas encontradas'}
          </Text>
        </View>

        {/* ── List ───────────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {filtered.map((item) => (
            <InfrastructureCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onPress={() => handleCardPress(item.id)}
            />
          ))}

          {/* Empty state */}
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="terrain" size={40} color={C.accentDim} />
              <Text style={styles.emptyStateTitle}>Sem resultados</Text>
              <Text style={styles.emptyStateText}>
                Tente alterar o tipo ou remover os filtros de acessibilidade.
              </Text>
            </View>
          )}
        </View>

        {/* ── Info Footer ────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.accentDim} />
          <Text style={styles.infoFooterText}>
            Dados: ICNF · Municípios · Turismo de Portugal
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
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
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
    backgroundColor: C.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  // Tabs
  tabsScroll: {
    marginTop: 12,
    marginBottom: 4,
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
  tabChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  tabChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textMed,
  },
  tabChipLabelActive: {
    color: '#FFFFFF',
  },

  // Accessibility filter
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 6,
    gap: 6,
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  filterLabelText: {
    fontSize: 11,
    color: C.accentDim,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  filterChipsContent: {
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.accentDim,
    borderColor: C.accent,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    color: C.accentDim,
    fontWeight: '500',
  },

  // List
  listContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textMed,
  },
  emptyStateText: {
    fontSize: 13,
    color: C.accentDim,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
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
    color: C.accentDim,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 16,
  },
});
