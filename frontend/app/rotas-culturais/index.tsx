/**
 * Rotas Culturais — Premium cultural routes explorer
 * 6 macro-families: Music, Dance, Festivals, Costumes, Instruments, Integrated
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CulturalRouteCard, { CulturalRoute } from '../../src/components/CulturalRouteCard';
import { getModuleTheme, withOpacity } from '../../src/theme/colors';

const MT = getModuleTheme('rotas-culturais');
const C = {
  bg: MT.bg,
  card: MT.card,
  accent: MT.accent,
  accentLight: MT.accentMuted,
  textDark: MT.textPrimary,
  textMed: MT.textSecondary,
  textLight: MT.textMuted,
  border: '#2A1A50',
};

type FamilyFilter = 'todos' | CulturalRoute['family'];

interface FamilyTab {
  key: FamilyFilter;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
}

const FAMILY_TABS: FamilyTab[] = [
  { key: 'todos',        label: 'Todas',        icon: 'auto-awesome',    color: '#A855F7' },
  { key: 'musicais',     label: 'Musicais',     icon: 'music-note',      color: '#8B5CF6' },
  { key: 'danca',        label: 'Danca',        icon: 'directions-run',  color: '#EC4899' },
  { key: 'festas',       label: 'Festas',       icon: 'celebration',     color: '#F59E0B' },
  { key: 'trajes',       label: 'Trajes',       icon: 'checkroom',       color: '#06B6D4' },
  { key: 'instrumentos', label: 'Instrumentos', icon: 'piano',           color: '#10B981' },
  { key: 'integradas',   label: 'Integradas',   icon: 'auto-awesome',    color: '#EF4444' },
];

const REGIONS = ['Todas', 'Minho', 'Porto', 'Douro', 'Lisboa', 'Alentejo', 'Algarve', 'Acores', 'Madeira'];

const ROUTES_DATA: CulturalRoute[] = [
  {
    id: 'cr_mus_001', name: 'Rota do Fado', family: 'musicais', sub_family: 'fado',
    region: 'Lisboa', municipalities: ['Lisboa', 'Coimbra'], unesco: true,
    unesco_label: 'Fado \u2014 Patrim\u00f3nio Imaterial da Humanidade (2011)',
    description_short: 'Do Bairro Alto \u00e0 Mouraria, de Alfama a Coimbra \u2014 a rota completa do Fado, o canto da alma portuguesa.',
    duration_days: 3, best_months: [3, 4, 5, 6, 9, 10],
    instruments: ['guitarra_portuguesa', 'viola_de_fado'], dances: [],
    gastronomy: ['petiscos de Alfama', 'bacalhau \u00e0 Br\u00e1s', 'past\u00e9is de nata'],
    costumes: ['xaile negro da fadista'], festivals: ['Caixa Alfama', 'Festa do Fado'],
    premium: true, iq_score: 99, lat: 38.7116, lng: -9.1300,
    stops: [
      { name: 'Museu do Fado', lat: 38.7108, lng: -9.1314, municipality: 'Lisboa', type: 'museu' },
      { name: 'Alfama', lat: 38.7116, lng: -9.1300, municipality: 'Lisboa', type: 'bairro_historico' },
      { name: 'Mouraria', lat: 38.7148, lng: -9.1350, municipality: 'Lisboa', type: 'bairro_historico' },
      { name: 'Coimbra \u2014 Serenatas', lat: 40.2089, lng: -8.4265, municipality: 'Coimbra', type: 'universidade' },
    ],
  },
  {
    id: 'cr_mus_002', name: 'Rota do Cante Alentejano', family: 'musicais', sub_family: 'cante_alentejano',
    region: 'Alentejo', municipalities: ['Beja', '\u00c9vora', 'Serpa'], unesco: true,
    unesco_label: 'Cante Alentejano \u2014 Patrim\u00f3nio Imaterial da Humanidade (2014)',
    description_short: 'Vozes que ecoam na plan\u00edcie \u2014 a rota do Cante Alentejano, canto polif\u00f3nico do sul.',
    duration_days: 3, best_months: [3, 4, 5, 9, 10, 11],
    instruments: [], dances: ['danca_roda_alentejana'],
    gastronomy: ['migas alentejanas', 'queijo de Serpa DOP', 'vinho do Alentejo'],
    costumes: ['traje de pastor alentejano'], festivals: ['Festival do Cante (Serpa)'],
    premium: true, iq_score: 98, lat: 37.9419, lng: -7.5987,
    stops: [
      { name: 'Serpa \u2014 Capital do Cante', lat: 37.9419, lng: -7.5987, municipality: 'Serpa', type: 'sede_cultural' },
      { name: 'Beja', lat: 38.0151, lng: -7.8632, municipality: 'Beja', type: 'cidade' },
      { name: '\u00c9vora', lat: 38.5710, lng: -7.9093, municipality: '\u00c9vora', type: 'cidade_historica' },
    ],
  },
  {
    id: 'cr_mus_004', name: 'Rota dos Pauliteiros de Miranda', family: 'musicais', sub_family: 'pauliteiros',
    region: 'Tr\u00e1s-os-Montes', municipalities: ['Miranda do Douro', 'Vimioso', 'Bragan\u00e7a'],
    description_short: 'A dan\u00e7a guerreira dos Pauliteiros \u2014 paus, gaitas-de-foles e aldeias de granito.',
    duration_days: 3, best_months: [5, 6, 7, 8, 12],
    instruments: ['gaita_de_foles', 'caixa', 'bombo'], dances: ['pauliteiros'],
    gastronomy: ['posta mirandesa', 'alheira de Mirandela'],
    costumes: ['traje mirand\u00eas', 'saiote de Pauliteiro'], festivals: ['Festival Interc\u00e9ltico de Miranda'],
    premium: true, iq_score: 96, lat: 41.5000, lng: -6.2747,
    stops: [
      { name: 'Miranda do Douro', lat: 41.5000, lng: -6.2747, municipality: 'Miranda do Douro', type: 'cidade' },
      { name: 'Duas Igrejas', lat: 41.4667, lng: -6.3000, municipality: 'Miranda do Douro', type: 'aldeia' },
      { name: 'Bragan\u00e7a \u2014 Museu da M\u00e1scara', lat: 41.8061, lng: -6.7567, municipality: 'Bragan\u00e7a', type: 'museu' },
    ],
  },
  {
    id: 'cr_dan_001', name: 'Rota das Dan\u00e7as do Minho', family: 'danca', sub_family: 'dancas_minho',
    region: 'Minho', municipalities: ['Viana do Castelo', 'Braga', 'Barcelos'],
    description_short: 'Viras, chulas e canas-verdes \u2014 as dan\u00e7as mais vibrantes do Norte.',
    duration_days: 3, best_months: [5, 6, 7, 8],
    instruments: ['concertina', 'viola_braguesa', 'cavaquinho'], dances: ['vira', 'chula', 'cana_verde'],
    gastronomy: ['roj\u00f5es \u00e0 minhota', 'vinho verde'],
    costumes: ['traje de Viana', 'traje de dote'], festivals: ['Festa da Agonia', 'S\u00e3o Jo\u00e3o de Braga'],
    premium: true, iq_score: 97, lat: 41.6934, lng: -8.8301,
    stops: [
      { name: 'Viana do Castelo', lat: 41.6934, lng: -8.8301, municipality: 'Viana do Castelo', type: 'cidade' },
      { name: 'Braga', lat: 41.5503, lng: -8.4275, municipality: 'Braga', type: 'cidade' },
    ],
  },
  {
    id: 'cr_dan_003', name: 'Rota das Adufeiras e Dan\u00e7as Beir\u00e3s', family: 'danca', sub_family: 'dancas_beiras',
    region: 'Beira Interior', municipalities: ['Idanha-a-Nova', 'Monsanto'], unesco: true,
    unesco_label: 'Idanha-a-Nova \u2014 Cidade Criativa da M\u00fasica UNESCO (2015)',
    description_short: 'Adufes, romarias e dan\u00e7as de trabalho \u2014 a Beira Interior como guardi\u00e3 de tradi\u00e7\u00f5es.',
    duration_days: 2, best_months: [4, 5, 6, 9, 10],
    instruments: ['adufe'], dances: ['danca_adufe', 'danca_vindima'],
    gastronomy: ['cabrito assado', 'queijo da Serra'],
    costumes: ['traje de adufeira'], festivals: ['Festival Terras sem Sombra'],
    premium: true, iq_score: 94, lat: 39.9222, lng: -7.2367,
    stops: [
      { name: 'Idanha-a-Nova', lat: 39.9222, lng: -7.2367, municipality: 'Idanha-a-Nova', type: 'cidade_criativa_UNESCO' },
      { name: 'Monsanto', lat: 40.0389, lng: -7.1142, municipality: 'Idanha-a-Nova', type: 'aldeia_historica' },
    ],
  },
  {
    id: 'cr_fes_002', name: 'Rota dos Santos Populares', family: 'festas', sub_family: 'santos_populares',
    region: 'Lisboa', municipalities: ['Lisboa', 'Porto', 'Braga'],
    description_short: 'Santo Ant\u00f3nio, S\u00e3o Jo\u00e3o e S\u00e3o Pedro \u2014 as maiores festas urbanas de Portugal.',
    duration_days: 4, best_months: [6],
    instruments: ['concertina', 'bombo'], dances: ['marchas_populares', 'bailarico'],
    gastronomy: ['sardinhas assadas', 'caldo verde', 'manjericos'],
    costumes: ['traje de marcha popular'], festivals: ['Festas de Lisboa', 'S\u00e3o Jo\u00e3o do Porto'],
    premium: true, iq_score: 99, lat: 38.7223, lng: -9.1393,
    stops: [
      { name: 'Lisboa \u2014 Marchas', lat: 38.7223, lng: -9.1393, municipality: 'Lisboa', type: 'cidade' },
      { name: 'Porto \u2014 S\u00e3o Jo\u00e3o', lat: 41.1579, lng: -8.6291, municipality: 'Porto', type: 'cidade' },
    ],
  },
  {
    id: 'cr_fes_005', name: 'Rota das Festas de Inverno e Caretos', family: 'festas', sub_family: 'festas_inverno',
    region: 'Tr\u00e1s-os-Montes', municipalities: ['Podence', 'Lazarim', 'Vinhais'], unesco: true,
    unesco_label: 'Caretos de Podence \u2014 Patrim\u00f3nio Imaterial da Humanidade (2019)',
    description_short: 'Caretos, chocalhos e m\u00e1scaras ancestrais \u2014 os rituais de Inverno mais selvagens da Europa.',
    duration_days: 4, best_months: [12, 1, 2],
    instruments: ['chocalhos', 'gaita_de_foles'], dances: ['danca_caretos'],
    gastronomy: ['folar de carne', 'alheira', 'castanhas assadas'],
    costumes: ['fato de careto', 'm\u00e1scara de madeira'], festivals: ['Carnaval de Podence', 'Entrudo Chocalheiro'],
    premium: true, iq_score: 99, lat: 41.5572, lng: -6.9158,
    stops: [
      { name: 'Podence \u2014 Caretos UNESCO', lat: 41.5572, lng: -6.9158, municipality: 'Podence', type: 'aldeia' },
      { name: 'Lazarim \u2014 M\u00e1scaras', lat: 41.0500, lng: -7.8500, municipality: 'Lamego', type: 'aldeia' },
      { name: 'Vinhais \u2014 Entrudo', lat: 41.8333, lng: -7.0000, municipality: 'Vinhais', type: 'vila' },
    ],
  },
  {
    id: 'cr_tra_001', name: 'Rota dos Trajes do Norte', family: 'trajes', sub_family: 'trajes_norte',
    region: 'Minho', municipalities: ['Viana do Castelo', 'Braga', 'Miranda do Douro'],
    description_short: 'Do traje de dote vian\u00eas ao saiote mirand\u00eas \u2014 identidade portuguesa tecida em ouro.',
    duration_days: 3, best_months: [5, 6, 7, 8],
    instruments: [], dances: [],
    gastronomy: ['roj\u00f5es', 'posta mirandesa'],
    costumes: ['traje de dote vian\u00eas', 'traje mirand\u00eas'], festivals: ['Festa da Agonia (Viana)'],
    premium: true, iq_score: 95, lat: 41.6934, lng: -8.8301,
    stops: [
      { name: 'Viana \u2014 Museu do Traje', lat: 41.6934, lng: -8.8301, municipality: 'Viana do Castelo', type: 'museu' },
      { name: 'Miranda do Douro', lat: 41.5000, lng: -6.2747, municipality: 'Miranda do Douro', type: 'cidade' },
    ],
  },
  {
    id: 'cr_ins_001', name: 'Rota da Gaita-de-foles', family: 'instrumentos', sub_family: 'gaita_de_foles',
    region: 'Tr\u00e1s-os-Montes', municipalities: ['Miranda do Douro', 'Mogadouro', 'Ponte de Lima'],
    description_short: 'O sopro ancestral \u2014 a rota da gaita-de-foles, dos gaiteiros \u00e0s oficinas de constru\u00e7\u00e3o.',
    duration_days: 3, best_months: [6, 7, 8, 12],
    instruments: ['gaita_de_foles_transmontana', 'bombo', 'caixa'], dances: ['pauliteiros'],
    gastronomy: ['posta mirandesa', 'alheira'],
    costumes: ['traje de gaiteiro'], festivals: ['Festival Interc\u00e9ltico de Miranda'],
    premium: true, iq_score: 93, lat: 41.5000, lng: -6.2747,
    stops: [
      { name: 'Miranda do Douro', lat: 41.5000, lng: -6.2747, municipality: 'Miranda do Douro', type: 'sede_cultural' },
      { name: 'Ponte de Lima', lat: 41.7672, lng: -8.5842, municipality: 'Ponte de Lima', type: 'vila' },
    ],
  },
  {
    id: 'cr_ins_002', name: 'Rota das Violas Portuguesas', family: 'instrumentos', sub_family: 'violas',
    region: 'Minho', municipalities: ['Vila Verde', 'Amarante', 'Coimbra', 'Odemira'],
    description_short: 'Braguesa, amarantina, beiroa e campani\u00e7a \u2014 4 violas, 4 regi\u00f5es, uma alma portuguesa.',
    duration_days: 5, best_months: [4, 5, 6, 9, 10],
    instruments: ['viola_braguesa', 'viola_amarantina', 'viola_campanica'], dances: ['vira', 'chula'],
    gastronomy: ['vinho verde', 'migas alentejanas'],
    costumes: [], festivals: ['Encontro de Violas Tradicionais'],
    premium: true, iq_score: 94, lat: 41.6500, lng: -8.4333,
    stops: [
      { name: 'Vila Verde \u2014 Viola Braguesa', lat: 41.6500, lng: -8.4333, municipality: 'Vila Verde', type: 'oficina' },
      { name: 'Amarante \u2014 Viola Amarantina', lat: 41.2681, lng: -8.0742, municipality: 'Amarante', type: 'cidade' },
      { name: 'Odemira \u2014 Viola Campani\u00e7a', lat: 37.5964, lng: -8.6397, municipality: 'Odemira', type: 'vila' },
    ],
  },
  {
    id: 'cr_int_001', name: 'Grande Rota Cultural de Portugal', family: 'integradas', sub_family: 'grande_rota',
    region: 'Lisboa', municipalities: ['Lisboa', 'Porto', 'Coimbra', '\u00c9vora', 'Funchal'], unesco: true,
    unesco_label: 'M\u00faltiplos s\u00edtios UNESCO integrados',
    description_short: 'A grande rota que cruza m\u00fasica, dan\u00e7a, festas, trajes e gastronomia \u2014 14 dias por Portugal.',
    duration_days: 14, best_months: [5, 6, 7, 8, 9],
    instruments: ['guitarra_portuguesa', 'gaita_de_foles', 'adufe', 'brinquinho'],
    dances: ['vira', 'pauliteiros', 'chamarrita', 'fandango'],
    gastronomy: ['bacalhau', 'sardinhas', 'roj\u00f5es', 'cataplana', 'espetada'],
    costumes: ['traje de fadista', 'traje vian\u00eas', 'traje mirand\u00eas'],
    festivals: ['Caixa Alfama', 'S\u00e3o Jo\u00e3o do Porto', 'Carnaval de Podence'],
    premium: true, iq_score: 100, lat: 38.7223, lng: -9.1393,
    stops: [
      { name: 'Lisboa \u2014 Fado', lat: 38.7223, lng: -9.1393, municipality: 'Lisboa', type: 'cidade' },
      { name: 'Porto \u2014 S\u00e3o Jo\u00e3o', lat: 41.1579, lng: -8.6291, municipality: 'Porto', type: 'cidade' },
      { name: 'Viana \u2014 Trajes', lat: 41.6934, lng: -8.8301, municipality: 'Viana do Castelo', type: 'cidade' },
      { name: 'Miranda \u2014 Pauliteiros', lat: 41.5000, lng: -6.2747, municipality: 'Miranda do Douro', type: 'cidade' },
      { name: '\u00c9vora \u2014 Cante', lat: 38.5710, lng: -7.9093, municipality: '\u00c9vora', type: 'cidade_historica' },
      { name: 'Funchal \u2014 Bailinho', lat: 32.6500, lng: -16.9083, municipality: 'Funchal', type: 'cidade' },
    ],
  },
];

export default function RotasCulturais() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('todos');
  const [regionFilter, setRegionFilter] = useState<string>('Todas');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const unescoCount = ROUTES_DATA.filter((r) => r.unesco).length;

  const filtered = ROUTES_DATA.filter((r) => {
    const matchFamily = familyFilter === 'todos' || r.family === familyFilter;
    const matchRegion = regionFilter === 'Todas' || r.region.includes(regionFilter) ||
      r.municipalities.some((m) => m.toLowerCase().includes(regionFilter.toLowerCase()));
    return matchFamily && matchRegion;
  });

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleFamilyTab = (key: FamilyFilter) => {
    setFamilyFilter(key);
    setExpandedId(null);
  };

  const activeTab = FAMILY_TABS.find((t) => t.key === familyFilter);
  const activeColor = activeTab?.color || '#A855F7';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={C.accent} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Rotas Culturais</Text>
            <Text style={styles.headerSubtitle}>
              M&uacute;sica &middot; Dan&ccedil;a &middot; Festas &middot; Trajes &middot; Instrumentos
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="auto-awesome" size={20} color={C.accent} />
          </View>
        </View>

        {/* Premium Banner */}
        <View style={styles.premiumBanner}>
          <MaterialIcons name="star" size={18} color="#FCD34D" />
          <Text style={styles.premiumBannerText}>
            {ROUTES_DATA.length} rotas premium &middot; {unescoCount} UNESCO &middot; 6 fam&iacute;lias culturais
          </Text>
        </View>

        {/* Family Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {FAMILY_TABS.map((tab) => {
            const isActive = familyFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabChip,
                  isActive && { backgroundColor: tab.color, borderColor: tab.color },
                ]}
                onPress={() => handleFamilyTab(tab.key)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={14}
                  color={isActive ? '#FFFFFF' : C.textMed}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.tabChipLabel, isActive && styles.tabChipLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Region Filter */}
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

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, { backgroundColor: activeColor }]} />
          <Text style={styles.summaryText}>
            {filtered.length} rota{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Route List */}
        <View style={styles.listContainer}>
          {filtered.map((route) => (
            <CulturalRouteCard
              key={route.id}
              route={route}
              expanded={expandedId === route.id}
              onPress={() => handleCardPress(route.id!)}
            />
          ))}

          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="explore" size={40} color={C.textLight} />
              <Text style={styles.emptyStateTitle}>Sem rotas nesta categoria</Text>
              <Text style={styles.emptyStateText}>
                Tenta outra fam&iacute;lia ou regi&atilde;o para descobrir rotas culturais.
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={13} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Dados: DGPC &middot; UNESCO &middot; Munic&iacute;pios &middot; Conselho da Europa
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, gap: 12, backgroundColor: C.bg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.accent + '40',
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.textDark },
  headerSubtitle: { fontSize: 12, color: C.textMed, marginTop: 2, letterSpacing: 0.3 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center',
  },

  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10,
    backgroundColor: '#78350F20', borderWidth: 1, borderColor: '#F59E0B30',
  },
  premiumBannerText: { fontSize: 13, fontWeight: '600', color: '#FCD34D', flex: 1 },

  tabsScroll: { marginBottom: 4 },
  tabsContent: { paddingHorizontal: 20, gap: 8 },
  tabChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  tabChipLabel: { fontSize: 13, fontWeight: '600', color: C.textMed },
  tabChipLabelActive: { color: '#FFFFFF' },

  regionScroll: { marginBottom: 4, marginTop: 6 },
  regionContent: { paddingHorizontal: 20, gap: 6 },
  regionChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  regionChipActive: { backgroundColor: '#2A1A50', borderColor: '#4A2A80' },
  regionChipText: { fontSize: 12, fontWeight: '600', color: C.textMed },
  regionChipTextActive: { color: '#C4B5FD' },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, marginBottom: 12, marginTop: 10,
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryText: { fontSize: 12, color: C.textLight, fontWeight: '500' },

  listContainer: { paddingHorizontal: 16, gap: 12 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, gap: 12 },
  emptyStateTitle: { fontSize: 15, fontWeight: '700', color: C.textMed },
  emptyStateText: {
    fontSize: 13, color: C.textLight, textAlign: 'center', paddingHorizontal: 24, lineHeight: 19,
  },

  infoFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, marginTop: 28,
  },
  infoFooterText: {
    fontSize: 11, color: C.textLight, fontStyle: 'italic', flex: 1, lineHeight: 16,
  },
});
