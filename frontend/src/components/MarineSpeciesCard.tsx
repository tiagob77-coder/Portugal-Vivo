/**
 * MarineSpeciesCard — displays a Portuguese marine species with IUCN status,
 * season badge, activity months grid and expandable detail panel.
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MarineSpecies {
  id: string;
  scientific_name: string;
  common_name_pt: string;
  category: 'mammal' | 'seabird' | 'fish' | 'invertebrate' | 'plant' | 'reptile';
  iucn_status: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EX' | 'DD';
  region: string[];
  season: 'year-round' | 'winter' | 'summer' | 'spring' | 'autumn' | 'migration';
  activity_months: number[];
  description_short: string;
  curiosity?: string;
  habitat?: string;
  depth_range?: string;
  best_spots?: string[];
  photo_url?: string;
  iq_score?: number;
  distance_km?: number;
}

interface MarineSpeciesCardProps {
  species: MarineSpecies;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Color maps ───────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<MarineSpecies['category'], string> = {
  mammal:       '#0369A1',
  seabird:      '#0891B2',
  fish:         '#059669',
  invertebrate: '#7C3AED',
  plant:        '#16A34A',
  reptile:      '#B45309',
};

const CATEGORY_ICON: Record<MarineSpecies['category'], React.ComponentProps<typeof MaterialIcons>['name']> = {
  mammal:       'waves',
  seabird:      'air',
  fish:         'set-meal',
  invertebrate: 'bug-report',
  plant:        'eco',
  reptile:      'pest-control',
};

const IUCN_COLOR: Record<MarineSpecies['iucn_status'], string> = {
  LC: '#16A34A',
  NT: '#65A30D',
  VU: '#CA8A04',
  EN: '#EA580C',
  CR: '#DC2626',
  EX: '#6B7280',
  DD: '#9CA3AF',
};

const IUCN_LABEL: Record<MarineSpecies['iucn_status'], string> = {
  LC: 'LC',
  NT: 'NT',
  VU: 'VU',
  EN: 'EN',
  CR: 'CR',
  EX: 'EX',
  DD: 'DD',
};

const SEASON_ICON: Record<MarineSpecies['season'], React.ComponentProps<typeof MaterialIcons>['name']> = {
  'year-round': 'loop',
  winter:       'ac-unit',
  summer:       'wb-sunny',
  spring:       'local-florist',
  autumn:       'park',
  migration:    'flight',
};

const SEASON_LABEL: Record<MarineSpecies['season'], string> = {
  'year-round': 'Todo o ano',
  winter:       'Inverno',
  summer:       'Verão',
  spring:       'Primavera',
  autumn:       'Outono',
  migration:    'Migração',
};

const MONTH_ABBR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const CATEGORY_LABEL: Record<MarineSpecies['category'], string> = {
  mammal:       'Mamífero',
  seabird:      'Ave marinha',
  fish:         'Peixe',
  invertebrate: 'Invertebrado',
  plant:        'Planta',
  reptile:      'Réptil',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarineSpeciesCard({ species, expanded = false, onPress }: MarineSpeciesCardProps) {
  const { colors } = useTheme();
  const catColor = CATEGORY_COLOR[species.category];
  const currentMonth = new Date().getMonth() + 1;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { borderLeftColor: catColor, backgroundColor: colors.card }]}
    >
      {/* IQ score top-right */}
      {species.iq_score !== undefined && (
        <View style={[styles.iqBadge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.iqText, { color: colors.textMuted }]}>{species.iq_score}</Text>
        </View>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: catColor + '20' }]}>
          <MaterialIcons name={CATEGORY_ICON[species.category]} size={20} color={catColor} />
        </View>
        <View style={styles.nameBlock}>
          <Text style={[styles.commonName, { color: colors.textPrimary }]}>{species.common_name_pt}</Text>
          <Text style={[styles.scientificName, { color: colors.textMuted }]}>{species.scientific_name}</Text>
          <Text style={[styles.categoryLabel, { color: catColor }]}>
            {CATEGORY_LABEL[species.category]}
          </Text>
        </View>
      </View>

      {/* ── Badges row ─────────────────────────────────────────────────── */}
      <View style={styles.badgesRow}>
        {/* IUCN badge */}
        <View style={[styles.iucnBadge, { backgroundColor: IUCN_COLOR[species.iucn_status] + '22', borderColor: IUCN_COLOR[species.iucn_status] + '66' }]}>
          <Text style={[styles.iucnText, { color: IUCN_COLOR[species.iucn_status] }]}>
            IUCN {IUCN_LABEL[species.iucn_status]}
          </Text>
        </View>

        {/* Season badge */}
        <View style={[styles.seasonBadge, { backgroundColor: catColor + '15', borderColor: catColor + '40' }]}>
          <MaterialIcons name={SEASON_ICON[species.season]} size={11} color={catColor} />
          <Text style={[styles.seasonText, { color: catColor }]}>
            {SEASON_LABEL[species.season]}
          </Text>
        </View>

        {/* Distance badge */}
        {species.distance_km !== undefined && (
          <View style={styles.distanceBadge}>
            <MaterialIcons name="place" size={11} color="#B45309" />
            <Text style={styles.distanceText}>{species.distance_km.toFixed(0)} km</Text>
          </View>
        )}
      </View>

      {/* ── Activity months ────────────────────────────────────────────── */}
      <View style={styles.monthsRow}>
        {MONTH_ABBR.map((abbr, idx) => {
          const month = idx + 1;
          const isActive = species.activity_months.includes(month);
          const isCurrent = month === currentMonth;
          return (
            <View
              key={month}
              style={[
                styles.monthSquare,
                { backgroundColor: colors.surface },
                isActive && { backgroundColor: catColor },
                isCurrent && styles.monthSquareCurrent,
                isCurrent && isActive && { borderColor: '#FFFFFF' },
                isCurrent && !isActive && { borderColor: catColor },
              ]}
            >
              <Text style={[styles.monthLabel, { color: colors.textMuted }, isActive && styles.monthLabelActive]}>
                {abbr}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Expanded detail ────────────────────────────────────────────── */}
      {expanded && (
        <View style={styles.expandedSection}>
          <View style={[styles.divider, { backgroundColor: catColor + '30' }]} />

          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{species.description_short}</Text>

          {species.curiosity !== undefined && (
            <View style={[styles.curiosityBox, { borderLeftColor: catColor, backgroundColor: colors.surface }]}>
              <MaterialIcons name="lightbulb" size={13} color={catColor} />
              <Text style={[styles.curiosityText, { color: colors.textSecondary }]}>{species.curiosity}</Text>
            </View>
          )}

          {(species.habitat !== undefined || species.depth_range !== undefined) && (
            <View style={styles.metaGrid}>
              {species.habitat !== undefined && (
                <View style={styles.metaItem}>
                  <MaterialIcons name="terrain" size={13} color={colors.textMuted} />
                  <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Habitat</Text>
                  <Text style={[styles.metaValue, { color: colors.textSecondary }]}>{species.habitat}</Text>
                </View>
              )}
              {species.depth_range !== undefined && (
                <View style={styles.metaItem}>
                  <MaterialIcons name="water" size={13} color={colors.textMuted} />
                  <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Profundidade</Text>
                  <Text style={[styles.metaValue, { color: colors.textSecondary }]}>{species.depth_range}</Text>
                </View>
              )}
            </View>
          )}

          {species.best_spots !== undefined && species.best_spots.length > 0 && (
            <View style={styles.spotsSection}>
              <Text style={[styles.spotsLabel, { color: colors.textMuted }]}>Melhores locais</Text>
              <View style={styles.spotsChips}>
                {species.best_spots.map((spot) => (
                  <View key={spot} style={[styles.spotChip, { borderColor: catColor + '50' }]}>
                    <MaterialIcons name="place" size={11} color={catColor} />
                    <Text style={[styles.spotChipText, { color: catColor }]}>{spot}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {species.region.length > 0 && (
            <View style={styles.regionRow}>
              <MaterialIcons name="map" size={12} color="#94A3B8" />
              <Text style={styles.regionText}>{species.region.join(' · ')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Expand/collapse caret */}
      <View style={styles.caretRow}>
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={18}
          color="#64748B"
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0A2236',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 16,
    position: 'relative',
  },

  // IQ
  iqBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#1E3A52',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  iqText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingRight: 44,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  commonName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
    lineHeight: 20,
  },
  scientificName: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#64748B',
    lineHeight: 16,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Badges
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  iucnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  iucnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  seasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  seasonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#B4530922',
    borderWidth: 1,
    borderColor: '#B4530944',
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },

  // Months
  monthsRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },
  monthSquare: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 4,
    backgroundColor: '#1E3A52',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  monthSquareCurrent: {
    borderWidth: 2,
  },
  monthLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: '#475569',
  },
  monthLabelActive: {
    color: '#FFFFFF',
  },

  // Expanded
  expandedSection: {
    marginTop: 12,
    gap: 10,
  },
  divider: {
    height: 1,
    marginBottom: 2,
  },
  descriptionText: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
  curiosityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
    backgroundColor: '#0F2D45',
    borderRadius: 6,
  },
  curiosityText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
    flex: 1,
    fontStyle: 'italic',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flex: 1,
    gap: 3,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 12,
    color: '#94A3B8',
  },
  spotsSection: {
    gap: 6,
  },
  spotsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spotsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  spotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#071828',
  },
  spotChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  regionText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },

  // Caret
  caretRow: {
    alignItems: 'center',
    marginTop: 6,
  },
});
