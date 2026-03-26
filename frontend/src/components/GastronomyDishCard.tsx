/**
 * GastronomyDishCard — rich card for Portuguese coastal gastronomy dishes
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoastalDish {
  id: string;
  name: string;
  slug?: string;
  region: string;
  municipality?: string;
  type: 'peixe' | 'marisco' | 'sopa' | 'doce' | 'tradicional' | 'misto';
  recipe_type: 'guisado' | 'assado' | 'frito' | 'escabeche' | 'caldeirada' | 'cru' | 'fumado';
  species_related?: { name: string; scientific: string; role: 'principal' | 'acompanhamento' }[];
  seasonality?: { start_month: number; end_month: number };
  story_short: string;
  story_long?: string;
  ingredients?: string[];
  best_restaurants?: string[];
  environmental_status?: 'seguro' | 'moderado' | 'risco';
  reliability_score?: number;
  iq_score?: number;
  distance_km?: number;
  photo_url?: string;
}

interface GastronomyDishCardProps {
  dish: CoastalDish;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#1C0F00',
  card: '#2D1A00',
  cardBorder: '#3D2400',
  peixe: '#0369A1',
  marisco: '#B45309',
  sopa: '#7C3AED',
  doce: '#DB2777',
  tradicional: '#B91C1C',
  misto: '#0F766E',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  green: '#059669',
  red: '#DC2626',
  textDark: '#FEF3C7',
  textMed: '#D6B896',
  textLight: '#A87D52',
  white: '#FFFFFF',
};

// ─── Config Maps ──────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<CoastalDish['type'], string> = {
  peixe:      C.peixe,
  marisco:    C.marisco,
  sopa:       C.sopa,
  doce:       C.doce,
  tradicional: C.tradicional,
  misto:      C.misto,
};

const TYPE_ICON: Record<CoastalDish['type'], React.ComponentProps<typeof MaterialIcons>['name']> = {
  peixe:      'set-meal',
  marisco:    'cruelty-free',
  sopa:       'soup-kitchen',
  doce:       'cake',
  tradicional: 'restaurant',
  misto:      'local-dining',
};

const TYPE_LABEL: Record<CoastalDish['type'], string> = {
  peixe:      'Peixe',
  marisco:    'Marisco',
  sopa:       'Sopa',
  doce:       'Doce',
  tradicional: 'Tradicional',
  misto:      'Misto',
};

const RECIPE_LABEL: Record<CoastalDish['recipe_type'], string> = {
  guisado:    'Guisado',
  assado:     'Assado',
  frito:      'Frito',
  escabeche:  'Escabeche',
  caldeirada: 'Caldeirada',
  cru:        'Cru',
  fumado:     'Fumado',
};

const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const ENV_CONFIG: Record<string, { label: string; color: string }> = {
  seguro:   { label: 'Espécie Segura',  color: C.green },
  moderado: { label: 'Moderado',        color: C.amber },
  risco:    { label: 'Em Risco',        color: C.red },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isInSeason(seasonality: CoastalDish['seasonality'], month: number): boolean {
  if (!seasonality) return false;
  const { start_month, end_month } = seasonality;
  if (start_month <= end_month) return month >= start_month && month <= end_month;
  // wraps year (e.g. Nov–Mar)
  return month >= start_month || month <= end_month;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GastronomyDishCard({ dish, expanded = false, onPress }: GastronomyDishCardProps) {
  const currentMonth = new Date().getMonth() + 1;
  const typeColor = TYPE_COLOR[dish.type];
  const typeIcon  = TYPE_ICON[dish.type];
  const envConf   = dish.environmental_status ? ENV_CONFIG[dish.environmental_status] : null;

  const visibleIngredients = dish.ingredients ? dish.ingredients.slice(0, 4) : [];
  const extraIngredients   = dish.ingredients ? Math.max(0, dish.ingredients.length - 4) : 0;
  const visibleSpecies     = dish.species_related ? dish.species_related.slice(0, 3) : [];

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: typeColor }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* ── IQ Score ─────────────────────────────────────────────────────── */}
      {dish.iq_score !== undefined && (
        <View style={[styles.iqBadge, { backgroundColor: typeColor + '22', borderColor: typeColor + '55' }]}>
          <Text style={[styles.iqText, { color: typeColor }]}>{Math.round(dish.iq_score * 100)}</Text>
          <Text style={[styles.iqLabel, { color: typeColor }]}>IQ</Text>
        </View>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={[styles.typeIconWrap, { backgroundColor: typeColor + '22' }]}>
          <MaterialIcons name={typeIcon} size={20} color={typeColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.dishName} numberOfLines={2}>{dish.name}</Text>
          <View style={styles.regionRow}>
            <MaterialIcons name="place" size={11} color={C.textLight} />
            <Text style={styles.regionText}>{dish.region}</Text>
            {dish.municipality && (
              <Text style={styles.municipalityText}> · {dish.municipality}</Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Recipe Type + Distance ────────────────────────────────────────── */}
      <View style={styles.badgeRow}>
        <View style={[styles.recipeBadge, { backgroundColor: typeColor + '18', borderColor: typeColor + '44' }]}>
          <Text style={[styles.recipeBadgeText, { color: typeColor }]}>
            {RECIPE_LABEL[dish.recipe_type]}
          </Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '18', borderColor: typeColor + '44' }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>
            {TYPE_LABEL[dish.type]}
          </Text>
        </View>
        {dish.distance_km !== undefined && (
          <View style={styles.distanceBadge}>
            <MaterialIcons name="directions" size={11} color={C.amber} />
            <Text style={styles.distanceText}>{dish.distance_km.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* ── Seasonality ──────────────────────────────────────────────────── */}
      {dish.seasonality && (
        <View style={styles.seasonRow}>
          <MaterialIcons name="calendar-today" size={11} color={C.textLight} />
          <View style={styles.monthGrid}>
            {MONTH_SHORT.map((m, idx) => {
              const month = idx + 1;
              const active  = isInSeason(dish.seasonality, month);
              const current = month === currentMonth;
              return (
                <View
                  key={month}
                  style={[
                    styles.monthCell,
                    active  && { backgroundColor: typeColor + '55', borderColor: typeColor },
                    current && styles.monthCellCurrent,
                  ]}
                >
                  <Text style={[styles.monthText, active && { color: typeColor }]}>{m}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Environmental Status ─────────────────────────────────────────── */}
      {envConf && (
        <View style={[styles.envBadge, { backgroundColor: envConf.color + '18', borderColor: envConf.color + '44' }]}>
          <MaterialIcons name="eco" size={12} color={envConf.color} />
          <Text style={[styles.envText, { color: envConf.color }]}>{envConf.label}</Text>
        </View>
      )}

      {/* ── Species Chips ────────────────────────────────────────────────── */}
      {visibleSpecies.length > 0 && (
        <View style={styles.speciesRow}>
          {visibleSpecies.map((sp) => (
            <View
              key={sp.scientific}
              style={[
                styles.speciesChip,
                sp.role === 'principal'
                  ? { backgroundColor: typeColor + '22', borderColor: typeColor }
                  : { backgroundColor: 'transparent', borderColor: typeColor + '55' },
              ]}
            >
              <Text style={[styles.speciesName, { color: typeColor }]}>{sp.name}</Text>
              {sp.role === 'principal' && (
                <View style={[styles.principalDot, { backgroundColor: typeColor }]} />
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Story Short ──────────────────────────────────────────────────── */}
      <Text style={styles.storyShort} numberOfLines={expanded ? undefined : 2}>
        {dish.story_short}
      </Text>

      {/* ── Ingredients ──────────────────────────────────────────────────── */}
      {visibleIngredients.length > 0 && (
        <View style={styles.ingredientsRow}>
          <MaterialIcons name="restaurant-menu" size={11} color={C.textLight} />
          <Text style={styles.ingredientsText}>
            {visibleIngredients.join(' · ')}
            {extraIngredients > 0 && ` +${extraIngredients} mais`}
          </Text>
        </View>
      )}

      {/* ── Expanded Content ─────────────────────────────────────────────── */}
      {expanded && (
        <View style={styles.expandedSection}>
          {dish.story_long && (
            <Text style={styles.storyLong}>{dish.story_long}</Text>
          )}

          {dish.best_restaurants && dish.best_restaurants.length > 0 && (
            <View style={styles.restaurantsBlock}>
              <View style={styles.sectionLabel}>
                <MaterialIcons name="star" size={12} color={C.amber} />
                <Text style={styles.sectionLabelText}>Melhores restaurantes</Text>
              </View>
              <View style={styles.restaurantChips}>
                {dish.best_restaurants.map((r) => (
                  <View key={r} style={styles.restaurantChip}>
                    <Text style={styles.restaurantChipText}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {dish.reliability_score !== undefined && (
            <View style={styles.reliabilityBlock}>
              <View style={styles.sectionLabel}>
                <MaterialIcons name="verified" size={12} color={C.textLight} />
                <Text style={styles.sectionLabelText}>
                  Fiabilidade: {Math.round(dish.reliability_score * 100)}%
                </Text>
              </View>
              <View style={styles.reliabilityBar}>
                <View
                  style={[
                    styles.reliabilityFill,
                    { width: `${Math.round(dish.reliability_score * 100)}%` as `${number}%`, backgroundColor: typeColor },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Expand Indicator ─────────────────────────────────────────────── */}
      <View style={styles.expandIndicator}>
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={16}
          color={C.textLight}
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderLeftWidth: 4,
    padding: 14,
    gap: 10,
    position: 'relative',
  },

  // IQ Badge
  iqBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: 'center',
  },
  iqText: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
  },
  iqLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 10,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 52,
  },
  typeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  dishName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textDark,
    lineHeight: 20,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  regionText: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: '500',
  },
  municipalityText: {
    fontSize: 11,
    color: C.textLight,
  },

  // Badges
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recipeBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  recipeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.amber + '55',
    backgroundColor: C.amber + '18',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.amber,
  },

  // Seasonality
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    flex: 1,
  },
  monthCell: {
    width: 28,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellCurrent: {
    borderWidth: 2,
    borderColor: C.amber,
  },
  monthText: {
    fontSize: 8,
    fontWeight: '600',
    color: C.textLight,
  },

  // Environmental
  envBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  envText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Species
  speciesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  speciesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  speciesName: {
    fontSize: 11,
    fontWeight: '600',
  },
  principalDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  // Story
  storyShort: {
    fontSize: 13,
    color: C.textMed,
    lineHeight: 19,
  },

  // Ingredients
  ingredientsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  ingredientsText: {
    fontSize: 11,
    color: C.textLight,
    flex: 1,
    lineHeight: 16,
  },

  // Expanded
  expandedSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    paddingTop: 10,
  },
  storyLong: {
    fontSize: 13,
    color: C.textMed,
    lineHeight: 20,
  },
  restaurantsBlock: {
    gap: 6,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionLabelText: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  restaurantChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  restaurantChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.amber + '44',
    backgroundColor: C.amber + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  restaurantChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: C.amber,
  },
  reliabilityBlock: {
    gap: 6,
  },
  reliabilityBar: {
    height: 5,
    backgroundColor: C.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  reliabilityFill: {
    height: 5,
    borderRadius: 3,
  },

  // Expand indicator
  expandIndicator: {
    alignItems: 'center',
    marginTop: -4,
  },
});
