/**
 * FaunaSpeciesCard — card component for Portuguese wildlife species
 */
import { palette } from '../theme/colors';
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FaunaSpecies {
  id: string;
  scientific_name: string;
  common_name: string;
  class: 'ave' | 'mamifero' | 'reptil' | 'anfibio' | 'peixe' | 'invertebrado' | 'raca_autocone';
  region_main: string;
  habitats: string[];
  rarity_level: 'Comum' | 'Incomum' | 'Raro' | 'Epico';
  rarity_score: number;
  threat_status: 'LC' | 'NT' | 'VU' | 'EN' | 'CR';
  endemism_level?: string;
  is_flagship?: boolean;
  best_season: string;
  best_time_of_day?: 'manha' | 'tarde' | 'noturno' | 'qualquer';
  description_short: string;
  description_long?: string;
  best_spot_description?: string;
  observation_tips?: string;
  tag_endemic?: boolean;
  tag_in_danger?: boolean;
  iq_score?: number;
  distance_km?: number;
}

interface FaunaSpeciesCardProps {
  species: FaunaSpecies;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const CLASS_COLOR: Record<FaunaSpecies['class'], string> = {
  ave:          '#0EA5E9',
  mamifero:     '#B45309',
  reptil:       '#16A34A',
  anfibio:      '#0D9488',
  peixe:        '#2563EB',
  invertebrado: '#7C3AED',
  raca_autocone:'#D97706',
};

const CLASS_ICON: Record<FaunaSpecies['class'], React.ComponentProps<typeof MaterialIcons>['name']> = {
  ave:          'air',
  mamifero:     'pets',
  reptil:       'bug-report',
  anfibio:      'water',
  peixe:        'set-meal',
  invertebrado: 'bug-report',
  raca_autocone:'agriculture',
};

const CLASS_LABEL_KEY: Record<FaunaSpecies['class'], string> = {
  ave:          'modulesNature.faunaCard.classes.ave',
  mamifero:     'modulesNature.faunaCard.classes.mamifero',
  reptil:       'modulesNature.faunaCard.classes.reptil',
  anfibio:      'modulesNature.faunaCard.classes.anfibio',
  peixe:        'modulesNature.faunaCard.classes.peixe',
  invertebrado: 'modulesNature.faunaCard.classes.invertebrado',
  raca_autocone:'modulesNature.faunaCard.classes.racaAutoctone',
};

const RARITY_LABEL_KEY: Record<FaunaSpecies['rarity_level'], string> = {
  Comum:   'modulesNature.faunaCard.rarity.comum',
  Incomum: 'modulesNature.faunaCard.rarity.incomum',
  Raro:    'modulesNature.faunaCard.rarity.raro',
  Epico:   'modulesNature.faunaCard.rarity.epico',
};

const RARITY_COLOR: Record<FaunaSpecies['rarity_level'], string> = {
  Comum:   '#6B7280',
  Incomum: '#2563EB',
  Raro:    '#D97706',
  Epico:   '#DC2626',
};

const THREAT_COLOR: Record<FaunaSpecies['threat_status'], string> = {
  LC: '#16A34A',
  NT: '#65A30D',
  VU: '#CA8A04',
  EN: '#EA580C',
  CR: '#DC2626',
};

const TIME_LABEL_KEY: Record<NonNullable<FaunaSpecies['best_time_of_day']>, string> = {
  manha:    'modulesNature.faunaCard.times.manha',
  tarde:    'modulesNature.faunaCard.times.tarde',
  noturno:  'modulesNature.faunaCard.times.noturno',
  qualquer: 'modulesNature.faunaCard.times.qualquer',
};

const TIME_ICON: Record<NonNullable<FaunaSpecies['best_time_of_day']>, React.ComponentProps<typeof MaterialIcons>['name']> = {
  manha:    'wb-sunny',
  tarde:    'wb-cloudy',
  noturno:  'nightlight',
  qualquer: 'schedule',
};

// ─── Component ────────────────────────────────────────────────────────────────

function FaunaSpeciesCard({ species, expanded = false, onPress }: FaunaSpeciesCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const accentColor  = CLASS_COLOR[species.class];
  const classIcon    = CLASS_ICON[species.class];
  const rarityColor  = RARITY_COLOR[species.rarity_level];

  const visibleHabitats = species.habitats.slice(0, 3);
  const classLabelKey   = CLASS_LABEL_KEY[species.class];
  const rarityLabelKey  = RARITY_LABEL_KEY[species.rarity_level];
  const timeLabelKey    = species.best_time_of_day ? TIME_LABEL_KEY[species.best_time_of_day] : undefined;

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: accentColor, backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Class icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: accentColor + '20' }]}>
          <MaterialIcons name={classIcon} size={20} color={accentColor} />
        </View>

        {/* Names */}
        <View style={styles.namesBlock}>
          <Text style={[styles.commonName, { color: colors.textPrimary }]} numberOfLines={1}>{species.common_name}</Text>
          <Text style={[styles.scientificName, { color: colors.textMuted }]} numberOfLines={1}>{species.scientific_name}</Text>
        </View>

        {/* IQ / rarity score top-right */}
        {species.iq_score !== undefined && (
          <View style={[styles.iqBadge, { backgroundColor: accentColor + '20' }]}>
            <Text style={[styles.iqScore, { color: accentColor }]}>{species.iq_score}</Text>
            <Text style={[styles.iqLabel, { color: accentColor }]}>IQ</Text>
          </View>
        )}
      </View>

      {/* ── Tag badges ──────────────────────────────────────────────────────── */}
      <View style={styles.badgesRow}>
        {/* Class badge */}
        <View style={[styles.classBadge, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
          <Text style={[styles.classBadgeText, { color: accentColor }]}>{classLabelKey ? t(classLabelKey) : undefined}</Text>
        </View>

        {/* Rarity badge */}
        <View style={[styles.rarityBadge, { backgroundColor: rarityColor + '18', borderColor: rarityColor + '40' }]}>
          {species.rarity_level === 'Epico' && (
            <MaterialIcons name="star" size={10} color={rarityColor} />
          )}
          <Text style={[styles.rarityBadgeText, { color: rarityColor }]}>{rarityLabelKey ? t(rarityLabelKey) : species.rarity_level}</Text>
        </View>

        {/* Threat */}
        <View style={[styles.threatBadge, { backgroundColor: THREAT_COLOR[species.threat_status] + '18', borderColor: THREAT_COLOR[species.threat_status] + '40' }]}>
          <Text style={[styles.threatBadgeText, { color: THREAT_COLOR[species.threat_status] }]}>{species.threat_status}</Text>
        </View>

        {/* Endemic gold badge */}
        {species.tag_endemic && (
          <View style={styles.goldBadge}>
            <Text style={styles.goldBadgeText}>{t('modulesNature.faunaCard.endemic')}</Text>
          </View>
        )}

        {/* In danger red badge */}
        {species.tag_in_danger && (
          <View style={styles.dangerBadge}>
            <MaterialIcons name="warning" size={9} color="#FFFFFF" />
            <Text style={styles.dangerBadgeText}>{t('modulesNature.faunaCard.inDanger')}</Text>
          </View>
        )}

        {/* Flagship purple crown badge */}
        {species.is_flagship && (
          <View style={styles.flagshipBadge}>
            <MaterialIcons name="workspace-premium" size={10} color="#FFFFFF" />
            <Text style={styles.flagshipBadgeText}>{t('modulesNature.faunaCard.flagship')}</Text>
          </View>
        )}

        {/* Distance */}
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

      {/* ── Season + time chips ─────────────────────────────────────────────── */}
      <View style={styles.seasonRow}>
        <View style={styles.seasonChip}>
          <MaterialIcons name="calendar-today" size={11} color="#A16207" />
          <Text style={styles.seasonText}>{species.best_season}</Text>
        </View>
        {species.best_time_of_day && (
          <View style={styles.timeChip}>
            <MaterialIcons name={TIME_ICON[species.best_time_of_day]} size={11} color="#92400E" />
            <Text style={styles.timeText}>{timeLabelKey ? t(timeLabelKey) : undefined}</Text>
          </View>
        )}
        {/* Region */}
        <View style={styles.regionChip}>
          <MaterialIcons name="place" size={10} color="#6B7280" />
          <Text style={styles.regionText} numberOfLines={1}>{species.region_main}</Text>
        </View>
      </View>

      {/* ── Habitat chips ───────────────────────────────────────────────────── */}
      <View style={styles.habitatRow}>
        {visibleHabitats.map((h) => (
          <View key={h} style={styles.habitatChip}>
            <Text style={styles.habitatChipText}>{t(`modulesNature.habitats.${h}`, { defaultValue: h })}</Text>
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
          {species.description_long ? (
            <Text style={[styles.descLong, { color: colors.textSecondary }]}>{species.description_long}</Text>
          ) : null}

          {species.observation_tips ? (
            <View style={styles.tipsBlock}>
              <View style={styles.tipsHeader}>
                <MaterialIcons name="visibility" size={14} color="#D97706" />
                <Text style={styles.tipsTitle}>{t('modulesNature.faunaCard.observationTips')}</Text>
              </View>
              <Text style={styles.tipsText}>{species.observation_tips}</Text>
            </View>
          ) : null}

          {species.best_spot_description ? (
            <View style={styles.spotBlock}>
              <MaterialIcons name="location-on" size={14} color="#D97706" />
              <Text style={styles.spotText}>{species.best_spot_description}</Text>
            </View>
          ) : null}
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
    backgroundColor: '#1E1200',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 2,
    shadowColor: palette.black,
    shadowOpacity: 0.22,
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
  commonName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FEF3C7',
  },
  scientificName: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#A07040',
  },
  iqBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    flexShrink: 0,
  },
  iqScore: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  iqLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Badges row
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  classBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  classBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  rarityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  goldBadge: {
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  goldBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.white,
  },
  dangerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dangerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.white,
  },
  flagshipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  flagshipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.white,
  },
  distanceBadge: {
    backgroundColor: '#D9770620',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  distanceText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },

  // Description
  descShort: {
    fontSize: 13,
    color: '#C4A87A',
    lineHeight: 19,
    marginBottom: 12,
  },

  // Season + time
  seasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  seasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D9770618',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D9770630',
  },
  seasonText: {
    fontSize: 11,
    color: '#FCD34D',
    fontWeight: '500',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#92400E18',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#92400E30',
  },
  timeText: {
    fontSize: 11,
    color: '#FDE68A',
    fontWeight: '500',
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF08',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  regionText: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Habitats
  habitatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 6,
  },
  habitatChip: {
    backgroundColor: '#D9770618',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#D9770630',
  },
  habitatChipText: {
    fontSize: 11,
    color: '#FCD34D',
    fontWeight: '500',
  },

  // Expanded
  expandedBlock: {
    marginTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF0A',
    paddingTop: 12,
  },
  descLong: {
    fontSize: 13,
    color: '#C4A87A',
    lineHeight: 20,
  },
  tipsBlock: {
    backgroundColor: '#D9770612',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FCD34D',
  },
  tipsText: {
    fontSize: 13,
    color: '#C4A87A',
    lineHeight: 19,
  },
  spotBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#D9770612',
    borderRadius: 8,
    padding: 9,
  },
  spotText: {
    flex: 1,
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 18,
  },

  // Expand row
  expandRow: {
    alignItems: 'center',
    marginTop: 6,
  },
});

export default React.memo(FaunaSpeciesCard);
