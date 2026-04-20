/**
 * Biodiversidade — Portuguese marine species explorer
 * Oceanic dark palette: bg #071828, card #0A2236, accent cyan #06B6D4
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MarineSpeciesCard, { MarineSpecies } from '../../src/components/MarineSpeciesCard';
import { getModuleTheme, withOpacity } from '../../src/theme/colors';

// ─── Colors (from centralized theme) ─────────────────────────────────────────

const MT = getModuleTheme('biodiversidade');
const C = {
  bg:           MT.bg,
  card:         MT.card,
  accent:       MT.accent,
  accentLight:  MT.accentMuted,
  amber:        '#D97706',
  amberLight:   withOpacity('#D97706', 0.08),
  textDark:     MT.textPrimary,
  textMed:      MT.textSecondary,
  textLight:    MT.textMuted,
  border:       '#1E3A52',
  headerGrad1:  MT.card,
  headerGrad2:  MT.bg,
};

// ─── Static species data ──────────────────────────────────────────────────────

const SPECIES_DATA: MarineSpecies[] = [
  {
    id: 'golfinho-comum',
    scientific_name: 'Delphinus delphis',
    common_name_pt: 'Golfinho-comum',
    category: 'mammal',
    iucn_status: 'LC',
    region: ['Atlântico'],
    season: 'year-round',
    activity_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    description_short: 'O golfinho mais avistado nas costas portuguesas, frequentemente em grupos de dezenas a centenas de indivíduos.',
    curiosity: 'Comunicam com assobios únicos — cada golfinho tem o seu &quot;nome&quot; acústico.',
    habitat: 'Pelágico costeiro',
    depth_range: '0–200m',
    best_spots: ['Cabo de São Vicente', 'Açores', 'Setúbal'],
    iq_score: 92,
  },
  {
    id: 'baleia-bossas',
    scientific_name: 'Megaptera novaeangliae',
    common_name_pt: 'Baleia-de-bossas',
    category: 'mammal',
    iucn_status: 'LC',
    region: ['Açores', 'Madeira'],
    season: 'migration',
    activity_months: [4,5,6,7,8,9,10],
    description_short: 'Visitante sazonal das águas dos Açores durante a migração do Atlântico Norte, conhecida pelos seus saltos espetaculares.',
    curiosity: 'Os seus cantos podem durar horas e são transmitidos entre populações — uma forma de cultura animal.',
    habitat: 'Pelágico oceânico',
    depth_range: '0–500m',
    best_spots: ['Pico (Açores)', 'Faial (Açores)', 'Madeira'],
    iq_score: 88,
  },
  {
    id: 'foca-cinzenta',
    scientific_name: 'Halichoerus grypus',
    common_name_pt: 'Foca-cinzenta',
    category: 'mammal',
    iucn_status: 'LC',
    region: ['Norte', 'Costa Vicentina'],
    season: 'year-round',
    activity_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    description_short: 'Rara visitante das costas portuguesas, prefere zonas rochosas e isoladas para descanso.',
    curiosity: 'Pode mergulhar até 300m e permanecer até 30 minutos submersa.',
    habitat: 'Costeiro rochoso',
    depth_range: '0–300m',
    best_spots: ['Costa Vicentina', 'Berlengas'],
    iq_score: 75,
  },
  {
    id: 'cagarra',
    scientific_name: 'Calonectris borealis',
    common_name_pt: 'Cagarra',
    category: 'seabird',
    iucn_status: 'LC',
    region: ['Açores', 'Madeira'],
    season: 'summer',
    activity_months: [3,4,5,6,7,8,9,10],
    description_short: 'Ave marinha emblemática dos Açores, planeia com elegância sobre as ondas percorrendo milhares de quilómetros.',
    curiosity: 'Migra até à costa da África Ocidental no inverno — uma viagem de 10 000 km.',
    habitat: 'Pelágico oceânico',
    depth_range: '0–10m',
    best_spots: ['Ilha do Corvo', 'Faial', 'Santa Maria'],
    iq_score: 70,
  },
  {
    id: 'gaivota-patas-amarelas',
    scientific_name: 'Larus michahellis',
    common_name_pt: 'Gaivota-de-patas-amarelas',
    category: 'seabird',
    iucn_status: 'LC',
    region: ['Costa Portuguesa'],
    season: 'year-round',
    activity_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    description_short: 'A gaivota mais comum de Portugal, adaptada às cidades costeiras e zonas portuárias.',
    curiosity: 'Aprende comportamentos complexos como usar o tráfego para partir moluscos.',
    habitat: 'Costeiro e urbano',
    best_spots: ['Lisboa', 'Porto', 'Faro', 'Sesimbra'],
    iq_score: 65,
  },
  {
    id: 'airo',
    scientific_name: 'Uria aalge',
    common_name_pt: 'Airo',
    category: 'seabird',
    iucn_status: 'LC',
    region: ['Norte'],
    season: 'winter',
    activity_months: [10,11,12,1,2,3],
    description_short: 'Visitante invernal do norte de Portugal, com plumagem negra e branca e mergulho impressionante.',
    curiosity: 'Mergulha até 180m usando as asas como barbatanas.',
    habitat: 'Pelágico costeiro',
    depth_range: '0–180m',
    best_spots: ['Costa Norte', 'Berlengas', 'Cabo da Roca'],
    iq_score: 60,
  },
  {
    id: 'atum-rabilho',
    scientific_name: 'Thunnus thynnus',
    common_name_pt: 'Atum-rabilho',
    category: 'fish',
    iucn_status: 'EN',
    region: ['Algarve', 'Açores'],
    season: 'migration',
    activity_months: [6,7,8,9],
    description_short: 'O maior atum do mundo, historicamente abundante no Algarve, hoje ameaçado pela sobrepesca.',
    curiosity: 'Pode atingir os 3m e 680kg. A sua carne é a mais valorizada no mercado japonês do sushi.',
    habitat: 'Pelágico oceânico',
    depth_range: '0–1000m',
    best_spots: ['Tavira', 'Sagres', 'Açores', 'Armação de Pêra'],
    iq_score: 85,
  },
  {
    id: 'mero',
    scientific_name: 'Epinephelus marginatus',
    common_name_pt: 'Mero',
    category: 'fish',
    iucn_status: 'EN',
    region: ['Costa Vicentina', 'Madeira'],
    season: 'year-round',
    activity_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    description_short: 'Peixe de recife solitário e territorial, pode viver décadas e pesar até 60kg.',
    curiosity: 'Todos os meros nascem fêmeas — apenas os maiores mudam de sexo para macho.',
    habitat: 'Recifes rochosos',
    depth_range: '5–300m',
    best_spots: ['Berlengas', 'Costa Vicentina', 'Madeira'],
    iq_score: 72,
  },
  {
    id: 'cavalo-marinho',
    scientific_name: 'Hippocampus guttulatus',
    common_name_pt: 'Cavalo-marinho',
    category: 'fish',
    iucn_status: 'LC',
    region: ['Estuários', 'Ria Formosa'],
    season: 'year-round',
    activity_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    description_short: 'O único cavalo-marinho de grande porte da Europa, encontrado nas pradarias de ervas marinhas do Algarve.',
    curiosity: 'É o macho que fica grávido e dá à luz até 200 crias.',
    habitat: 'Pradarias de Posidónia',
    depth_range: '0–20m',
    best_spots: ['Ria Formosa', 'Sado', 'Tejo'],
    iq_score: 80,
  },
  {
    id: 'ourico-mar',
    scientific_name: 'Paracentrotus lividus',
    common_name_pt: 'Ouriço-do-mar',
    category: 'invertebrate',
    iucn_status: 'LC',
    region: ['Costa rochosa'],
    season: 'year-round',
    activity_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    description_short: 'Equinodermo abundante nas costas rochosas portuguesas, com gónadas consideradas uma iguaria.',
    curiosity: 'As suas gónadas (ovas) são consumidas cruas em Portugal, Espanha e Japão.',
    habitat: 'Zona entremarés rochosa',
    depth_range: '0–30m',
    best_spots: ['Algarve', 'Berlengas', 'Açores'],
    iq_score: 40,
  },
  {
    id: 'polvo-comum',
    scientific_name: 'Octopus vulgaris',
    common_name_pt: 'Polvo-comum',
    category: 'invertebrate',
    iucn_status: 'LC',
    region: ['Costa Portuguesa'],
    season: 'year-round',
    activity_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    description_short: 'Molusco cefalópode de inteligência notável, mestre da camuflagem e das armadilhas.',
    curiosity: 'Tem três corações, sangue azul e pode resolver puzzles. Cada braço tem mente semi-independente.',
    habitat: 'Fundos rochosos e arenosos',
    depth_range: '0–200m',
    best_spots: ['Algarve', 'Açores', 'Costa Alentejana'],
    iq_score: 95,
  },
  {
    id: 'posidonia',
    scientific_name: 'Posidonia oceanica',
    common_name_pt: 'Posidónia',
    category: 'plant',
    iucn_status: 'EN',
    region: ['Algarve subaquático'],
    season: 'year-round',
    activity_months: [1,2,3,4,5,6,7,8,9,10,11,12],
    description_short: 'Pradaria submarina de erva marinha endémica do Mediterrâneo, habitat crítico para dezenas de espécies.',
    curiosity: 'Pode ser o organismo mais antigo da Terra — clones com 200 000 anos foram descobertos.',
    habitat: 'Fundos arenosos sublitorais',
    depth_range: '1–40m',
    best_spots: ['Ria Formosa', 'Tavira', 'Sagres'],
    iq_score: 55,
  },
  {
    id: 'tartaruga-couro',
    scientific_name: 'Dermochelys coriacea',
    common_name_pt: 'Tartaruga-de-couro',
    category: 'reptile',
    iucn_status: 'VU',
    region: ['Algarve', 'Açores'],
    season: 'summer',
    activity_months: [5,6,7,8,9],
    description_short: 'A maior tartaruga do mundo, com carapaça coriácea única. Visita as costas portuguesas em busca de medusas.',
    curiosity: 'Pode mergulhar até 1 200m — um recorde entre répteis. Tolera temperaturas sub-zero.',
    habitat: 'Pelágico oceânico',
    depth_range: '0–1200m',
    best_spots: ['Açores', 'Algarve', 'Madeira'],
    iq_score: 78,
  },
  {
    id: 'arraia-jamanta',
    scientific_name: 'Mobula mobular',
    common_name_pt: 'Arraia-jamanta',
    category: 'fish',
    iucn_status: 'EN',
    region: ['Algarve', 'Açores'],
    season: 'summer',
    activity_months: [6,7,8],
    description_short: 'A maior raia do Mediterrâneo, com uma envergadura até 5m. Alimenta-se de plâncton em águas abertas.',
    curiosity: 'Salta completamente fora de água em padrões que os cientistas ainda não compreenderam totalmente.',
    habitat: 'Pelágico costeiro e oceânico',
    depth_range: '0–150m',
    best_spots: ['Algarve', 'Açores', 'Sesimbra'],
    iq_score: 82,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryFilter = 'all' | MarineSpecies['category'];
type SeasonFilter = 'all' | MarineSpecies['season'];

interface CategoryTab {
  key: CategoryFilter;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
}

interface SeasonTab {
  key: SeasonFilter;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}

const CATEGORY_TABS: CategoryTab[] = [
  { key: 'all',          label: 'Todos',          icon: 'waves',       color: C.accent   },
  { key: 'mammal',       label: 'Mamíferos',      icon: 'waves',       color: '#0369A1'  },
  { key: 'seabird',      label: 'Aves',            icon: 'air',         color: '#0891B2'  },
  { key: 'fish',         label: 'Peixes',          icon: 'set-meal',    color: '#059669'  },
  { key: 'invertebrate', label: 'Invertebrados',   icon: 'bug-report',  color: '#7C3AED'  },
  { key: 'plant',        label: 'Plantas',         icon: 'eco',         color: '#16A34A'  },
];

const SEASON_TABS: SeasonTab[] = [
  { key: 'all',         label: 'Todos',     icon: 'loop'         },
  { key: 'winter',      label: 'Inverno',   icon: 'ac-unit'      },
  { key: 'spring',      label: 'Primavera', icon: 'local-florist'},
  { key: 'summer',      label: 'Verão',     icon: 'wb-sunny'     },
  { key: 'autumn',      label: 'Outono',    icon: 'park'         },
  { key: 'migration',   label: 'Migração',  icon: 'flight'       },
];

const SEASON_PT: Record<string, string> = {
  winter:    'Inverno',
  spring:    'Primavera',
  summer:    'Verão',
  autumn:    'Outono',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentSeason(): MarineSpecies['season'] {
  const month = new Date().getMonth() + 1;
  if (month >= 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5)  return 'spring';
  if (month >= 6 && month <= 8)  return 'summer';
  return 'autumn';
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BiodiversidadeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [seasonFilter, setSeasonFilter]     = useState<SeasonFilter>('all');
  const [expandedId, setExpandedId]         = useState<string | null>(null);

  const currentSeason = getCurrentSeason();

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filtered = SPECIES_DATA.filter((s) => {
    const catOk = categoryFilter === 'all' || s.category === categoryFilter;
    const seaOk = seasonFilter === 'all' || s.season === seasonFilter || s.season === 'year-round';
    return catOk && seaOk;
  });

  const currentSeasonCount = SPECIES_DATA.filter(
    (s) => s.season === currentSeason || s.season === 'year-round' || s.season === 'migration',
  ).length;

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
            <Text style={styles.headerTitle}>Vida Marinha</Text>
            <Text style={styles.headerSubtitle}>
              Espécies · Habitats · Avistamentos
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="waves" size={20} color={C.accent} />
          </View>
        </View>

        {/* ── Current season banner ───────────────────────────────────────── */}
        <View style={styles.seasonBanner}>
          <View style={styles.seasonBannerInner}>
            <MaterialIcons name="wb-sunny" size={16} color={C.amber} />
            <Text style={styles.seasonBannerText}>
              Época atual: {SEASON_PT[currentSeason]} — {currentSeasonCount} espécies observáveis
            </Text>
          </View>
        </View>

        {/* ── Category tabs ───────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {CATEGORY_TABS.map((tab) => {
            const isActive = categoryFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabChip,
                  isActive && { backgroundColor: tab.color, borderColor: tab.color },
                ]}
                onPress={() => { setCategoryFilter(tab.key); setExpandedId(null); }}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={14}
                  color={isActive ? '#FFFFFF' : C.textMed}
                />
                <Text style={[styles.tabChipLabel, isActive && styles.tabChipLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Season filter row ───────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.seasonScroll}
          contentContainerStyle={styles.seasonContent}
        >
          {SEASON_TABS.map((tab) => {
            const isActive = seasonFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.seasonChip,
                  isActive && { backgroundColor: C.accent + '22', borderColor: C.accent },
                ]}
                onPress={() => { setSeasonFilter(tab.key); setExpandedId(null); }}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={12}
                  color={isActive ? C.accent : C.textLight}
                />
                <Text style={[styles.seasonChipLabel, isActive && { color: C.accent }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Species count ───────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, { backgroundColor: C.accent }]} />
          <Text style={styles.summaryText}>
            {filtered.length} espécie{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* ── Species list ────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {filtered.map((species) => (
            <MarineSpeciesCard
              key={species.id}
              species={species}
              expanded={expandedId === species.id}
              onPress={() => handleCardPress(species.id)}
            />
          ))}

          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={40} color={C.textLight} />
              <Text style={styles.emptyStateTitle}>Sem espécies encontradas</Text>
              <Text style={styles.emptyStateText}>
                Tente outros filtros de categoria ou época.
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Dados: ICNF · OBIS · FishBase · eBird
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
    backgroundColor: C.headerGrad1,
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

  // Season banner
  seasonBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: C.amberLight,
    borderWidth: 1,
    borderColor: C.amber + '44',
    padding: 12,
  },
  seasonBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seasonBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.amber,
    flex: 1,
  },

  // Category tabs
  tabsScroll: {
    marginTop: 12,
    marginBottom: 4,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 7,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  tabChipLabelActive: {
    color: '#FFFFFF',
  },

  // Season filter row
  seasonScroll: {
    marginTop: 6,
    marginBottom: 4,
  },
  seasonContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  seasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  seasonChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textLight,
  },

  // Summary row
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    marginVertical: 10,
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

  // Empty state
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
