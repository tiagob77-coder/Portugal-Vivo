/**
 * MaritimeCultureCard — rich card for Portuguese maritime cultural events
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaritimeEvent {
  id: string;
  name: string;
  type: 'procissao_maritima' | 'bencao_barcos' | 'festa_mar' | 'ritual_religioso' | 'tradicao_piscatoria' | 'banho_santo';
  region: string;
  municipality: string;
  date_start: string;
  date_end?: string;
  is_recurring: boolean;
  frequency?: 'anual' | 'sazonal' | 'irregular';
  description_short: string;
  description_long?: string;
  saint_or_symbol?: string;
  boats_involved?: number;
  activities?: string[];
  gastronomy_links?: string[];
  lat: number;
  lng: number;
  iq_score?: number;
  distance_km?: number;
  is_upcoming?: boolean;
}

interface MaritimeCultureCardProps {
  event: MaritimeEvent;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TYPE_CONFIG: Record<
  MaritimeEvent['type'],
  { color: string; bg: string; label: string; icon: MaterialIconName }
> = {
  procissao_maritima:   { color: '#1D4ED8', bg: '#1D4ED820', label: 'Procissão',  icon: 'directions-boat' },
  bencao_barcos:        { color: '#0369A1', bg: '#0369A120', label: 'Bênção',     icon: 'anchor' },
  festa_mar:            { color: '#B45309', bg: '#B4530920', label: 'Festa do Mar', icon: 'celebration' },
  ritual_religioso:     { color: '#7C3AED', bg: '#7C3AED20', label: 'Ritual',     icon: 'church' },
  tradicao_piscatoria:  { color: '#0F766E', bg: '#0F766E20', label: 'Tradição',   icon: 'set-meal' },
  banho_santo:          { color: '#0891B2', bg: '#0891B220', label: 'Banho Santo', icon: 'pool' },
};

const FREQ_LABEL: Record<string, string> = {
  anual:     'Anual',
  sazonal:   'Sazonal',
  irregular: 'Irregular',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaritimeCultureCard({
  event,
  expanded = false,
  onPress,
}: MaritimeCultureCardProps) {
  const cfg = TYPE_CONFIG[event.type];
  const visibleActivities = event.activities?.slice(0, 3) ?? [];
  const extraActivities = (event.activities?.length ?? 0) - visibleActivities.length;

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: cfg.color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name={cfg.icon} size={20} color={cfg.color} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.eventName} numberOfLines={2}>{event.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {event.is_upcoming && (
              <View style={styles.upcomingBadge}>
                <Text style={styles.upcomingBadgeText}>Próximo</Text>
              </View>
            )}
          </View>
        </View>

        {event.iq_score !== undefined && (
          <View style={styles.iqBadge}>
            <Text style={styles.iqText}>{event.iq_score}</Text>
          </View>
        )}
      </View>

      {/* ── Date Row ────────────────────────────────────────────────────── */}
      <View style={styles.row}>
        <MaterialIcons name="calendar-today" size={13} color="#64748B" />
        <Text style={styles.rowText}>
          {event.date_start}
          {event.date_end ? ` – ${event.date_end}` : ''}
        </Text>
        {event.frequency && (
          <View style={styles.freqBadge}>
            <Text style={styles.freqText}>{FREQ_LABEL[event.frequency]}</Text>
          </View>
        )}
      </View>

      {/* ── Location Row ────────────────────────────────────────────────── */}
      <View style={styles.row}>
        <MaterialIcons name="place" size={13} color="#64748B" />
        <Text style={styles.rowText}>{event.municipality}, {event.region}</Text>
        {event.distance_km !== undefined && (
          <View style={styles.distBadge}>
            <Text style={styles.distText}>{event.distance_km.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* ── Saint / Symbol Row ──────────────────────────────────────────── */}
      {event.saint_or_symbol && (
        <View style={styles.row}>
          <MaterialIcons name="star" size={13} color="#F59E0B" />
          <Text style={styles.rowText}>{event.saint_or_symbol}</Text>
        </View>
      )}

      {/* ── Boats Row ───────────────────────────────────────────────────── */}
      {event.boats_involved !== undefined && (
        <View style={styles.row}>
          <MaterialIcons name="directions-boat" size={13} color="#64748B" />
          <Text style={styles.rowText}>{event.boats_involved} barcos</Text>
        </View>
      )}

      {/* ── Description short ───────────────────────────────────────────── */}
      <Text style={styles.descShort}>{event.description_short}</Text>

      {/* ── Activities Chips ────────────────────────────────────────────── */}
      {visibleActivities.length > 0 && (
        <View style={styles.chipsRow}>
          {visibleActivities.map((act) => (
            <View key={act} style={styles.chip}>
              <Text style={styles.chipText}>{act}</Text>
            </View>
          ))}
          {extraActivities > 0 && (
            <View style={[styles.chip, styles.chipExtra]}>
              <Text style={[styles.chipText, styles.chipExtraText]}>+{extraActivities} mais</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Gastronomy Links ────────────────────────────────────────────── */}
      {event.gastronomy_links && event.gastronomy_links.length > 0 && (
        <View style={styles.gastronomyRow}>
          <MaterialIcons name="restaurant" size={13} color="#B45309" />
          <View style={styles.chipsRowInline}>
            {event.gastronomy_links.map((dish) => (
              <View key={dish} style={styles.gastroChip}>
                <Text style={styles.gastroChipText}>{dish}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Expanded: long description ──────────────────────────────────── */}
      {expanded && event.description_long && (
        <Text style={styles.descLong}>{event.description_long}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#041426',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    gap: 8,
  },

  // Header
  header: {
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
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  upcomingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#16A34A20',
  },
  upcomingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ADE80',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  iqBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F59E0B20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iqText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },

  // Info rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowText: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  freqBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#1E3A5F',
  },
  freqText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7DD3FC',
  },
  distBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#78350F40',
  },
  distText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
  },

  // Description
  descShort: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    marginTop: 2,
  },
  descLong: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1E3A5F',
    paddingTop: 10,
  },

  // Activity chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#0F2035',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  chipText: {
    fontSize: 11,
    color: '#93C5FD',
    fontWeight: '500',
  },
  chipExtra: {
    backgroundColor: '#1E3A5F',
    borderColor: '#2D5080',
  },
  chipExtraText: {
    color: '#7DD3FC',
  },

  // Gastronomy
  gastronomyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  chipsRowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
  },
  gastroChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#78350F30',
    borderWidth: 1,
    borderColor: '#92400E50',
  },
  gastroChipText: {
    fontSize: 11,
    color: '#FCD34D',
    fontWeight: '500',
  },
});
