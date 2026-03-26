/**
 * Cultura Marítima — maritime rituals, festivals and processions explorer
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaritimeCultureCard, { MaritimeEvent } from '../../src/components/MaritimeCultureCard';

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#020B18',
  card: '#041426',
  accent: '#F59E0B',
  accentLight: '#F59E0B20',
  textDark: '#F1F5F9',
  textMed: '#94A3B8',
  textLight: '#64748B',
  border: '#1E3A5F',
  headerFrom: '#020B18',
  blue: '#1D4ED8',
  blueLight: '#1D4ED820',
  upcoming: '#16A34A',
  upcomingLight: '#16A34A20',
};

// ─── Static Events Data ────────────────────────────────────────────────────────

const EVENTS_DATA: MaritimeEvent[] = [
  {
    id: 'agonia-viana',
    name: 'Festa da Nossa Senhora da Agonia',
    type: 'procissao_maritima',
    region: 'Minho',
    municipality: 'Viana do Castelo',
    date_start: 'Agosto (3ª semana)',
    date_end: '3 dias',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'A maior romaria do norte de Portugal com procissão fluvial iluminada e barcos engalanados no Lima.',
    description_long: 'Celebrada desde o século XVIII, a Festa da Agonia reúne centenas de milhar de peregrinos. O ponto alto é a procissão fluvial noturna com barcaças ornamentadas e fogos de artifício sobre o Rio Lima. O traje vianês e as ranchos folclóricos dão cor ao cortejo terrestre.',
    saint_or_symbol: 'Nossa Senhora da Agonia',
    boats_involved: 40,
    activities: ['Procissão fluvial', 'Ranchos folclóricos', 'Traje vianês', 'Fogos de artifício', 'Bodo dos pescadores'],
    gastronomy_links: ['Rojões à minhota', 'Papas de sarrabulho', 'Vinho Verde'],
    lat: 41.6931,
    lng: -8.8340,
    iq_score: 98,
  },
  {
    id: 'banho-santo-bartolomeu',
    name: 'Banho Santo de São Bartolomeu',
    type: 'banho_santo',
    region: 'Minho',
    municipality: 'Esposende',
    date_start: '24 de Agosto',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Ritual ancestral pré-cristão de imersão no mar ao amanhecer, sob a proteção de São Bartolomeu.',
    description_long: 'Uma das mais antigas tradições do litoral minhoto, o Banho Santo combina fé cristã e magia popular pré-romana. Na madrugada de 24 de agosto os devotos entram no Atlântico para se purificarem. Acredita-se que o mar neste dia cura doenças de pele e afasta o mau-olhado.',
    saint_or_symbol: 'São Bartolomeu',
    activities: ['Imersão ritual ao amanhecer', 'Missa na praia', 'Penitência', 'Procissão à beira-mar'],
    gastronomy_links: ['Caldeirada de peixe', 'Broa de milho'],
    lat: 41.5319,
    lng: -8.7802,
    iq_score: 91,
  },
  {
    id: 'bencao-bacalhoeiros-ilhavo',
    name: 'Bênção dos Bacalhoeiros',
    type: 'bencao_barcos',
    region: 'Centro',
    municipality: 'Ílhavo',
    date_start: 'Junho',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Cerimónia de bênção das embarcações de pesca do bacalhau antes da partida para os mares do Norte.',
    description_long: 'Ílhavo foi durante séculos o centro da frota bacalhoeira portuguesa. A cerimónia de bênção dos navios antes da partida para a Terra Nova e a Gronelândia é um ritual emocionante com missa, bênção do bispo e despedida das famílias no cais.',
    saint_or_symbol: 'Nossa Senhora da Boa Viagem',
    boats_involved: 12,
    activities: ['Bênção episcopal', 'Missa dos pescadores', 'Cortejo de bandeiras', 'Mostra de arte xávega'],
    gastronomy_links: ['Bacalhau à lagareiro', 'Caldeirada de bacalhau'],
    lat: 40.6013,
    lng: -8.6773,
    iq_score: 87,
  },
  {
    id: 'bencao-boa-viagem-matosinhos',
    name: 'Procissão de Nossa Senhora da Boa Viagem',
    type: 'procissao_maritima',
    region: 'Norte',
    municipality: 'Matosinhos',
    date_start: 'Junho (última semana)',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Impressionante procissão marítima com mais de 100 barcos ornamentados no mar de Matosinhos.',
    description_long: 'Uma das maiores procissões marítimas de Portugal, com a imagem da Nossa Senhora da Boa Viagem transportada em barcaça ricamente ornamentada, acompanhada por centenas de embarcações de pesca, veleiros e barcos de recreio. A procissão terrestre percorre a cidade com bandas filarmónicas e grupos folclóricos.',
    saint_or_symbol: 'Nossa Senhora da Boa Viagem',
    boats_involved: 120,
    activities: ['Procissão marítima', 'Cortejo terrestre', 'Fogo de artifício', 'Arraial popular'],
    gastronomy_links: ['Sardinhas assadas', 'Polvo à lagareiro', 'Super Bock'],
    lat: 41.1855,
    lng: -8.6961,
    iq_score: 93,
  },
  {
    id: 'festa-mar-matosinhos',
    name: 'Festa do Mar de Matosinhos',
    type: 'festa_mar',
    region: 'Norte',
    municipality: 'Matosinhos',
    date_start: 'Junho',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Festival gastronómico e cultural que celebra o mar, a pesca e as sardinhas grelhadas em ambiente de arraial.',
    description_long: 'A Festa do Mar é o grande arraial de Matosinhos, com música ao vivo, arraial popular, gastronomia piscatória e animação cultural. As sardinhas assadas na brasa são o ex-libris do evento, acompanhadas por vinho verde e pão de milho.',
    activities: ['Sardinhas na brasa', 'Música ao vivo', 'Arraial popular', 'Mercado de artesanato'],
    gastronomy_links: ['Sardinhas assadas', 'Camarão cozido', 'Polvo grelhado', 'Vinho Verde'],
    lat: 41.1870,
    lng: -8.6980,
    iq_score: 82,
  },
  {
    id: 'procissao-pescadores-nazare',
    name: 'Procissão dos Pescadores de Nazaré',
    type: 'procissao_maritima',
    region: 'Centro',
    municipality: 'Nazaré',
    date_start: 'Setembro (8 Set. — N. Sra. da Nazaré)',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Procissão solene em honra de Nossa Senhora da Nazaré, padroeira dos pescadores, com traje típico listrado.',
    description_long: 'A procissão integra as festas em honra de Nossa Senhora da Nazaré, padroeira dos pescadores. As mulheres vestem os sete saiões listados do traje típico nazareno. Os pescadores carregam a imagem da santa em andor ornamentado com redes e âncoras.',
    saint_or_symbol: 'Nossa Senhora da Nazaré',
    activities: ['Procissão com andor', 'Traje típico', 'Missa campal', 'Tourada'],
    gastronomy_links: ['Caldeirada de peixe nazarena', 'Filhoses', 'Percebes'],
    lat: 39.6013,
    lng: -9.0706,
    iq_score: 89,
  },
  {
    id: 'nossa-senhora-assuncao-povoa',
    name: 'Festa de Nossa Senhora da Assunção',
    type: 'festa_mar',
    region: 'Norte',
    municipality: 'Póvoa de Varzim',
    date_start: '15 de Agosto',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Festa maior da cidade com arraial, procissão ao mar e a tradicional queima de barcos votivos.',
    activities: ['Procissão ao mar', 'Queima de barcos', 'Arraial popular', 'Fogo de artifício'],
    gastronomy_links: ['Sopa de peixe', 'Arroz de lingueirão'],
    lat: 41.3813,
    lng: -8.7619,
    iq_score: 80,
  },
  {
    id: 'senhor-navegantes-aveiro',
    name: 'Romaria ao Senhor dos Navegantes',
    type: 'ritual_religioso',
    region: 'Centro',
    municipality: 'Aveiro',
    date_start: 'Agosto',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Romaria fluvial na Ria de Aveiro com moliceiros ornamentados e procissão pela laguna.',
    description_long: 'A romaria percorre a Ria de Aveiro em moliceiros ricamente ornamentados a flores e papel crepe. A imagem do Senhor dos Navegantes é transportada no barco principal, acompanhada por dezenas de embarcações tradicionais.',
    saint_or_symbol: 'Senhor dos Navegantes',
    boats_involved: 35,
    activities: ['Procissão fluvial', 'Moliceiros ornamentados', 'Bênção das embarcações', 'Regata de moliceiros'],
    gastronomy_links: ['Ovos moles', 'Caldeirada de enguias', 'Salicórnia'],
    lat: 40.6405,
    lng: -8.6538,
    iq_score: 88,
  },
  {
    id: 'santo-cristo-milagres-acores',
    name: 'Festas do Senhor Santo Cristo dos Milagres',
    type: 'ritual_religioso',
    region: 'Açores',
    municipality: 'Ponta Delgada',
    date_start: 'Maio (5º domingo após a Páscoa)',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'A maior manifestação religiosa dos Açores, com procissão solene e pétalas de flores nas ruas de Ponta Delgada.',
    description_long: 'As Festas do Senhor Santo Cristo dos Milagres são o maior evento religioso dos Açores e da diáspora açoriana. A procissão percorre ruas cobertas de pétalas de flores e hortênsias, com a imagem do Senhor transportada por irmandades vestidas de gala. Peregrinos de todo o mundo participam.',
    saint_or_symbol: 'Senhor Santo Cristo dos Milagres',
    activities: ['Procissão solene', 'Tapetes de flores', 'Missa pontifical', 'Iluminações', 'Concertos sacros'],
    gastronomy_links: ['Alcatra', 'Caldo de nabos', 'Queijadas da Vila'],
    lat: 37.7392,
    lng: -25.6690,
    iq_score: 96,
  },
  {
    id: 'arte-xavega-nazare',
    name: 'Tradição da Arte Xávega',
    type: 'tradicao_piscatoria',
    region: 'Centro',
    municipality: 'Nazaré',
    date_start: 'Verão (Junho – Setembro)',
    is_recurring: true,
    frequency: 'sazonal',
    description_short: 'Pesca artesanal milenar com redes arrastadas à mão da praia por bois ou tratores, uma das últimas tradições vivas do litoral.',
    description_long: 'A arte xávega é uma técnica de pesca de cerco arrastado desde terra, documentada em Portugal desde o século XV. Na Nazaré, pescadores lançam redes do mar com embarcações de proa alta e arrastam-nas para a praia. Antigamente puxadas por juntas de bois, hoje com tratores, mas mantendo a técnica original.',
    activities: ['Arrastão de redes', 'Lota do peixe', 'Demonstrações públicas', 'Visitas guiadas'],
    gastronomy_links: ['Peixe fresco na lota', 'Petingas fritas', 'Caldeirada'],
    lat: 39.6013,
    lng: -9.0706,
    iq_score: 85,
  },
  {
    id: 'procissao-fluvial-douro',
    name: 'Procissão Fluvial do Douro',
    type: 'procissao_maritima',
    region: 'Norte',
    municipality: 'Porto',
    date_start: 'Junho (festas de São João)',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Procissão fluvial no Douro integrada nas festividades de São João do Porto, com barcos rabelos iluminados.',
    description_long: 'No âmbito das Festas de São João, uma procissão fluvial percorre o Douro com barcos rabelos decorados e iluminados. A ponte D. Luís serve de pano de fundo para os fogos de artifício que encerram a celebração.',
    boats_involved: 25,
    activities: ['Barcos rabelos iluminados', 'Fogos do Douro', 'Música popular', 'Alminhas na ponte'],
    gastronomy_links: ['Tripas à moda do Porto', 'Francesinha', 'Vinho do Porto'],
    lat: 41.1399,
    lng: -8.6108,
    iq_score: 90,
  },
  {
    id: 'festas-mar-sesimbra',
    name: 'Festas do Mar de Sesimbra',
    type: 'festa_mar',
    region: 'Centro',
    municipality: 'Sesimbra',
    date_start: 'Agosto',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Festival de verão em Sesimbra com gastronomia piscatória, música e procissão ao mar no Atlântico.',
    activities: ['Procissão ao mar', 'Arraial popular', 'Concertos', 'Concurso de pesca'],
    gastronomy_links: ['Choco frito', 'Linguado grelhado', 'Polvo à lagareiro'],
    lat: 38.4436,
    lng: -9.0991,
    iq_score: 78,
  },
  {
    id: 'bencao-frota-olhao',
    name: 'Bênção da Frota Pesqueira de Olhão',
    type: 'bencao_barcos',
    region: 'Algarve',
    municipality: 'Olhão',
    date_start: 'Outubro',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Cerimónia de bênção das embarcações piscatórias de Olhão antes da temporada de outono-inverno.',
    boats_involved: 60,
    activities: ['Bênção episcopal', 'Desfile de barcos', 'Missa dos pescadores', 'Mercado de peixe'],
    gastronomy_links: ['Cataplana de marisco', 'Atum grelhado', 'Xerém'],
    lat: 37.0280,
    lng: -7.8404,
    iq_score: 83,
  },
  {
    id: 'sao-pedro-peniche',
    name: 'Festa de São Pedro',
    type: 'festa_mar',
    region: 'Centro',
    municipality: 'Peniche',
    date_start: '29 de Junho',
    is_recurring: true,
    frequency: 'anual',
    description_short: 'Celebração do padroeiro dos pescadores em Peniche, com missa, procissão ao cais e arraial na cidade.',
    description_long: 'São Pedro é celebrado em toda a costa portuguesa, mas em Peniche a festa adquire particular expressão dada a importância histórica da pesca. A procissão parte da Igreja de São Pedro e desce ao cais onde os barcos aguardam enfeitados. Segue arraial popular com sardinhada e música pimba.',
    saint_or_symbol: 'São Pedro',
    activities: ['Procissão ao cais', 'Bênção dos barcos', 'Sardinhada popular', 'Música ao vivo', 'Arraial'],
    gastronomy_links: ['Sardinhas assadas', 'Percebes de Peniche', 'Lagosta suada'],
    lat: 39.3558,
    lng: -9.3813,
    iq_score: 86,
  },
];

// ─── Tab Config ───────────────────────────────────────────────────────────────

type TypeFilter = 'todos' | MaritimeEvent['type'];

interface TypeTab {
  key: TypeFilter;
  label: string;
}

const TYPE_TABS: TypeTab[] = [
  { key: 'todos',               label: 'Todos'       },
  { key: 'procissao_maritima',  label: 'Procissões'  },
  { key: 'bencao_barcos',       label: 'Bênçãos'     },
  { key: 'festa_mar',           label: 'Festas'      },
  { key: 'ritual_religioso',    label: 'Rituais'     },
  { key: 'tradicao_piscatoria', label: 'Tradições'   },
];

const TYPE_COLORS: Record<TypeFilter, string> = {
  todos:               '#1D4ED8',
  procissao_maritima:  '#1D4ED8',
  bencao_barcos:       '#0369A1',
  festa_mar:           '#B45309',
  ritual_religioso:    '#7C3AED',
  tradicao_piscatoria: '#0F766E',
  banho_santo:         '#0891B2',
};

const REGIONS = ['Todos', 'Minho', 'Norte', 'Centro', 'Alentejo', 'Algarve', 'Açores', 'Madeira'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEventUpcoming(event: MaritimeEvent): boolean {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const dateStr = event.date_start.toLowerCase();
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  const eventMonth = monthNames.findIndex((m) => dateStr.includes(m));
  if (eventMonth === -1) return false;
  const diff = eventMonth - currentMonth;
  return diff >= 0 && diff <= 1;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CulturaMaritima() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [regionFilter, setRegionFilter] = useState<string>('Todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Compute upcoming events and mark them
  const eventsWithUpcoming: MaritimeEvent[] = EVENTS_DATA.map((e) => ({
    ...e,
    is_upcoming: isEventUpcoming(e),
  }));

  const upcomingCount = eventsWithUpcoming.filter((e) => e.is_upcoming).length;

  // Apply filters
  const filtered = eventsWithUpcoming.filter((e) => {
    const matchType = typeFilter === 'todos' || e.type === typeFilter;
    const matchRegion = regionFilter === 'Todos' || e.region === regionFilter;
    return matchType && matchRegion;
  });

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleTypeTab = (key: TypeFilter) => {
    setTypeFilter(key);
    setExpandedId(null);
  };

  const activeColor = TYPE_COLORS[typeFilter];

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
            <Text style={styles.headerTitle}>Cultura Marítima</Text>
            <Text style={styles.headerSubtitle}>Rituais · Festas · Procissões ao Mar</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="directions-boat" size={20} color={C.accent} />
          </View>
        </View>

        {/* ── Type Tabs ───────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {TYPE_TABS.map((tab) => {
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

        {/* ── Upcoming Banner ─────────────────────────────────────────────── */}
        {upcomingCount > 0 && (
          <View style={styles.upcomingBanner}>
            <MaterialIcons name="event" size={18} color="#7DD3FC" />
            <Text style={styles.upcomingBannerText}>
              {upcomingCount} evento{upcomingCount !== 1 ? 's' : ''} nos próximos 30 dias
            </Text>
          </View>
        )}

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, { backgroundColor: activeColor }]} />
          <Text style={styles.summaryText}>
            {filtered.length} evento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* ── Event List ──────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {filtered.map((event) => (
            <MaritimeCultureCard
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onPress={() => handleCardPress(event.id)}
            />
          ))}

          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="celebration" size={40} color={C.textLight} />
              <Text style={styles.emptyStateTitle}>Sem eventos nesta categoria</Text>
              <Text style={styles.emptyStateText}>
                Tenta outro tipo ou região para descobrir a cultura marítima portuguesa.
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={13} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Dados: DGPC · Municípios · Associações de Pescadores
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
    backgroundColor: '#1E3A5F',
    borderColor: '#2D5080',
  },
  regionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMed,
  },
  regionChipTextActive: {
    color: '#7DD3FC',
  },

  // Upcoming Banner
  upcomingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#1D4ED820',
    borderWidth: 1,
    borderColor: '#1D4ED840',
  },
  upcomingBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7DD3FC',
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
