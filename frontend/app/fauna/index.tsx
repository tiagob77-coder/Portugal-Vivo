/**
 * Atlas de Fauna — Portuguese wildlife, endemisms and observation routes explorer
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FaunaSpeciesCard, { FaunaSpecies } from '../../src/components/FaunaSpeciesCard';
import { getModuleTheme, withOpacity } from '../../src/theme/colors';

// ─── Colors (from centralized theme) ─────────────────────────────────────────

const MT = getModuleTheme('fauna');
const C = {
  bg:          MT.bg,
  card:        MT.card,
  accent:      MT.accent,
  accentLight: MT.accentMuted,
  textDark:    MT.textPrimary,
  textMed:     MT.textSecondary,
  textLight:   MT.textMuted,
  border:      '#3A2400',
  flagship:    MT.accent,
};

// ─── Static Data ──────────────────────────────────────────────────────────────

const FAUNA_DATA: FaunaSpecies[] = [
  {
    id: 'lobo-iberico',
    common_name: 'Lobo-ibérico',
    scientific_name: 'Canis lupus signatus',
    class: 'mamifero',
    region_main: 'Norte / Centro',
    habitats: ['montanha', 'floresta', 'estepes'],
    rarity_level: 'Raro',
    rarity_score: 85,
    threat_status: 'EN',
    tag_endemic: true,
    is_flagship: true,
    best_season: 'Inverno / Primavera',
    best_time_of_day: 'noturno',
    description_short: 'Subespécie ibérica distinta com marcas faciais características. Símbolo do Norte selvagem de Portugal.',
    description_long: 'A população portuguesa de lobo-ibérico ronda os 300 indivíduos, concentrada principalmente a norte do rio Douro. É protegida por lei desde 1988.',
    observation_tips: 'Visitar o Centro de Recuperação do Lobo Ibérico em Mafra, ou percorrer trilhos ao amanhecer na Serra da Peneda. Escutar uivos ao entardecer.',
    best_spot_description: 'Parque Nacional Peneda-Gerês e Serra da Malcata — áreas com alcateias residentes.',
    iq_score: 95,
  },
  {
    id: 'lince-iberico',
    common_name: 'Lince-ibérico',
    scientific_name: 'Lynx pardinus',
    class: 'mamifero',
    region_main: 'Alentejo / Algarve',
    habitats: ['montado', 'maquis', 'estepes'],
    rarity_level: 'Epico',
    rarity_score: 98,
    threat_status: 'CR',
    tag_in_danger: true,
    is_flagship: true,
    best_season: 'Inverno (Jan-Mar)',
    best_time_of_day: 'manha',
    description_short: 'O felino mais ameaçado do mundo. Reintroduzido em Portugal após extinção local, agora com população crescente no Alentejo.',
    description_long: 'Após a extinção em Portugal no início do século XX, o lince foi reintroduzido a partir de 2014 no Vale do Guadiana. A população portuguesa já ultrapassa os 150 indivíduos.',
    observation_tips: 'Contactar o ICNF para locais de avistamento autorizados. Parque Natural Vale do Guadiana é o melhor ponto.',
    best_spot_description: 'Vale do Guadiana, entre Mértola e Castro Verde — área de reintrodução oficial.',
    iq_score: 99,
  },
  {
    id: 'priolo',
    common_name: 'Priolo',
    scientific_name: 'Pyrrhula murina',
    class: 'ave',
    region_main: 'Açores',
    habitats: ['laurissilva', 'insular', 'altitude'],
    rarity_level: 'Epico',
    rarity_score: 97,
    threat_status: 'CR',
    tag_endemic: true,
    is_flagship: true,
    endemism_level: 'local',
    best_season: 'Primavera / Verão',
    best_time_of_day: 'manha',
    description_short: 'Pintainho vermelho-escarlate exclusivo da ilha de São Miguel nos Açores. Menos de 1000 indivíduos existem no mundo.',
    description_long: 'Dependente exclusivamente das florestas de laurissilva da ilha de São Miguel. A destruição do habitat nas últimas décadas reduziu drasticamente a sua população.',
    observation_tips: 'Reserva Florestal da Mata da Serreta, em São Miguel. Visita guiada recomendada ao amanhecer em abril-junho.',
    best_spot_description: 'Mata da Serreta e florestas de altitude de São Miguel, Açores.',
    iq_score: 98,
  },
  {
    id: 'lobo-marinho',
    common_name: 'Lobo-marinho-mediterrânico',
    scientific_name: 'Monachus monachus',
    class: 'mamifero',
    region_main: 'Madeira / Desertas',
    habitats: ['marinho', 'insular', 'litoral'],
    rarity_level: 'Epico',
    rarity_score: 99,
    threat_status: 'CR',
    tag_endemic: true,
    is_flagship: false,
    best_season: 'Todo o ano',
    best_time_of_day: 'qualquer',
    description_short: 'Um dos mamíferos marinhos mais raros do mundo. A colónia das Desertas é uma das últimas do Atlântico.',
    description_long: 'A população das Ilhas Desertas (Madeira) é uma das três últimas colónias do mundo desta foca mediterrânica. Protegida desde os anos 80 com acesso restrito.',
    observation_tips: 'Excursões de barco controladas pelo Parque Natural da Madeira. Avistamento não garantido — raridade extrema.',
    best_spot_description: 'Ilhas Desertas, Madeira — acesso restrito, apenas com autorização ICNF/PNM.',
    iq_score: 99,
  },
  {
    id: 'cegonha-preta',
    common_name: 'Cegonha-preta',
    scientific_name: 'Ciconia nigra',
    class: 'ave',
    region_main: 'Alentejo / Ribatejo',
    habitats: ['zonas_humidas', 'ripicola', 'floresta'],
    rarity_level: 'Raro',
    rarity_score: 78,
    threat_status: 'LC',
    best_season: 'Primavera / Verão (Mar-Ago)',
    best_time_of_day: 'manha',
    description_short: 'Prima discreta da cegonha-branca, toda negra com brilho metálico. Nidifica em penhascos junto a rios.',
    observation_tips: 'Observar às margens do Tejo e Guadiana em março-julho. Montes Claros e Mértola são pontos de observação excelentes.',
    best_spot_description: 'Margens do Tejo entre Santarém e Abrantes, e Vale do Guadiana junto a Mértola.',
    iq_score: 82,
  },
  {
    id: 'aguia-imperial',
    common_name: 'Águia-imperial-ibérica',
    scientific_name: 'Aquila adalberti',
    class: 'ave',
    region_main: 'Alentejo',
    habitats: ['montado', 'estepes', 'floresta'],
    rarity_level: 'Epico',
    rarity_score: 93,
    threat_status: 'EN',
    is_flagship: true,
    best_season: 'Inverno / Primavera',
    best_time_of_day: 'manha',
    description_short: 'A mais nobre das águias ibéricas. Manchas brancas nos ombros distinguem-na de outras águias.',
    description_long: 'Espécie endémica da Península Ibérica. Em Portugal, a população cresceu de 10 casais nos anos 1990 para mais de 60 atualmente graças a programas de conservação.',
    observation_tips: 'Montados de sobro e azinho no Alentejo. Observar postes elétricos e topos de sobreiros ao amanhecer.',
    best_spot_description: 'Planície alentejana entre Évora e Beja — maior densidade de casais nidificantes.',
    iq_score: 94,
  },
  {
    id: 'grou-comum',
    common_name: 'Grou-comum',
    scientific_name: 'Grus grus',
    class: 'ave',
    region_main: 'Alentejo',
    habitats: ['estepes', 'montado', 'campos'],
    rarity_level: 'Incomum',
    rarity_score: 60,
    threat_status: 'LC',
    best_season: 'Inverno (Nov-Fev)',
    best_time_of_day: 'manha',
    description_short: 'Ave migratória invernal que chega em grandes bandos ao Alentejo. As suas danças de acasalamento são espetaculares.',
    observation_tips: 'Campos abertos de Castro Verde em dezembro-janeiro. Os grouais dormem em açudes — observar ao amanhecer a partir.',
    best_spot_description: 'Castro Verde e Mourão — os maiores dormitórios invernais de grous em Portugal.',
    iq_score: 70,
  },
  {
    id: 'garrancho',
    common_name: 'Garrancho',
    scientific_name: 'Monticola solitarius',
    class: 'ave',
    region_main: 'Falésias costeiras',
    habitats: ['litoral', 'rochoso', 'falésias'],
    rarity_level: 'Incomum',
    rarity_score: 55,
    threat_status: 'LC',
    best_season: 'Primavera / Verão',
    best_time_of_day: 'manha',
    description_short: 'Macho azul-ardósia vistoso que habita falésias costeiras e penhascos rochosos. Canto melodioso inconfundível.',
    observation_tips: 'Procurar em falésias do Algarve e Costa Vicentina. Cantar no cume das rochas ao amanhecer.',
    best_spot_description: 'Falésias de Sagres, Carrapateira e Cabo Sardão.',
    iq_score: 65,
  },
  {
    id: 'salamandra-costas',
    common_name: 'Salamandra-de-costas-salientes',
    scientific_name: 'Chioglossa lusitanica',
    class: 'anfibio',
    region_main: 'Norte',
    habitats: ['zonas_humidas', 'ripicola', 'floresta'],
    rarity_level: 'Raro',
    rarity_score: 88,
    threat_status: 'VU',
    tag_endemic: true,
    endemism_level: 'iberico',
    best_season: 'Outono / Inverno (Out-Mar)',
    best_time_of_day: 'noturno',
    description_short: 'Única espécie do género, endémica noroeste ibérico. Corpo esguio com dorso dourado. Atividade noturna junto a ribeiros.',
    description_long: 'A mais bela salamandra europeia. Endémica do noroeste da Península Ibérica, limitada a ribeiros de montanha limpos e bem oxigenados.',
    observation_tips: 'Ribeiros nocturnos em outubro-março no Gerês e serras do Minho. Usar lanterna vermelha para não perturbar.',
    best_spot_description: 'Parque Nacional Peneda-Gerês, ribeiros de altitude acima dos 400 m.',
    iq_score: 90,
  },
  {
    id: 'cao-castro-laboreiro',
    common_name: 'Cão de Castro Laboreiro',
    scientific_name: 'Canis lupus familiaris (raça)',
    class: 'raca_autocone',
    region_main: 'Minho',
    habitats: ['montanha', 'pastagem'],
    rarity_level: 'Incomum',
    rarity_score: 65,
    threat_status: 'NT',
    is_flagship: true,
    best_season: 'Todo o ano',
    best_time_of_day: 'qualquer',
    description_short: 'Raça canina autóctone minhota com séculos de história como guardião de gado nas serras do Gerês.',
    description_long: 'Raça de cão pastor de grande porte, usado para proteger rebanhos de lobos. A sua presença no Castro Laboreiro é documentada desde o século XV.',
    observation_tips: 'Visitantes podem encontrá-lo em explorações tradicionais e feiras agrícolas do Minho.',
    best_spot_description: 'Castro Laboreiro e Alto Minho — habitat ancestral da raça.',
    iq_score: 72,
  },
  {
    id: 'cavalo-lusitano',
    common_name: 'Cavalo Lusitano',
    scientific_name: 'Equus caballus (raça)',
    class: 'raca_autocone',
    region_main: 'Ribatejo / Nacional',
    habitats: ['pastagem', 'campos'],
    rarity_level: 'Incomum',
    rarity_score: 70,
    threat_status: 'NT',
    is_flagship: true,
    best_season: 'Todo o ano',
    best_time_of_day: 'qualquer',
    description_short: 'Raça equina portuguesa de linhagem antiga, ancestral dos cavalos barrocos europeus. Elegância e inteligência excepcionais.',
    description_long: 'Uma das raças equinas mais antigas do mundo, com origem nos cavalos ibéricos pré-históricos. Reconhecido pela sua aptidão para a equitação de alta escola.',
    observation_tips: 'Coudelaria de Alter do Chão (fundada por D. João V em 1748) e haras do Ribatejo.',
    best_spot_description: 'Alter do Chão, Portalegre — Coudelaria Nacional com exemplares do mais alto nível.',
    iq_score: 80,
  },
  {
    id: 'borrelho-coleira',
    common_name: 'Borrelho-de-coleira-interrompida',
    scientific_name: 'Charadrius alexandrinus',
    class: 'ave',
    region_main: 'Dunas costeiras',
    habitats: ['litoral', 'dunas', 'marinho'],
    rarity_level: 'Raro',
    rarity_score: 75,
    threat_status: 'VU',
    best_season: 'Primavera (Mar-Jun, nidificação)',
    best_time_of_day: 'manha',
    description_short: 'Pequena ave limícola que nidifica diretamente na areia das praias. Altamente vulnerável a perturbação humana.',
    observation_tips: 'Respeitar as sinalizações de ninhos nas praias em março-junho. Observar na Ria Formosa e Tejo.',
    best_spot_description: 'Ria Formosa, lagoa de Santo André e estuário do Tejo.',
    iq_score: 78,
  },
  {
    id: 'lontra',
    common_name: 'Lontra-europeia',
    scientific_name: 'Lutra lutra',
    class: 'mamifero',
    region_main: 'Rios de Portugal',
    habitats: ['zonas_humidas', 'ripicola', 'rios'],
    rarity_level: 'Incomum',
    rarity_score: 62,
    threat_status: 'NT',
    best_season: 'Inverno / Primavera',
    best_time_of_day: 'noturno',
    description_short: 'Mustelídeo aquático elegante que habita rios limpos em todo o país. Portugal tem uma das maiores densidades da Europa.',
    observation_tips: 'Observar ao amanhecer e entardecer em rios com margens preservadas. Procurar pegadas na lama.',
    best_spot_description: 'Rio Minho, Douro e rios alentejanos — especialmente no Parque Natural Vale do Guadiana.',
    iq_score: 75,
  },
  {
    id: 'camaleao',
    common_name: 'Camaleão-comum',
    scientific_name: 'Chamaeleo chamaeleon',
    class: 'reptil',
    region_main: 'Algarve',
    habitats: ['maquis', 'litoral', 'pinhais'],
    rarity_level: 'Raro',
    rarity_score: 80,
    threat_status: 'NT',
    best_season: 'Primavera / Verão (Abr-Out)',
    best_time_of_day: 'tarde',
    description_short: 'O único camaleão selvagem da Península Ibérica. Habita pinhais e maquis costeiros do Algarve.',
    description_long: 'Introduzido ou nativo controverso em Portugal. Ocorre em Tavira, Faro e Costa Vicentina. Os olhos independentes e língua lançadeira são adaptações únicas.',
    observation_tips: 'Procurar lentamente em pinheiros e arbustos baixos ao final da tarde. Move-se muito devagar.',
    best_spot_description: 'Pinhal de Tavira, Ria Formosa e arredores de Faro.',
    iq_score: 83,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'todos' | 'aves' | 'mamiferos' | 'repteis' | 'racas' | 'epicos';
type HabitatKey = 'todos' | 'montanha' | 'humidas' | 'estepes' | 'laurissilva' | 'marinho';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}

interface HabitatFilter {
  key: HabitatKey;
  label: string;
}

const TABS: Tab[] = [
  { key: 'todos',    label: 'Todos',         icon: 'pets' },
  { key: 'aves',     label: 'Aves',          icon: 'air' },
  { key: 'mamiferos',label: 'Mamíferos',     icon: 'pets' },
  { key: 'repteis',  label: 'Répteis',       icon: 'bug-report' },
  { key: 'racas',    label: 'Raças Autóctones', icon: 'agriculture' },
  { key: 'epicos',   label: 'Épicos',        icon: 'star' },
];

const HABITAT_FILTERS: HabitatFilter[] = [
  { key: 'todos',       label: 'Todos' },
  { key: 'montanha',    label: 'Montanha' },
  { key: 'humidas',     label: 'Zonas Húmidas' },
  { key: 'estepes',     label: 'Estepes' },
  { key: 'laurissilva', label: 'Laurissilva' },
  { key: 'marinho',     label: 'Marinho' },
];

function filterByTab(data: FaunaSpecies[], tab: TabKey): FaunaSpecies[] {
  if (tab === 'todos')    return data;
  if (tab === 'aves')     return data.filter((s) => s.class === 'ave');
  if (tab === 'mamiferos')return data.filter((s) => s.class === 'mamifero');
  if (tab === 'repteis')  return data.filter((s) => s.class === 'reptil' || s.class === 'anfibio');
  if (tab === 'racas')    return data.filter((s) => s.class === 'raca_autocone');
  if (tab === 'epicos')   return data.filter((s) => s.rarity_level === 'Epico');
  return data;
}

function filterByHabitat(data: FaunaSpecies[], habitat: HabitatKey): FaunaSpecies[] {
  if (habitat === 'todos') return data;
  const map: Record<HabitatKey, string[]> = {
    todos:       [],
    montanha:    ['montanha', 'altitude'],
    humidas:     ['zonas_humidas', 'ripicola', 'rios'],
    estepes:     ['estepes', 'campos', 'montado'],
    laurissilva: ['laurissilva', 'insular'],
    marinho:     ['marinho', 'litoral', 'dunas'],
  };
  const keys = map[habitat];
  return data.filter((s) => s.habitats.some((h) => keys.includes(h)));
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FaunaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab]         = useState<TabKey>('todos');
  const [activeHabitat, setActiveHabitat] = useState<HabitatKey>('todos');
  const [expandedId, setExpandedId]       = useState<string | null>(null);

  const handleTabPress = (key: TabKey) => {
    setActiveTab(key);
    setExpandedId(null);
  };

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const tabFiltered     = filterByTab(FAUNA_DATA, activeTab);
  const filtered        = filterByHabitat(tabFiltered, activeHabitat);
  const flagshipCount   = FAUNA_DATA.filter((s) => s.is_flagship).length;

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
            <Text style={styles.headerTitle}>Atlas de Fauna</Text>
            <Text style={styles.headerSubtitle}>Vida Selvagem · Endemismos · Rotas de Observação</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="pets" size={20} color={C.accent} />
          </View>
        </View>

        {/* ── Flagship banner ─────────────────────────────────────────────── */}
        <View style={styles.flagshipBanner}>
          <MaterialIcons name="workspace-premium" size={16} color={C.flagship} />
          <Text style={styles.flagshipText}>
            Espécies emblemáticas:{' '}
            <Text style={styles.flagshipCount}>{flagshipCount} espécies bandeira</Text>
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

        {/* ── Habitat filter ──────────────────────────────────────────────── */}
        <View style={styles.habitatSection}>
          <View style={styles.habitatHeader}>
            <MaterialIcons name="terrain" size={12} color={C.textLight} />
            <Text style={styles.habitatHeaderText}>Filtrar por habitat</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.habitatChipsContent}
          >
            {HABITAT_FILTERS.map((hf) => {
              const isActive = activeHabitat === hf.key;
              return (
                <TouchableOpacity
                  key={hf.key}
                  style={[styles.habitatChip, isActive && styles.habitatChipActive]}
                  onPress={() => setActiveHabitat(hf.key)}
                >
                  <Text style={[styles.habitatChipText, isActive && styles.habitatChipTextActive]}>
                    {hf.label}
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
            <FaunaSpeciesCard
              key={species.id}
              species={species}
              expanded={expandedId === species.id}
              onPress={() => handleCardPress(species.id)}
            />
          ))}

          {/* Empty state */}
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="pets" size={40} color={C.textLight} />
              <Text style={styles.emptyStateTitle}>Sem espécies neste filtro</Text>
              <Text style={styles.emptyStateText}>
                Tente outra categoria ou habitat.
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Dados: ICNF · IUCN · Atlas das Aves · SEO/BirdLife
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

  // Flagship banner
  flagshipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#D9770618',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D9770630',
  },
  flagshipText: {
    fontSize: 13,
    color: C.textMed,
    flex: 1,
  },
  flagshipCount: {
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

  // Habitat filter
  habitatSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  habitatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  habitatHeaderText: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  habitatChipsContent: {
    gap: 6,
  },
  habitatChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  habitatChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  habitatChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  habitatChipTextActive: {
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
