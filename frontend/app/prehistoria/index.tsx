/**
 * Pré-História — Geossítios · Megalitos · Arte Rupestre · Astronomia
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrehistoriaCard, { PrehistoriaSite } from '../../src/components/PrehistoriaCard';

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg:         '#1A1208',
  card:       '#2C1F0E',
  border:     '#3D2B14',
  accent:     '#D97706',
  accentDark: '#B45309',
  textLight:  '#F5ECD4',
  textMed:    '#C8B08A',
  textDim:    '#9CA3AF',
  textFaint:  '#6B7280',
  amber:      '#D97706',
  amberLight: '#FEF3C7',
};

// ─── Static Data ──────────────────────────────────────────────────────────────

const PREHISTORIA_DATA: PrehistoriaSite[] = [
  {
    id: 'almendres',
    name: 'Cromeleque dos Almendres',
    category: 'megalito',
    period: 'Neolitico',
    region: 'Alentejo',
    municipality: 'Évora',
    lat: 38.5544,
    lng: -8.0772,
    description_short: 'O maior complexo megalítico da Península Ibérica, com cerca de 95 monólitos dispostos em oval. Datado de ~6000 anos.',
    description_long: 'O Cromeleque dos Almendres é um dos mais importantes monumentos megalíticos da Europa Ocidental. Construído em várias fases entre o Neolítico Médio e o Calcolítico, os monólitos estão orientados para eventos astronómicos solares, permitindo a marcação do calendário agrícola.',
    astronomical_type: 'solsticio',
    alignment_azimuth: 67.5,
    celestial_event: { solstice: 'Solstício de Verão — nascer do sol a NE' },
    age_years: 6000,
    iq_score: 95,
  },
  {
    id: 'zambujeiro',
    name: 'Anta Grande do Zambujeiro',
    category: 'megalito',
    period: 'Neolitico',
    region: 'Alentejo',
    municipality: 'Évora',
    lat: 38.5180,
    lng: -8.0625,
    description_short: 'O maior dólmen da Península Ibérica, com câmara funerária de 6 metros de altura. Monumento excepcional do Neolítico alentejano.',
    description_long: 'A Anta Grande do Zambujeiro impressiona pela escala das suas lajes de granito, algumas com mais de 4 metros. Escavada na década de 1960, revelou espólio funerário rico em cerâmica, contas e artefactos de pedra polida.',
    age_years: 5500,
    iq_score: 88,
  },
  {
    id: 'coa',
    name: 'Arte Rupestre do Vale do Côa',
    category: 'rupestre',
    period: 'Paleolitico',
    region: 'Trás-os-Montes',
    municipality: 'Vila Nova de Foz Côa',
    lat: 41.0525,
    lng: -7.1000,
    description_short: 'O maior conjunto de arte rupestre paleolítica ao ar livre do mundo. Património Mundial UNESCO desde 1998, com mais de 1000 painéis gravados.',
    description_long: 'O Parque Arqueológico do Vale do Côa estende-se por 17 km ao longo do rio, com gravuras datadas entre 22 000 e 10 000 a.C. As figuras de auroque, cavalo e cervídeo são executadas com técnica de traço múltiplo única no mundo.',
    motifs_findings: ['auroques', 'cavalos', 'cervídeos', 'antropomorfos'],
    age_years: 25000,
    iq_score: 99,
  },
  {
    id: 'outeiro',
    name: 'Menir do Outeiro',
    category: 'megalito',
    period: 'Neolitico',
    region: 'Alentejo',
    municipality: 'Évora',
    lat: 38.5600,
    lng: -8.0800,
    description_short: 'Menir isolado com decoração gravada de serpentiformes e covinhas. Um dos raros menir com iconografia no Alentejo Central.',
    age_years: 5500,
    iq_score: 72,
  },
  {
    id: 'facha',
    name: 'Mamoa da Facha',
    category: 'megalito',
    period: 'Neolitico',
    region: 'Minho',
    municipality: 'Viana do Castelo',
    lat: 41.7333,
    lng: -8.5667,
    description_short: 'Monumento funerário tumular do Neolítico minhoto, integrado numa paisagem de mamoas que marca a fronteira simbólica do território tribal.',
    age_years: 5000,
    iq_score: 65,
  },
  {
    id: 'rodao',
    name: 'Arte Rupestre de Vila Velha de Ródão',
    category: 'rupestre',
    period: 'Paleolitico',
    region: 'Beira Baixa',
    municipality: 'Vila Velha de Ródão',
    lat: 39.6572,
    lng: -7.6703,
    description_short: 'Conjunto de arte rupestre junto às Portas de Ródão, com gravuras do Paleolítico Superior e Neolítico coexistindo nos xistos do Tejo.',
    motifs_findings: ['cervídeos', 'peixe', 'geométricos'],
    age_years: 20000,
    iq_score: 78,
  },
  {
    id: 'xerez',
    name: 'Cromeleque de Xerez',
    category: 'megalito',
    period: 'Neolitico',
    region: 'Alentejo',
    municipality: 'Beja',
    lat: 37.9200,
    lng: -7.5800,
    description_short: 'Conjunto megalítico com orientação equinocial precisa. Submergido parcialmente pela albufeira de Alqueva, foi relocado pedra a pedra.',
    description_long: 'O Cromeleque de Xerez foi alvo de uma operação de salvaguarda única em Portugal: os seus 49 monólitos foram desmontados, catalogados e reinstalados próximo da localização original antes do enchimento de Alqueva. O alinhamento equinocial foi preservado.',
    astronomical_type: 'equinocio',
    alignment_azimuth: 90.0,
    celestial_event: { equinox: 'Equinócio de Primavera — nascer do sol a Este' },
    age_years: 5800,
    iq_score: 85,
  },
  {
    id: 'briteiros',
    name: 'Citânia de Briteiros',
    category: 'arqueologico',
    period: 'Ferro',
    region: 'Minho',
    municipality: 'Guimarães',
    lat: 41.5717,
    lng: -8.3775,
    description_short: 'O maior e mais bem conservado castro do Noroeste peninsular. Habitado entre o séc. III a.C. e o séc. IV d.C., com mais de 150 casas circulares visíveis.',
    description_long: 'A Citânia de Briteiros foi escavada pioneiramente por Martins Sarmento a partir de 1875. O sítio revela a complexidade da cultura castreja: ruas pavimentadas, sistema de água, epigrafia latina e decoração arquitectónica própria.',
    motifs_findings: ['cerâmica castreja', 'pedras decoradas', 'epigrafia'],
    age_years: 2300,
    iq_score: 91,
  },
  {
    id: 'castelo-velho',
    name: 'Castelo Velho de Freixo de Numão',
    category: 'santuario',
    period: 'Calcolitico',
    region: 'Trás-os-Montes',
    municipality: 'Vila Nova de Foz Côa',
    lat: 41.0722,
    lng: -7.2086,
    description_short: 'Sítio calcolítico de carácter ritual excepcional, com estruturas arquitectónicas monumentais e deposições de objectos de prestígio fragmentados intencionalmente.',
    description_long: 'Castelo Velho destaca-se pela natureza claramente ritual das suas deposições: artefactos de cobre, cerâmica campaniforme e contas de ouro foram fragmentados e enterrados ritualmente. A interpretação aponta para um local de encontro e de prática religiosa supralocal.',
    motifs_findings: ['cerâmica campaniforme', 'artefactos de cobre', 'contas de ouro'],
    age_years: 4500,
    iq_score: 87,
  },
  {
    id: 'penedo-gordo',
    name: 'Geossítio de Penedo Gordo',
    category: 'geositio',
    period: 'Calcolitico',
    region: 'Beira Alta',
    municipality: 'Viseu',
    lat: 40.6600,
    lng: -7.9100,
    description_short: 'Afloramento granítico de grande dimensão com covinhas e gravuras calcolíticas, inserido em paisagem de relevância geológica e arqueológica.',
    motifs_findings: ['covinhas', 'sulcos', 'gravuras lineares'],
    age_years: 4000,
    iq_score: 63,
  },
  {
    id: 'chas-egua',
    name: 'Arte Rupestre Chãs de Égua',
    category: 'rupestre',
    period: 'Neolitico',
    region: 'Beira Interior',
    municipality: 'Arganil',
    lat: 40.1700,
    lng: -7.9200,
    description_short: 'Conjunto de gravuras rupestres neolíticas com orientação solar, num penedo a céu aberto que recebe o primeiro raio de sol no solstício de verão.',
    astronomical_type: 'solar',
    alignment_azimuth: 62.0,
    celestial_event: { solstice: 'Solstício de Verão — iluminação directa ao nascer' },
    motifs_findings: ['serpentiformes', 'covinhas', 'reticulados'],
    age_years: 5000,
    iq_score: 76,
  },
  {
    id: 'antelas',
    name: 'Dolmen de Antelas',
    category: 'megalito',
    period: 'Neolitico',
    region: 'Beira Alta',
    municipality: 'Oliveira de Frades',
    lat: 40.7400,
    lng: -8.1700,
    description_short: 'Anta bem conservada com corredor e câmara poligonal, exemplo típico do megalitismo da Beira Alta. Espólio neolítico e calcolítico.',
    description_long: 'O Dolmen de Antelas apresenta corredor com 5 lajes e câmara com 7 esteios. As escavações revelaram cerâmica lisa neolítica, pontas de seta e contas de variscite, atestando uso funerário prolongado.',
    age_years: 5200,
    iq_score: 70,
  },
];

// ─── Tab Types ────────────────────────────────────────────────────────────────

type CategoryTab = 'todos' | 'megalito' | 'rupestre' | 'geositio' | 'astronomia';
type PeriodFilter = 'todos' | 'Paleolitico' | 'Neolitico' | 'Calcolitico' | 'Bronze' | 'Ferro';

interface Tab {
  key: CategoryTab;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}

const CATEGORY_TABS: Tab[] = [
  { key: 'todos',      label: 'Todos',        icon: 'apps' },
  { key: 'megalito',   label: 'Megalitos',    icon: 'account-balance' },
  { key: 'rupestre',   label: 'Arte Rupestre',icon: 'brush' },
  { key: 'geositio',   label: 'Geossítios',   icon: 'terrain' },
  { key: 'astronomia', label: 'Astronomia',   icon: 'brightness-5' },
];

const PERIOD_CHIPS: { key: PeriodFilter; label: string }[] = [
  { key: 'todos',       label: 'Todos' },
  { key: 'Paleolitico', label: 'Paleolítico' },
  { key: 'Neolitico',   label: 'Neolítico' },
  { key: 'Calcolitico', label: 'Calcolítico' },
  { key: 'Bronze',      label: 'Bronze' },
  { key: 'Ferro',       label: 'Ferro' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PrehistoriaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeCategory, setActiveCategory] = useState<CategoryTab>('todos');
  const [activePeriod, setActivePeriod] = useState<PeriodFilter>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCategoryPress = (key: CategoryTab) => {
    setActiveCategory(key);
    setActivePeriod('todos');
    setExpandedId(null);
  };

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter sites
  const filteredSites = PREHISTORIA_DATA.filter((site) => {
    if (activeCategory === 'astronomia' && !site.astronomical_type) return false;
    if (activeCategory !== 'todos' && activeCategory !== 'astronomia' && site.category !== activeCategory) return false;
    if (activePeriod !== 'todos' && site.period !== activePeriod) return false;
    return true;
  });

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
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Pré-História</Text>
            <Text style={styles.headerSubtitle}>Geossítios · Megalitos · Arte Rupestre · Astronomia</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="account-balance" size={20} color={C.accent} />
          </View>
        </View>

        {/* ── Category Tabs ──────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabChip,
                  isActive && styles.tabChipActive,
                ]}
                onPress={() => handleCategoryPress(tab.key)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={15}
                  color={isActive ? '#1A1208' : C.textDim}
                />
                <Text style={[styles.tabChipLabel, isActive && styles.tabChipLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Period Filter ──────────────────────────────────────────────── */}
        <View style={styles.periodSection}>
          <View style={styles.periodHeader}>
            <MaterialIcons name="schedule" size={13} color={C.textFaint} />
            <Text style={styles.periodHeaderText}>Período</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodChipsContent}
          >
            {PERIOD_CHIPS.map((chip) => {
              const isActive = activePeriod === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.periodChip, isActive && styles.periodChipActive]}
                  onPress={() => setActivePeriod(chip.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.periodChipText, isActive && styles.periodChipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Astronomy Banner ───────────────────────────────────────────── */}
        {activeCategory === 'astronomia' ? (
          <View style={styles.astronomyBanner}>
            <View style={styles.astronomyBannerIcon}>
              <MaterialIcons name="brightness-5" size={22} color="#92400E" />
            </View>
            <View style={styles.astronomyBannerText}>
              <Text style={styles.astronomyBannerTitle}>Próximo evento</Text>
              <Text style={styles.astronomyBannerDesc}>Solstício de Verão — 21 Jun</Text>
            </View>
            <Text style={styles.astronomyBannerEmoji}>☀️</Text>
          </View>
        ) : null}

        {/* ── Summary ────────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryDot} />
          <Text style={styles.summaryText}>
            {filteredSites.length} {filteredSites.length === 1 ? 'sítio encontrado' : 'sítios encontrados'}
          </Text>
        </View>

        {/* ── Site Cards ─────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {filteredSites.map((site) => (
            <PrehistoriaCard
              key={site.id}
              site={site}
              expanded={expandedId === site.id}
              onPress={() => handleCardPress(site.id)}
            />
          ))}

          {/* Empty State */}
          {filteredSites.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={40} color={C.textFaint} />
              <Text style={styles.emptyStateTitle}>Sem sítios encontrados</Text>
              <Text style={styles.emptyStateText}>
                Tente outro filtro ou selecione &quot;Todos&quot;.
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textFaint} />
          <Text style={styles.infoFooterText}>
            Dados: SIPA/DGPC · LNEG · Parque Arqueológico do Vale do Côa
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
    backgroundColor: C.card,
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
    color: C.textLight,
  },
  headerSubtitle: {
    fontSize: 11,
    color: C.textDim,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  // Category Tabs
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
  tabChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  tabChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textDim,
  },
  tabChipLabelActive: {
    color: '#1A1208',
  },

  // Period filter
  periodSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  periodHeaderText: {
    fontSize: 11,
    color: C.textFaint,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  periodChipsContent: {
    gap: 6,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  periodChipActive: {
    backgroundColor: C.accentDark,
    borderColor: C.accentDark,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  periodChipTextActive: {
    color: '#FEF3C7',
  },

  // Astronomy Banner
  astronomyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#3B2A0A',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#D97706' + '44',
  },
  astronomyBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  astronomyBannerText: {
    flex: 1,
  },
  astronomyBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  astronomyBannerDesc: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textLight,
    marginTop: 2,
  },
  astronomyBannerEmoji: {
    fontSize: 28,
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
    backgroundColor: C.accent,
  },
  summaryText: {
    fontSize: 12,
    color: C.textDim,
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
    paddingVertical: 56,
    gap: 10,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textMed,
  },
  emptyStateText: {
    fontSize: 13,
    color: C.textDim,
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
    color: C.textFaint,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 16,
  },
});
