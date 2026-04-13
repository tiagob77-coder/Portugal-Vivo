/**
 * InfrastructureCard — card for passadiços, pontes suspensas, ecovias, miradouros, torres e vias verdes
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Infrastructure {
  id: string;
  name: string;
  type: 'passadico' | 'ponte_suspensa' | 'ecovia' | 'miradouro' | 'torre_observacao' | 'via_verde';
  subtype?: string;
  region: string;
  municipality?: string;
  description_short: string;
  description_long?: string;
  length_m?: number;
  height_m?: number;
  difficulty?: 'facil' | 'media' | 'dificil';
  access_type: 'livre' | 'condicionado' | 'pago';
  is_accessible?: boolean;
  is_family_friendly?: boolean;
  is_dog_friendly?: boolean;
  best_season?: string[];
  opening_hours?: string;
  safety_restrictions?: string;
  lat: number;
  lng: number;
  iq_score?: number;
  distance_km?: number;
  photo_url?: string;
}

interface InfrastructureCardProps {
  item: Infrastructure;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface TypeConfig {
  color: string;
  bg: string;
  label: string;
  icon: MaterialIconName;
}

const TYPE_CONFIG: Record<Infrastructure['type'], TypeConfig> = {
  passadico:        { color: '#0369A1', bg: '#E0F2FE', label: 'Passadiço',       icon: 'directions-walk' },
  ponte_suspensa:   { color: '#7C3AED', bg: '#EDE9FE', label: 'Ponte Suspensa',  icon: 'link' },
  ecovia:           { color: '#16A34A', bg: '#DCFCE7', label: 'Ecovia',           icon: 'nature' },
  miradouro:        { color: '#D97706', bg: '#FEF3C7', label: 'Miradouro',        icon: 'landscape' },
  torre_observacao: { color: '#0F766E', bg: '#CCFBF1', label: 'Torre Observação', icon: 'cell-tower' },
  via_verde:        { color: '#059669', bg: '#D1FAE5', label: 'Via Verde',        icon: 'directions-bike' },
};

const ACCESS_CONFIG = {
  livre:        { label: 'Livre',        color: '#16A34A', bg: '#DCFCE7' },
  condicionado: { label: 'Condicionado', color: '#D97706', bg: '#FEF3C7' },
  pago:         { label: 'Pago',         color: '#DC2626', bg: '#FEE2E2' },
};

const DIFFICULTY_CONFIG = {
  facil:  { label: 'Fácil',   color: '#16A34A' },
  media:  { label: 'Média',   color: '#D97706' },
  dificil: { label: 'Difícil', color: '#DC2626' },
};

const C = {
  textDark: '#1C1917',
  textMed:  '#57534E',
  textLight: '#78716C',
  border:   '#E7E5E4',
  card:     '#FFFFFF',
  warning:  '#FEF3C7',
  warningBorder: '#F59E0B',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLength(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export default function InfrastructureCard({
  item,
  expanded = false,
  onPress,
}: InfrastructureCardProps) {
  const { colors } = useTheme();
  const typeConf   = TYPE_CONFIG[item.type];
  const accessConf = ACCESS_CONFIG[item.access_type];

  return (
    <View style={[styles.card, { shadowColor: typeConf.color, backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.inner}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: typeConf.color }]} />

        <View style={styles.content}>
          {/* ── Header ────────────────────────────────────────────────── */}
          <View style={styles.headerRow}>
            {/* Type icon circle */}
            <View style={[styles.iconCircle, { backgroundColor: typeConf.bg }]}>
              <MaterialIcons name={typeConf.icon} size={20} color={typeConf.color} />
            </View>

            {/* Name + location */}
            <View style={styles.titleBlock}>
              <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
              <View style={styles.locationRow}>
                <MaterialIcons name="place" size={12} color={colors.textMuted} />
                <Text style={[styles.locationText, { color: colors.textMuted }]}>
                  {[item.municipality, item.region].filter(Boolean).join(', ')}
                </Text>
              </View>
            </View>

            {/* IQ score + type badge column */}
            <View style={styles.badgesCol}>
              {item.iq_score !== undefined && (
                <View style={[styles.iqBadge, { backgroundColor: typeConf.bg }]}>
                  <Text style={[styles.iqText, { color: typeConf.color }]}>
                    {item.iq_score}
                  </Text>
                </View>
              )}
              <View style={[styles.typeBadge, { backgroundColor: typeConf.bg }]}>
                <Text style={[styles.typeBadgeText, { color: typeConf.color }]}>
                  {typeConf.label}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Meta Row ──────────────────────────────────────────────── */}
          <View style={styles.metaRow}>
            {item.length_m !== undefined && (
              <View style={styles.metaItem}>
                <MaterialIcons name="straighten" size={13} color={C.textLight} />
                <Text style={styles.metaText}>{formatLength(item.length_m)}</Text>
              </View>
            )}
            {item.height_m !== undefined && (
              <View style={styles.metaItem}>
                <MaterialIcons name="height" size={13} color={C.textLight} />
                <Text style={styles.metaText}>{item.height_m} m</Text>
              </View>
            )}
            {item.difficulty && (
              <View style={styles.metaItem}>
                <MaterialIcons name="terrain" size={13} color={DIFFICULTY_CONFIG[item.difficulty].color} />
                <Text style={[styles.metaText, { color: DIFFICULTY_CONFIG[item.difficulty].color }]}>
                  {DIFFICULTY_CONFIG[item.difficulty].label}
                </Text>
              </View>
            )}
            {/* Access badge */}
            <View style={[styles.accessBadge, { backgroundColor: accessConf.bg }]}>
              <Text style={[styles.accessBadgeText, { color: accessConf.color }]}>
                {accessConf.label}
              </Text>
            </View>
            {/* Distance badge */}
            {item.distance_km !== undefined && (
              <View style={styles.distanceBadge}>
                <MaterialIcons name="near-me" size={11} color="#D97706" />
                <Text style={styles.distanceText}>{item.distance_km.toFixed(1)} km</Text>
              </View>
            )}
          </View>

          {/* ── Accessibility icons row ───────────────────────────────── */}
          {(item.is_accessible || item.is_family_friendly || item.is_dog_friendly) && (
            <View style={styles.accessibilityRow}>
              {item.is_accessible && (
                <View style={styles.accessibilityChip}>
                  <MaterialIcons name="accessible" size={14} color="#0369A1" />
                  <Text style={[styles.accessibilityText, { color: '#0369A1' }]}>Acessível</Text>
                </View>
              )}
              {item.is_family_friendly && (
                <View style={styles.accessibilityChip}>
                  <MaterialIcons name="family-restroom" size={14} color="#7C3AED" />
                  <Text style={[styles.accessibilityText, { color: '#7C3AED' }]}>Família</Text>
                </View>
              )}
              {item.is_dog_friendly && (
                <View style={styles.accessibilityChip}>
                  <MaterialIcons name="pets" size={14} color="#059669" />
                  <Text style={[styles.accessibilityText, { color: '#059669' }]}>Cão</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Description short ────────────────────────────────────── */}
          <Text style={[styles.descShort, { color: colors.textSecondary }]} numberOfLines={expanded ? undefined : 2}>
            {item.description_short}
          </Text>

          {/* ── Season chips ─────────────────────────────────────────── */}
          {(item.best_season ?? []).length > 0 && (
            <View style={styles.seasonRow}>
              <MaterialIcons name="wb-sunny" size={12} color={C.textLight} />
              {item.best_season!.map((s) => (
                <View key={s} style={styles.seasonChip}>
                  <Text style={styles.seasonChipText}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Safety warning ───────────────────────────────────────── */}
          {item.safety_restrictions && (
            <View style={styles.warningBox}>
              <MaterialIcons name="warning" size={14} color="#D97706" />
              <Text style={styles.warningText}>{item.safety_restrictions}</Text>
            </View>
          )}

          {/* ── Expanded: description_long + opening_hours ───────────── */}
          {expanded && item.description_long && (
            <Text style={[styles.descLong, { color: colors.textSecondary }]}>{item.description_long}</Text>
          )}
          {expanded && item.opening_hours && (
            <View style={styles.hoursRow}>
              <MaterialIcons name="schedule" size={13} color={typeConf.color} />
              <Text style={styles.hoursText}>{item.opening_hours}</Text>
            </View>
          )}

          {/* ── Expand hint ──────────────────────────────────────────── */}
          <View style={styles.expandHint}>
            <MaterialIcons
              name={expanded ? 'expand-less' : 'expand-more'}
              size={18}
              color={C.textLight}
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  inner: {
    flexDirection: 'row',
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 8,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textDark,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: 11,
    color: C.textLight,
    fontWeight: '500',
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  iqBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  iqText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 130,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    color: C.textMed,
    fontWeight: '600',
  },
  accessBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  accessBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },

  // Accessibility
  accessibilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  accessibilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.border + '50',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  accessibilityText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Descriptions
  descShort: {
    fontSize: 13,
    color: C.textMed,
    lineHeight: 19,
  },
  descLong: {
    fontSize: 13,
    color: C.textMed,
    lineHeight: 19,
  },

  // Season
  seasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  seasonChip: {
    backgroundColor: C.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  seasonChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMed,
  },

  // Warning
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 6,
    padding: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 17,
  },

  // Hours
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hoursText: {
    fontSize: 12,
    color: C.textMed,
    fontWeight: '500',
  },

  // Expand
  expandHint: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
});
