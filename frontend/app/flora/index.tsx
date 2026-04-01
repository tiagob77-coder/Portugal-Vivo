/**
 * Atlas de Flora — native flora, endemisms and flowering calendar explorer
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloraSpeciesCard, { FloraSpecies } from '../../src/components/FloraSpeciesCard';
import { getModuleTheme } from '../../src/theme/colors';

// ─── Colors (from centralized theme) ─────────────────────────────────────────

const MT = getModuleTheme('flora');
const C = {
  bg:          MT.bg,
  card:        MT.card,
  accent:      MT.accent,
  accentLight: MT.accentMuted,
  textDark:    MT.textPrimary,
  textMed:     MT.textSecondary,
  textLight:   MT.textMuted,
  border:      '#0D3B1A',
  gold:        '#D97706',
};

// ─── Static Data ──────────────────────────────────────────────────────────────

const FLORA_DATA: FloraSpecies[] = [
  {
    id: 'narciso-prados',
    common_name: 'Narciso-dos-prados',
    scientific_name: 'Narcissus bulbocodium',
    status: 'endemica',
    region_main: 'Serra da Estrela',
    habitats: ['montanha', 'prado', 'altitude'],
    flowering_start_month: 3,
    flowering_end_month: 5,
    rarity_score: 82,
    threat_status: 'EN',
    where_to_observe: 'Planalto da Serra da Estrela, acima dos 1400 m, em Março-Abril.',
    description_short: 'Bolbosa amarela de pétalas em forma de trombeta. Forma tapetes dourados nas encostas da Estrela em primavera.',
    description_long: 'Espécie endémica da Península Ibérica, particularmente abundante nas serras do centro de Portugal. Os seus bolbos adaptaram-se ao solo xistoso e granítico de altitude.',
    curiosity: 'Na Serra da Estrela, os pastores usavam o narciso como indicador de neve próxima a derreter — a sua floração anunciava a chegada da primavera.',
    legal_protection: ['Diretiva Habitats', 'Red Data Book PT'],
    iq_score: 88,
  },
  {
    id: 'trovisco',
    common_name: 'Trovisco',
    scientific_name: 'Daphne gnidium',
    status: 'autocone',
    region_main: 'Costa / Dunas',
    habitats: ['dunas', 'maquis', 'litoral'],
    flowering_start_month: 6,
    flowering_end_month: 9,
    rarity_score: 30,
    threat_status: 'LC',
    where_to_observe: 'Dunas costeiras e matos baixos em todo o litoral português.',
    description_short: 'Arbusto de folhas estreitas com bagas vermelhas vistosas no outono. Toda a planta é tóxica.',
    curiosity: 'O nome &quot;trovisco&quot; deriva do latim tardio e era usada em rituais rurais para afastar mau-olhado — apesar da sua toxicidade conhecida.',
  },
  {
    id: 'urze-monte',
    common_name: 'Urze-do-monte',
    scientific_name: 'Erica australis',
    status: 'autocone',
    region_main: 'Norte / Centro',
    habitats: ['montanha', 'charneca', 'granito'],
    flowering_start_month: 3,
    flowering_end_month: 6,
    rarity_score: 35,
    threat_status: 'LC',
    where_to_observe: 'Serras do Norte e Centro; abundante na Serra do Gerês e Serra da Lousã.',
    description_short: 'Urze de flores cor-de-rosa intenso que cobre as charnecas do norte e centro em primavera.',
  },
  {
    id: 'estreleira',
    common_name: 'Estreleira',
    scientific_name: 'Helichrysum stoechas',
    status: 'autocone',
    region_main: 'Algarve / Litoral',
    habitats: ['dunas', 'litoral', 'arenoso'],
    flowering_start_month: 5,
    flowering_end_month: 8,
    rarity_score: 28,
    threat_status: 'LC',
    where_to_observe: 'Dunas litorais desde Minho até ao Algarve, especialmente abundante na Costa Vicentina.',
    description_short: 'Planta aromática com flores amarelas papiráceas que permanecem secas sem perder a cor.',
    curiosity: 'As flores secas da estreleira eram usadas em arranjos secos tradicionais portugueses e ainda hoje decoram casas alentejanas.',
  },
  {
    id: 'dragoeiro',
    common_name: 'Dragoeiro',
    scientific_name: 'Dracaena draco',
    status: 'endemica',
    endemism_level: 'macaronesico',
    region_main: 'Madeira / Açores',
    habitats: ['laurissilva', 'rochoso', 'insular'],
    flowering_start_month: 5,
    flowering_end_month: 6,
    rarity_score: 90,
    threat_status: 'VU',
    where_to_observe: 'Jardim Botânico do Funchal, Anaga (Tenerife) e exemplares centenários em Icod de los Vinos.',
    description_short: 'Árvore icónica da Macaronésia com copa em guarda-chuva e resina vermelha chamada &quot;sangue de dragão&quot;.',
    description_long: 'Pode viver mais de 1000 anos. A resina vermelha era usada como verniz por luthiers e na medicina tradicional canária e portuguesa.',
    curiosity: 'O &quot;sangue de dragão&quot; — a resina vermelha — era exportado para a Europa no século XVI como medicamento e pigmento para violinos Stradivarius.',
    legal_protection: ['CITES Apêndice II', 'Lista Vermelha PT'],
    iq_score: 95,
  },
  {
    id: 'louro-madeira',
    common_name: 'Louro-da-Madeira',
    scientific_name: 'Laurus azorica',
    status: 'endemica',
    endemism_level: 'macaronesico',
    region_main: 'Madeira / Açores',
    habitats: ['laurissilva', 'humido', 'insular'],
    flowering_start_month: 3,
    flowering_end_month: 4,
    rarity_score: 72,
    threat_status: 'LC',
    where_to_observe: 'Levadas da Madeira, especialmente Levada do Caldeirao Verde e PR1.',
    description_short: 'Loureiro endémico da Macaronésia, pilar da floresta laurissilva classificada como Património Mundial UNESCO.',
  },
  {
    id: 'pinguicula-lusitanica',
    common_name: 'Pinguicula lusitanica',
    scientific_name: 'Pinguicula lusitanica',
    status: 'endemica',
    endemism_level: 'iberico',
    region_main: 'Norte / Minho',
    habitats: ['zonas_humidas', 'turfa', 'charneca'],
    flowering_start_month: 4,
    flowering_end_month: 7,
    rarity_score: 85,
    threat_status: 'LC',
    where_to_observe: 'Charnecas húmidas e turfeiras do Minho, especialmente Parque Nacional Peneda-Gerês.',
    description_short: 'Planta carnívora minúscula que captura insetos com folhas viscosas. Uma das raras carnívoras de Portugal.',
    curiosity: 'As folhas desta carnívora produzem até 200 glândulas por milímetro quadrado — cada uma segrega uma gota pegajosa que aprisiona mosquitos e moscas.',
    legal_protection: ['Diretiva Habitats', 'CITES'],
    iq_score: 92,
  },
  {
    id: 'silene-longicilia',
    common_name: 'Silene-das-falésias',
    scientific_name: 'Silene longicilia',
    status: 'endemica',
    endemism_level: 'local',
    region_main: 'Algarve',
    habitats: ['falésias', 'litoral', 'calcario'],
    flowering_start_month: 4,
    flowering_end_month: 6,
    rarity_score: 91,
    threat_status: 'EN',
    where_to_observe: 'Falésias calcárias do Algarve Barlavento, entre Sagres e Lagos.',
    description_short: 'Endémica estritamente local das falésias algarvias. Flores brancas com pétalas profundamente divididas.',
    legal_protection: ['Diretiva Habitats Anexo II', 'Red Data Book PT'],
    iq_score: 94,
  },
  {
    id: 'orquidea-borboleta',
    common_name: 'Orquídea-borboleta',
    scientific_name: 'Orchis papilionacea',
    status: 'protegida',
    region_main: 'Alentejo',
    habitats: ['montado', 'prado', 'calcario'],
    flowering_start_month: 3,
    flowering_end_month: 5,
    rarity_score: 70,
    threat_status: 'NT',
    where_to_observe: 'Montados alentejanos em março. Especialmente em Mértola, Moura e Vale do Guadiana.',
    description_short: 'Uma das orquídeas silvestres mais belas de Portugal, com flores que imitam borboletas coloridas.',
    description_long: 'Dependente de micorrizas específicas para germinar, torna-se extremamente sensível a alterações do solo. A sua presença indica solos não perturbados.',
    curiosity: 'As orquídeas silvestres portuguesas não produzem néctar — enganam os polinizadores com a aparência e cheiro de flores nectaríferas. É uma ilusão botânica perfeita.',
    legal_protection: ['CITES Apêndice II', 'Diretiva Habitats'],
    iq_score: 80,
  },
  {
    id: 'acucena-brava',
    common_name: 'Açucena-brava',
    scientific_name: 'Pancratium maritimum',
    status: 'autocone',
    region_main: 'Costa',
    habitats: ['dunas', 'litoral', 'arenoso'],
    flowering_start_month: 7,
    flowering_end_month: 9,
    rarity_score: 55,
    threat_status: 'LC',
    where_to_observe: 'Dunas litorais de todo o país — floresce ao anoitecer em julho-agosto.',
    description_short: 'Bolbosa de flores brancas perfumadas que emerge diretamente da areia das dunas. Floresce ao entardecer.',
    curiosity: 'A açucena-brava só abre as flores ao anoitecer, atraindo esfíngidas (mariposas-beija-flor) com o seu perfume intenso. Rara adaptação ao litoral arenoso.',
  },
  {
    id: 'azevinhos',
    common_name: 'Azevinho-da-Macaronésia',
    scientific_name: 'Ilex perado',
    status: 'endemica',
    endemism_level: 'macaronesico',
    region_main: 'Açores / Madeira',
    habitats: ['laurissilva', 'humido', 'insular'],
    flowering_start_month: 4,
    flowering_end_month: 5,
    rarity_score: 75,
    threat_status: 'LC',
    where_to_observe: 'Laurissilva da Madeira e florestas dos Açores — abundante em altitude.',
    description_short: 'Parente do azevinho europeu, adaptado à laurissilva macaronésica com folhas maiores e bagas vermelhas.',
  },
  {
    id: 'violeta-geres',
    common_name: 'Violeta-de-Gerês',
    scientific_name: 'Viola langeana',
    status: 'endemica',
    endemism_level: 'local',
    region_main: 'Gerês',
    habitats: ['montanha', 'granito', 'altitude'],
    flowering_start_month: 4,
    flowering_end_month: 6,
    rarity_score: 93,
    threat_status: 'EN',
    where_to_observe: 'Zonas rochosas graníticas do Parque Nacional Peneda-Gerês, acima dos 800 m.',
    description_short: 'Violeta endémica do Gerês com flores azul-violeta. Uma das plantas mais raras de Portugal continental.',
    description_long: 'Distribuição extremamente restrita ao planalto granítico do Gerês. Sensível a perturbação do habitat e pastoreio excessivo.',
    curiosity: 'A Viola langeana foi descoberta scientificamente apenas no século XIX pelo botânico dinamarquês Lange — e só existe no Gerês em todo o mundo.',
    legal_protection: ['Diretiva Habitats Anexo II', 'Diretiva Habitats Anexo IV', 'Red Data Book PT'],
    iq_score: 96,
  },
  {
    id: 'dedaleira',
    common_name: 'Dedaleira',
    scientific_name: 'Digitalis purpurea',
    status: 'autocone',
    region_main: 'Norte',
    habitats: ['montanha', 'prado', 'orla_florestal'],
    flowering_start_month: 5,
    flowering_end_month: 7,
    rarity_score: 40,
    threat_status: 'LC',
    where_to_observe: 'Orlas de bosques e encostas abertas do Norte — especialmente no Gerês e Peneda.',
    description_short: 'Espiga alta de flores cor-de-rosa-roxo em forma de dedal. Base de medicamentos cardíacos (digitálicos).',
    curiosity: 'A dedaleira contém digitoxina, usada pela primeira vez em 1785 pelo médico inglês William Withering para tratar insuficiência cardíaca. Continua a salvar vidas.',
  },
  {
    id: 'palmeira-ana',
    common_name: 'Palmeira-anã',
    scientific_name: 'Chamaerops humilis',
    status: 'autocone',
    region_main: 'Algarve',
    habitats: ['maquis', 'litoral', 'calcareo'],
    flowering_start_month: 3,
    flowering_end_month: 5,
    rarity_score: 48,
    threat_status: 'LC',
    where_to_observe: 'Maquis e encostas rochosas do Algarve, especialmente Costa Vicentina.',
    description_short: 'A única palmeira nativa da Europa continental. Forma matagais densos nas encostas algarvias.',
    curiosity: 'A Chamaerops humilis é a única palmeira verdadeiramente selvagem da Europa continental — todos os outros exemplares de palmeira em Portugal foram introduzidos.',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'todos' | 'endemicas' | 'protegidas' | 'montanha' | 'dunas' | 'laurissilva' | 'humidas';

interface Tab {
  key: TabKey;
  label: string;
}

const TABS: Tab[] = [
  { key: 'todos',       label: 'Todos' },
  { key: 'endemicas',   label: 'Endémicas' },
  { key: 'protegidas',  label: 'Protegidas' },
  { key: 'montanha',    label: 'Alta Montanha' },
  { key: 'dunas',       label: 'Dunas' },
  { key: 'laurissilva', label: 'Laurissilva' },
  { key: 'humidas',     label: 'Zonas Húmidas' },
];

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function isFlowering(species: FloraSpecies, month: number): boolean {
  const s = species.flowering_start_month;
  const e = species.flowering_end_month;
  if (s <= e) return month >= s && month <= e;
  return month >= s || month <= e;
}

function filterByTab(data: FloraSpecies[], tab: TabKey): FloraSpecies[] {
  if (tab === 'todos') return data;
  if (tab === 'endemicas')   return data.filter((s) => s.status === 'endemica');
  if (tab === 'protegidas')  return data.filter((s) => s.status === 'protegida' || (s.legal_protection && s.legal_protection.length > 0));
  if (tab === 'montanha')    return data.filter((s) => s.habitats.some((h) => h === 'montanha' || h === 'altitude'));
  if (tab === 'dunas')       return data.filter((s) => s.habitats.includes('dunas'));
  if (tab === 'laurissilva') return data.filter((s) => s.habitats.includes('laurissilva'));
  if (tab === 'humidas')     return data.filter((s) => s.habitats.some((h) => h === 'zonas_humidas' || h === 'turfa'));
  return data;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FloraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab]   = useState<TabKey>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);

  const currentMonth = new Date().getMonth() + 1;

  const handleTabPress = (key: TabKey) => {
    setActiveTab(key);
    setExpandedId(null);
  };

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Apply tab filter then month filter
  const tabFiltered = filterByTab(FLORA_DATA, activeTab);
  const filtered = monthFilter
    ? tabFiltered.filter((s) => isFlowering(s, monthFilter))
    : tabFiltered;

  // Count species flowering this month
  const floweringNow = FLORA_DATA.filter((s) => isFlowering(s, currentMonth)).length;

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
            <MaterialIcons name="arrow-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Atlas de Flora</Text>
            <Text style={styles.headerSubtitle}>Flora Silvestre · Endemismos · Calendário de Floração</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="eco" size={20} color={C.accent} />
          </View>
        </View>

        {/* ── Seasonal banner ─────────────────────────────────────────────── */}
        <View style={styles.seasonalBanner}>
          <MaterialIcons name="local-florist" size={16} color={C.accent} />
          <Text style={styles.seasonalText}>
            A florir agora: <Text style={styles.seasonalCount}>{floweringNow} espécies</Text> em {MONTH_NAMES[currentMonth - 1]}
          </Text>
        </View>

        {/* ── Category tabs ───────────────────────────────────────────────── */}
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
                style={[styles.tabChip, isActive && styles.tabChipActive]}
                onPress={() => handleTabPress(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabChipLabel, isActive && styles.tabChipLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Month filter ────────────────────────────────────────────────── */}
        <View style={styles.monthSection}>
          <View style={styles.monthHeader}>
            <MaterialIcons name="calendar-today" size={12} color={C.textLight} />
            <Text style={styles.monthHeaderText}>Filtrar por mês de floração</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthChipsContent}
          >
            <TouchableOpacity
              style={[styles.monthChip, monthFilter === null && styles.monthChipActive]}
              onPress={() => setMonthFilter(null)}
            >
              <Text style={[styles.monthChipText, monthFilter === null && styles.monthChipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            {MONTH_NAMES.map((name, idx) => {
              const month = idx + 1;
              const isActive = monthFilter === month;
              const isCurrent = month === currentMonth;
              return (
                <TouchableOpacity
                  key={month}
                  style={[
                    styles.monthChip,
                    isActive && styles.monthChipActive,
                    isCurrent && styles.monthChipCurrent,
                  ]}
                  onPress={() => setMonthFilter(isActive ? null : month)}
                >
                  <Text style={[
                    styles.monthChipText,
                    isActive && styles.monthChipTextActive,
                    isCurrent && !isActive && styles.monthChipTextCurrent,
                  ]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Summary row ─────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, { backgroundColor: C.accent }]} />
          <Text style={styles.summaryText}>
            {filtered.length} espécie{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* ── Species list ────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {filtered.map((species) => (
            <FloraSpeciesCard
              key={species.id}
              species={species}
              expanded={expandedId === species.id}
              onPress={() => handleCardPress(species.id)}
            />
          ))}

          {/* Empty state */}
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="eco" size={40} color={C.textLight} />
              <Text style={styles.emptyStateTitle}>Sem espécies neste filtro</Text>
              <Text style={styles.emptyStateText}>
                Tente outro mês ou categoria.
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Dados: ICNF · Lista Vermelha · Flora-On
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
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.accent + '30',
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
    backgroundColor: C.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Seasonal banner
  seasonalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#22C55E12',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#22C55E25',
  },
  seasonalText: {
    fontSize: 13,
    color: C.textMed,
    flex: 1,
  },
  seasonalCount: {
    fontWeight: '700',
    color: C.accent,
  },

  // Tabs
  tabsScroll: {
    marginBottom: 8,
  },
  tabsContent: {
    paddingHorizontal: 16,
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

  // Month filter
  monthSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  monthHeaderText: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  monthChipsContent: {
    gap: 6,
  },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  monthChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  monthChipCurrent: {
    borderColor: '#86EFAC',
    borderWidth: 2,
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  monthChipTextActive: {
    color: '#FFFFFF',
  },
  monthChipTextCurrent: {
    color: '#86EFAC',
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
