/**
 * Gastronomia Costeira — pratos, tradições e sabores do mar português
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GastronomyDishCard, { CoastalDish } from '../../src/components/GastronomyDishCard';
import { getModuleTheme, withOpacity } from '../../src/theme/colors';

// ─── Colors (from centralized theme) ─────────────────────────────────────────

const MT = getModuleTheme('gastronomia');
const C = {
  bg: MT.bg,
  card: MT.card,
  cardBorder: '#3D2400',
  amber: MT.accent,
  amberLight: '#FEF3C7',
  terracotta: '#C2410C',
  peixe: '#0369A1',
  marisco: '#B45309',
  sopa: '#7C3AED',
  doce: '#DB2777',
  tradicional: '#B91C1C',
  misto: '#0F766E',
  textDark: MT.textPrimary,
  textMed: MT.textSecondary,
  textLight: MT.textMuted,
  white: '#FFFFFF',
};

// ─── Static Data ──────────────────────────────────────────────────────────────

const DISHES_DATA: CoastalDish[] = [
  {
    id: 'caldeirada-peixe',
    name: 'Caldeirada de Peixe',
    region: 'Setúbal / Lisboa',
    type: 'tradicional',
    recipe_type: 'caldeirada',
    species_related: [
      { name: 'Robalo', scientific: 'Dicentrarchus labrax', role: 'principal' },
      { name: 'Dourada', scientific: 'Sparus aurata', role: 'acompanhamento' },
      { name: 'Congro', scientific: 'Conger conger', role: 'acompanhamento' },
    ],
    story_short: 'O prato mais emblemático da costa portuguesa, com camadas de peixe, batata e tomate cozinhados em vinho branco.',
    story_long: 'A caldeirada nasceu nos barcos de pesca, onde os pescadores aproveitavam o peixe partido ou menos nobre para criar um guisado rico e perfumado. Cada região tem a sua versão — a de Setúbal leva congro e enguia; a algarvia, atum e tamboril.',
    ingredients: ['Robalo', 'Dourada', 'Congro', 'Batata', 'Tomate', 'Cebola', 'Vinho branco', 'Azeite'],
    best_restaurants: ['Tasca do Chico (Lisboa)', 'O Zé da Praia (Setúbal)', 'Mar à Vista (Sesimbra)'],
    environmental_status: 'seguro',
    reliability_score: 0.92,
    iq_score: 0.88,
  },
  {
    id: 'arroz-lingueirao',
    name: 'Arroz de Lingueirão',
    region: 'Algarve',
    type: 'marisco',
    recipe_type: 'guisado',
    species_related: [
      { name: 'Lingueirão', scientific: 'Ensis siliqua', role: 'principal' },
    ],
    seasonality: { start_month: 3, end_month: 8 },
    story_short: 'Arroz cremoso e perfumado com lingueirão da Ria Formosa, um petisco algarvi obrigatório na primavera.',
    ingredients: ['Lingueirão', 'Arroz carolino', 'Alho', 'Coentros', 'Vinho branco', 'Tomate'],
    best_restaurants: ['Casa Velha (Faro)', 'Marisqueira Rui (Portimão)'],
    environmental_status: 'moderado',
    reliability_score: 0.85,
    iq_score: 0.79,
  },
  {
    id: 'cataplana-mariscos',
    name: 'Cataplana de Mariscos',
    region: 'Algarve',
    type: 'misto',
    recipe_type: 'guisado',
    species_related: [
      { name: 'Amêijoa', scientific: 'Ruditapes decussatus', role: 'principal' },
      { name: 'Camarão', scientific: 'Penaeus kerathurus', role: 'acompanhamento' },
    ],
    story_short: 'Cozinhada no utensílio de cobre em forma de concha, a cataplana preserva todos os aromas do mar algarvi.',
    story_long: 'A cataplana é tanto o nome do utensílio como do prato. Introduzida pelos mouros há mais de 800 anos, a panela de cobre em forma de amêijoa sela os sabores do marisco, criando um vapor aromático que cozinha tudo perfeitamente.',
    ingredients: ['Amêijoa', 'Camarão', 'Mexilhão', 'Tomate', 'Pimento', 'Linguiça', 'Vinho branco'],
    best_restaurants: ['O Leão de Portimão', 'Marisqueira Central (Olhão)', 'Terra e Mar (Lagos)'],
    environmental_status: 'seguro',
    reliability_score: 0.90,
    iq_score: 0.84,
  },
  {
    id: 'polvo-lagareiro',
    name: 'Polvo à Lagareiro',
    region: 'Costa Portuguesa',
    type: 'peixe',
    recipe_type: 'assado',
    species_related: [
      { name: 'Polvo', scientific: 'Octopus vulgaris', role: 'principal' },
    ],
    story_short: 'Tentáculos de polvo assados no forno com batatas a murro, azeite e alho — simplicidade que sabe a Portugal.',
    ingredients: ['Polvo', 'Batata a murro', 'Azeite', 'Alho', 'Sal grosso', 'Cebola roxa'],
    best_restaurants: ['Cervejaria Ramiro (Lisboa)', 'O Manel (Cascais)', 'Aqui Há Peixe (Lisboa)'],
    environmental_status: 'seguro',
    reliability_score: 0.94,
    iq_score: 0.91,
  },
  {
    id: 'acorda-bacalhau',
    name: 'Açorda de Bacalhau',
    region: 'Lisboa / Alentejo',
    type: 'sopa',
    recipe_type: 'guisado',
    species_related: [
      { name: 'Bacalhau', scientific: 'Gadus morhua', role: 'principal' },
    ],
    story_short: 'Sopa espessa de pão alentejano com bacalhau desfiado, coentros e ovo escalfado — comfort food português por excelência.',
    story_long: 'A açorda nasceu da necessidade de aproveitar pão duro, transformando o que seria desperdício num prato rico e nutritivo. A versão com bacalhau é a mais popular em Lisboa, enquanto o Alentejo prefere a açorda de alho simples.',
    ingredients: ['Bacalhau', 'Pão alentejano', 'Coentros', 'Alho', 'Azeite', 'Ovo', 'Pimentão doce'],
    best_restaurants: ['Solar dos Presuntos (Lisboa)', 'Adega Machado (Lisboa)', 'O Telheiro (Évora)'],
    environmental_status: 'seguro',
    reliability_score: 0.89,
    iq_score: 0.82,
  },
  {
    id: 'ameijoas-bulhao-pato',
    name: 'Amêijoas à Bulhão Pato',
    region: 'Lisboa / Algarve',
    type: 'marisco',
    recipe_type: 'guisado',
    species_related: [
      { name: 'Amêijoa-boa', scientific: 'Ruditapes decussatus', role: 'principal' },
    ],
    story_short: 'Amêijoas abertas em azeite, alho, coentros e vinho branco — o petisco mais clássico da tasca portuguesa.',
    ingredients: ['Amêijoa-boa', 'Azeite', 'Alho', 'Coentros', 'Vinho branco', 'Limão'],
    best_restaurants: ['Cervejaria Trindade (Lisboa)', 'Solar dos Bacalhoeiros (Lisboa)', 'Marisqueira Rui (Portimão)'],
    environmental_status: 'moderado',
    reliability_score: 0.96,
    iq_score: 0.93,
  },
  {
    id: 'sapateira-recheada',
    name: 'Sapateira Recheada',
    region: 'Norte / Minho',
    type: 'marisco',
    recipe_type: 'cru',
    species_related: [
      { name: 'Sapateira', scientific: 'Cancer pagurus', role: 'principal' },
    ],
    seasonality: { start_month: 9, end_month: 3 },
    story_short: 'Caranguejo recheado com a sua própria carne misturada com mostarda, pickles e alcaparras — elegância dos mares do Norte.',
    ingredients: ['Sapateira', 'Mostarda', 'Pickles', 'Alcaparras', 'Mayonese', 'Whisky', 'Tabasco'],
    best_restaurants: ['O Escondidinho (Porto)', 'Marisqueira Ancora d\'Ouro (Viana)', 'Conga (Porto)'],
    environmental_status: 'seguro',
    reliability_score: 0.83,
    iq_score: 0.77,
  },
  {
    id: 'caldo-verde-ameijoas',
    name: 'Caldo Verde com Amêijoas',
    region: 'Minho',
    type: 'sopa',
    recipe_type: 'guisado',
    species_related: [
      { name: 'Amêijoa', scientific: 'Ruditapes decussatus', role: 'principal' },
    ],
    story_short: 'Versão marítima do caldo verde minhoto, onde as amêijoas substituem o chouriço para uma sopa do mar surpreendente.',
    ingredients: ['Couve galega', 'Batata', 'Amêijoa', 'Alho', 'Azeite', 'Coentros'],
    environmental_status: 'seguro',
    reliability_score: 0.78,
    iq_score: 0.72,
  },
  {
    id: 'filetes-choco-setubalense',
    name: 'Filetes de Choco à Setubalense',
    region: 'Setúbal',
    type: 'peixe',
    recipe_type: 'frito',
    species_related: [
      { name: 'Choco', scientific: 'Sepia officinalis', role: 'principal' },
    ],
    story_short: 'Filetes de choco panados e fritos, servidos com arroz de choco na tinta — especialidade obrigatória de Setúbal.',
    story_long: 'O choco é o rei de Setúbal. Os filetes são a preparação mais popular, mas a tinta do choco não se desperdiça — é aproveitada para um arroz negro que acompanha o prato. Diz-se que o prato foi popularizado pelos pescadores da Arrábida.',
    ingredients: ['Choco', 'Farinha', 'Ovo', 'Pão ralado', 'Limão', 'Arroz', 'Tinta de choco'],
    best_restaurants: ['O Beco (Setúbal)', 'A Tasquinha (Setúbal)', 'Marisqueira Farol (Sesimbra)'],
    environmental_status: 'seguro',
    reliability_score: 0.91,
    iq_score: 0.86,
  },
  {
    id: 'percebes-peniche',
    name: 'Percebes de Peniche',
    region: 'Oeste / Centro',
    type: 'marisco',
    recipe_type: 'cru',
    species_related: [
      { name: 'Percebe', scientific: 'Pollicipes pollicipes', role: 'principal' },
    ],
    story_short: 'Percebes colhidos nas rochas batidas pelo Atlântico em Peniche — sabor a mar puro que vale cada cêntimo.',
    ingredients: ['Percebe', 'Sal grosso', 'Louro', 'Água do mar'],
    best_restaurants: ['Tasca do Nanico (Peniche)', 'O Pescador (Peniche)', 'Tasca Beira Mar (Baleal)'],
    environmental_status: 'risco',
    reliability_score: 0.87,
    iq_score: 0.80,
  },
  {
    id: 'sardinhas-assadas',
    name: 'Sardinhas Assadas',
    region: 'Costa Portuguesa',
    type: 'peixe',
    recipe_type: 'assado',
    species_related: [
      { name: 'Sardinha', scientific: 'Sardina pilchardus', role: 'principal' },
    ],
    seasonality: { start_month: 6, end_month: 9 },
    story_short: 'O ícone do verão português — sardinhas gordas de junho e julho assadas na brasa, servidas em pão de milho.',
    story_long: 'As sardinhas assadas são o símbolo das festas populares de junho em Lisboa e Porto. As melhores são as de junho e julho, quando estão mais gordas. A tradição diz que devem ser comidas ao ar livre, em papel de jornal, com um copo de vinho verde.',
    ingredients: ['Sardinha', 'Sal grosso', 'Pão de milho', 'Pimento assado', 'Azeite'],
    best_restaurants: ['A Tendinha (Lisboa)', 'Tasca do Chico (Lisboa)', 'Cervejaria Portuguesa (Porto)'],
    environmental_status: 'seguro',
    reliability_score: 0.97,
    iq_score: 0.95,
  },
  {
    id: 'lampreia-bordalesa',
    name: 'Lampreia à Bordalesa',
    region: 'Minho',
    type: 'peixe',
    recipe_type: 'guisado',
    species_related: [
      { name: 'Lampreia-de-rio', scientific: 'Petromyzon marinus', role: 'principal' },
    ],
    seasonality: { start_month: 1, end_month: 4 },
    story_short: 'Prato de inverno do Minho com lampreia cozinhada no seu próprio sangue com vinho tinto — iguaria medieval única.',
    story_long: 'A lampreia é um dos peixes mais antigos do mundo, com mais de 360 milhões de anos. No Minho, é capturada no rio Lima e Minho entre janeiro e abril. A receita à bordalesa é adaptada do estilo francês com vinho tinto e sangue do animal, criando um molho espesso e intenso.',
    ingredients: ['Lampreia', 'Vinho tinto', 'Sangue de lampreia', 'Cebola', 'Louro', 'Presunto', 'Arroz'],
    best_restaurants: ['Restaurante Camelo (Ponte de Lima)', 'O Ferreiro (Viana do Castelo)', 'Casa de Rodas (Braga)'],
    environmental_status: 'risco',
    reliability_score: 0.82,
    iq_score: 0.75,
  },
  {
    id: 'arroz-linguado-gambas',
    name: 'Arroz de Linguado com Gambas',
    region: 'Algarve',
    type: 'misto',
    recipe_type: 'guisado',
    species_related: [
      { name: 'Linguado', scientific: 'Solea solea', role: 'principal' },
      { name: 'Gamba', scientific: 'Aristeus antennatus', role: 'acompanhamento' },
    ],
    story_short: 'Arroz malandro algarvi com linguado delicado e gambas frescas, perfumado a açafrão e coentros.',
    ingredients: ['Linguado', 'Gamba', 'Arroz carolino', 'Açafrão', 'Coentros', 'Tomate', 'Vinho branco'],
    best_restaurants: ['Restaurante Henrique Leis (Almancil)', 'Quinta dos Amigos (Loulé)'],
    environmental_status: 'moderado',
    reliability_score: 0.84,
    iq_score: 0.78,
  },
  {
    id: 'queijadas-sintra-camarao',
    name: 'Queijadas de Sintra com Camarão',
    region: 'Sintra / Lisboa',
    type: 'doce',
    recipe_type: 'assado',
    story_short: 'Fusão criativa entre a queijada tradicional de Sintra e camarão da costa, uma reinvenção contemporânea do doce conventual.',
    story_long: 'As queijadas de Sintra têm receita secreta desde o século XIII. Esta versão contemporânea, criada por pasteleiros locais, incorpora camarão da costa de Cascais numa massa de requeijão, açúcar e canela, criando um contraste doce-salgado surpreendente.',
    ingredients: ['Requeijão', 'Açúcar', 'Canela', 'Massa folhada', 'Camarão', 'Limão', 'Coentros'],
    best_restaurants: ['Casa Piriquita (Sintra)', 'Garrett (Sintra)', 'Queijadas da Sapa (Sintra)'],
    environmental_status: 'seguro',
    reliability_score: 0.70,
    iq_score: 0.65,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryTab = 'todos' | CoastalDish['type'];

interface CategoryConf {
  key: CategoryTab;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
}

const CATEGORY_TABS: CategoryConf[] = [
  { key: 'todos',      label: 'Todos',       icon: 'local-dining',   color: C.amber       },
  { key: 'peixe',     label: 'Peixe',       icon: 'set-meal',       color: C.peixe       },
  { key: 'marisco',   label: 'Marisco',     icon: 'cruelty-free',   color: C.marisco     },
  { key: 'sopa',      label: 'Sopas',       icon: 'soup-kitchen',   color: C.sopa        },
  { key: 'doce',      label: 'Doces',       icon: 'cake',           color: C.doce        },
  { key: 'tradicional', label: 'Tradicionais', icon: 'restaurant',  color: C.tradicional },
];

const REGIONS = ['Todos', 'Minho', 'Norte', 'Centro', 'Alentejo', 'Algarve', 'Açores', 'Madeira'];

function isInSeason(dish: CoastalDish, month: number): boolean {
  if (!dish.seasonality) return true; // year-round
  const { start_month, end_month } = dish.seasonality;
  if (start_month <= end_month) return month >= start_month && month <= end_month;
  return month >= start_month || month <= end_month;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GastronomiaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeCategory, setActiveCategory] = useState<CategoryTab>('todos');
  const [activeRegion, setActiveRegion]   = useState('Todos');
  const [expandedId, setExpandedId]       = useState<string | null>(null);

  const currentMonth = new Date().getMonth() + 1;

  const handleCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter dishes
  const filteredDishes = DISHES_DATA.filter((d) => {
    const catMatch = activeCategory === 'todos' || d.type === activeCategory;
    const regMatch = activeRegion === 'Todos' || d.region.toLowerCase().includes(activeRegion.toLowerCase());
    return catMatch && regMatch;
  });

  // Count dishes in season this month
  const inSeasonCount = DISHES_DATA.filter((d) => isInSeason(d, currentMonth)).length;

  const activeCatConf = CATEGORY_TABS.find((c) => c.key === activeCategory)!;

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
            <MaterialIcons name="arrow-back" size={22} color={C.amber} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Gastronomia Costeira</Text>
            <Text style={styles.headerSubtitle}>Pratos · Tradições · Sabores do Mar</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="restaurant" size={20} color={C.amber} />
          </View>
        </View>

        {/* ── Seasonal Banner ─────────────────────────────────────────────── */}
        <View style={styles.seasonBanner}>
          <MaterialIcons name="wb-sunny" size={16} color={C.amber} />
          <Text style={styles.seasonBannerText}>
            Em época agora: <Text style={styles.seasonBannerCount}>{inSeasonCount} pratos</Text>
          </Text>
          <MaterialIcons name="chevron-right" size={16} color={C.amber} />
        </View>

        {/* ── Category Tabs ───────────────────────────────────────────────── */}
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
                  isActive && { backgroundColor: tab.color, borderColor: tab.color },
                ]}
                onPress={() => { setActiveCategory(tab.key); setExpandedId(null); }}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={14}
                  color={isActive ? C.white : C.textLight}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
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
          contentContainerStyle={styles.regionContent}
        >
          {REGIONS.map((region) => {
            const isActive = activeRegion === region;
            return (
              <TouchableOpacity
                key={region}
                style={[styles.regionChip, isActive && styles.regionChipActive]}
                onPress={() => { setActiveRegion(region); setExpandedId(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.regionText, isActive && styles.regionTextActive]}>
                  {region}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Summary Row ─────────────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryDot, { backgroundColor: activeCatConf.color }]} />
          <Text style={styles.summaryText}>
            {filteredDishes.length} prato{filteredDishes.length !== 1 ? 's' : ''} encontrado{filteredDishes.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* ── Dish List ───────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          {filteredDishes.map((dish) => (
            <GastronomyDishCard
              key={dish.id}
              dish={dish}
              expanded={expandedId === dish.id}
              onPress={() => handleCardPress(dish.id)}
            />
          ))}

          {/* Empty State */}
          {filteredDishes.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={40} color={C.textLight} />
              <Text style={styles.emptyTitle}>Nenhum prato encontrado</Text>
              <Text style={styles.emptyText}>
                Tente outra categoria ou região.
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            Dados: DGPC · DGRM · Associações de Pescadores
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
    backgroundColor: '#261200',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.amber + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.amber + '44',
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
    backgroundColor: C.amber + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Seasonal Banner
  seasonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: C.amber + '18',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.amber + '44',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  seasonBannerText: {
    flex: 1,
    fontSize: 13,
    color: C.textMed,
    fontWeight: '500',
  },
  seasonBannerCount: {
    fontWeight: '800',
    color: C.amber,
  },

  // Category Tabs
  tabsScroll: {
    marginTop: 12,
    marginBottom: 4,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
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
    borderColor: C.cardBorder,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textLight,
  },
  tabLabelActive: {
    color: C.white,
  },

  // Region filter
  regionContent: {
    paddingHorizontal: 16,
    gap: 6,
    paddingVertical: 8,
  },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  regionChipActive: {
    backgroundColor: C.terracotta + '22',
    borderColor: C.terracotta,
  },
  regionText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textLight,
  },
  regionTextActive: {
    color: C.terracotta,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 2,
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
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textMed,
  },
  emptyText: {
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
