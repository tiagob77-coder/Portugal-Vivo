/**
 * FloraSpeciesCard — card component for native/endemic Portuguese flora species
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FloraSpecies {
  id: string;
  scientific_name: string;
  common_name: string;
  status: 'endemica' | 'autocone' | 'introduzida' | 'protegida';
  endemism_level?: 'local' | 'nacional' | 'macaronesico' | 'iberico';
  region_main: string;
  habitats: string[];
  flowering_start_month: number;
  flowering_end_month: number;
  rarity_score: number;
  threat_status: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'DD';
  where_to_observe: string;
  curiosity?: string;
  description_short: string;
  description_long?: string;
  legal_protection?: string[];
  iq_score?: number;
  distance_km?: number;
}

interface FloraSpeciesCardProps {
  species: FloraSpecies;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<FloraSpecies['status'], string> = {
  endemica:   '#16A34A',
  autocone:   '#65A30D',
  introduzida:'#CA8A04',
  protegida:  '#0369A1',
};

const STATUS_ICON: Record<FloraSpecies['status'], React.ComponentProps<typeof MaterialIcons>['name']> = {
  endemica:   'eco',
  autocone:   'nature',
  introduzida:'swap-horiz',
  protegida:  'shield',
};

const STATUS_LABEL: Record<FloraSpecies['status'], string> = {
  endemica:   'Endémica',
  autocone:   'Autocone',
  introduzida:'Introduzida',
  protegida:  'Protegida',
};

const THREAT_COLOR: Record<FloraSpecies['threat_status'], string> = {
  LC: '#16A34A',
  NT: '#65A30D',
  VU: '#CA8A04',
  EN: '#EA580C',
  CR: '#DC2626',
  DD: '#6B7280',
};

const MONTH_SHORT = ['J','F','M','A','M','J','J','A','S','O','N','D'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FloraSpeciesCard({ species, expanded = false, onPress }: FloraSpeciesCardProps) {
  const accentColor = STATUS_COLOR[species.status];
  const { colors } = useTheme();
  const statusIcon  = STATUS_ICON[species.status];

  const currentMonth = new Date().getMonth() + 1; // 1-12

  const isFlowering = (month: number): boolean => {
    const s = species.flowering_start_month;
    const e = species.flowering_end_month;
    if (s <= e) return month >= s && month <= e;
    // wraps year (e.g. Nov-Feb)
    return month >= s || month <= e;
  };

  const rarityColor =
    species.rarity_score > 80 ? '#DC2626' :
    species.rarity_score > 60 ? '#D97706' :
    '#16A34A';

  const visibleHabitats = species.habitats.slice(0, 3);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: accentColor, backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: accentColor + '20' }]}>
          <MaterialIcons name={statusIcon} size={20} color={accentColor} />
        </View>

        {/* Names */}
        <View style={styles.namesBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.commonName, { color: colors.textPrimary }]} numberOfLines={1}>{species.common_name}</Text>
            {species.status === 'endemica' && (
              <View style={styles.goldBadge}>
                <Text style={styles.goldBadgeText}>Endémica</Text>
              </View>
            )}
          </View>
          <Text style={[styles.scientificName, { color: colors.textMuted }]} numberOfLines={1}>{species.scientific_name}</Text>
        </View>

        {/* Rarity score badge */}
        <View style={[styles.rarityBadge, { backgroundColor: rarityColor + '20' }]}>
          <Text style={[styles.rarityScore, { color: rarityColor }]}>{species.rarity_score}</Text>
          <Text style={[styles.rarityLabel, { color: rarityColor }]}>IQ</Text>
        </View>
      </View>

      {/* ── Badges row ──────────────────────────────────────────────────────── */}
      <View style={styles.badgesRow}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
          <Text style={[styles.statusBadgeText, { color: accentColor }]}>{STATUS_LABEL[species.status]}</Text>
        </View>

        {/* Threat status badge */}
        <View style={[styles.threatBadge, { backgroundColor: THREAT_COLOR[species.threat_status] + '18', borderColor: THREAT_COLOR[species.threat_status] + '40' }]}>
          <Text style={[styles.threatBadgeText, { color: THREAT_COLOR[species.threat_status] }]}>{species.threat_status}</Text>
        </View>

        {/* Region */}
        <View style={styles.regionChip}>
          <MaterialIcons name="place" size={10} color="#6B7280" />
          <Text style={[styles.regionText, { color: colors.textMuted }]} numberOfLines={1}>{species.region_main}</Text>
        </View>

        {/* Distance badge */}
        {species.distance_km !== undefined && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{species.distance_km.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* ── Description short ───────────────────────────────────────────────── */}
      <Text style={[styles.descShort, { color: colors.textSecondary }]} numberOfLines={expanded ? undefined : 2}>
        {species.description_short}
      </Text>

      {/* ── Flowering bar ───────────────────────────────────────────────────── */}
      <View style={styles.floweringSection}>
        <Text style={[styles.floweringLabel, { color: colors.textMuted }]}>Floração</Text>
        <View style={styles.floweringBar}>
          {MONTH_SHORT.map((m, idx) => {
            const month = idx + 1;
            const active = isFlowering(month);
            const isCurrent = month === currentMonth;
            return (
              <View
                key={month}
                style={[
                  styles.monthSquare,
                  active && styles.monthSquareActive,
                  isCurrent && styles.monthSquareCurrent,
                ]}
              >
                <Text style={[styles.monthSquareText, active && styles.monthSquareTextActive]}>
                  {m}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Habitat chips ───────────────────────────────────────────────────── */}
      <View style={styles.habitatRow}>
        {visibleHabitats.map((h) => (
          <View key={h} style={styles.habitatChip}>
            <Text style={styles.habitatChipText}>{h}</Text>
          </View>
        ))}
        {species.habitats.length > 3 && (
          <View style={styles.habitatChip}>
            <Text style={styles.habitatChipText}>+{species.habitats.length - 3}</Text>
          </View>
        )}
      </View>

      {/* ── Expanded content ────────────────────────────────────────────────── */}
      {expanded && (
        <View style={styles.expandedBlock}>
          {/* Curiosity blockquote */}
          {species.curiosity ? (
            <View style={styles.curiosityBlock}>
              <View style={styles.curiosityBar} />
              <Text style={styles.curiosityText}>{species.curiosity}</Text>
            </View>
          ) : null}

          {/* Long description */}
          {species.description_long ? (
            <Text style={styles.descLong}>{species.description_long}</Text>
          ) : null}

          {/* Where to observe */}
          <View style={styles.observeRow}>
            <MaterialIcons name="location-on" size={14} color="#16A34A" />
            <Text style={styles.observeText}>{species.where_to_observe}</Text>
          </View>

          {/* Legal protection chips */}
          {species.legal_protection && species.legal_protection.length > 0 && (
            <View style={styles.legalRow}>
              <MaterialIcons name="gavel" size={12} color="#0369A1" />
              {species.legal_protection.map((law) => (
                <View key={law} style={styles.legalChip}>
                  <Text style={styles.legalChipText}>{law}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Expand indicator ────────────────────────────────────────────────── */}
      <View style={styles.expandRow}>
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={18}
          color="#6B7280"
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#041E0D',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  namesBlock: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  commonName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E8F5E9',
    flexShrink: 1,
  },
  scientificName: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#6B9E73',
  },
  rarityBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    flexShrink: 0,
  },
  rarityScore: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  rarityLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Gold badge
  goldBadge: {
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  goldBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Badges row
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  threatBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  threatBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF10',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  regionText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  distanceBadge: {
    backgroundColor: '#22C55E20',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  distanceText: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '600',
  },

  // Description
  descShort: {
    fontSize: 13,
    color: '#A7C4A9',
    lineHeight: 19,
    marginBottom: 12,
  },

  // Flowering bar
  floweringSection: {
    marginBottom: 10,
    gap: 5,
  },
  floweringLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B9E73',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  floweringBar: {
    flexDirection: 'row',
    gap: 3,
  },
  monthSquare: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 4,
    backgroundColor: '#FFFFFF0D',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
  },
  monthSquareActive: {
    backgroundColor: '#16A34A',
  },
  monthSquareCurrent: {
    borderWidth: 1.5,
    borderColor: '#22C55E',
  },
  monthSquareText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#4B7A52',
  },
  monthSquareTextActive: {
    color: '#FFFFFF',
  },

  // Habitats
  habitatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 6,
  },
  habitatChip: {
    backgroundColor: '#16A34A18',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#16A34A30',
  },
  habitatChipText: {
    fontSize: 11,
    color: '#4ADE80',
    fontWeight: '500',
  },

  // Expanded
  expandedBlock: {
    marginTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF0F',
    paddingTop: 12,
  },
  curiosityBlock: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#16A34A10',
    borderRadius: 8,
    padding: 10,
  },
  curiosityBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#16A34A',
    flexShrink: 0,
  },
  curiosityText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: '#86EFAC',
    lineHeight: 19,
  },
  descLong: {
    fontSize: 13,
    color: '#A7C4A9',
    lineHeight: 20,
  },
  observeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#22C55E10',
    borderRadius: 8,
    padding: 9,
  },
  observeText: {
    flex: 1,
    fontSize: 12,
    color: '#86EFAC',
    lineHeight: 18,
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  legalChip: {
    backgroundColor: '#0369A118',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#0369A130',
  },
  legalChipText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '500',
  },

  // Expand row
  expandRow: {
    alignItems: 'center',
    marginTop: 6,
  },
});
