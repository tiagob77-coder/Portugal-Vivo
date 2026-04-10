/**
 * MusicCard — rich card for Portuguese traditional music items
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MusicItem {
  id: string;
  name: string;
  type: 'fado' | 'folclore' | 'canto_polifonico' | 'canto_tradicional' | 'danca_tradicional' | 'instrumento' | 'festival' | 'tuna';
  region: string;
  municipality: string;
  description_short: string;
  description_long?: string;
  instruments?: string[];
  genres?: string[];
  artists?: string[];
  venues?: string[];
  unesco?: boolean;
  period?: string;
  tags?: string[];
  lat: number;
  lng: number;
  iq_score?: number;
  distance_km?: number;
}

interface MusicCardProps {
  item: MusicItem;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TYPE_CONFIG: Record<
  MusicItem['type'],
  { color: string; bg: string; label: string; icon: MaterialIconName }
> = {
  fado:               { color: '#8B5CF6', bg: '#8B5CF620', label: 'Fado',              icon: 'music-note' },
  folclore:           { color: '#D946EF', bg: '#D946EF20', label: 'Folclore',          icon: 'groups' },
  canto_polifonico:   { color: '#0EA5E9', bg: '#0EA5E920', label: 'Canto Polifónico',  icon: 'mic' },
  canto_tradicional:  { color: '#14B8A6', bg: '#14B8A620', label: 'Canto Tradicional', icon: 'record-voice-over' },
  danca_tradicional:  { color: '#F97316', bg: '#F9731620', label: 'Dança',             icon: 'directions-run' },
  instrumento:        { color: '#EAB308', bg: '#EAB30820', label: 'Instrumento',       icon: 'piano' },
  festival:           { color: '#EC4899', bg: '#EC489920', label: 'Festival',          icon: 'festival' },
  tuna:               { color: '#6366F1', bg: '#6366F120', label: 'Tuna',              icon: 'school' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MusicCard({
  item,
  expanded = false,
  onPress,
}: MusicCardProps) {
  const cfg = TYPE_CONFIG[item.type];
  const visibleInstruments = item.instruments?.slice(0, 3) ?? [];
  const extraInstruments = (item.instruments?.length ?? 0) - visibleInstruments.length;
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: cfg.color, backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name={cfg.icon} size={20} color={cfg.color} />
        </View>

        <View style={styles.headerText}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {item.unesco && (
              <View style={styles.unescoBadge}>
                <Text style={styles.unescoBadgeText}>UNESCO</Text>
              </View>
            )}
          </View>
        </View>

        {item.iq_score !== undefined && (
          <View style={styles.iqBadge}>
            <Text style={styles.iqText}>{item.iq_score}</Text>
          </View>
        )}
      </View>

      {/* ── Location Row ────────────────────────────────────────────────── */}
      <View style={styles.row}>
        <MaterialIcons name="place" size={13} color="#64748B" />
        <Text style={[styles.rowText, { color: colors.textMuted }]}>{item.municipality}, {item.region}</Text>
        {item.distance_km !== undefined && (
          <View style={styles.distBadge}>
            <Text style={styles.distText}>{item.distance_km.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* ── Period Row ──────────────────────────────────────────────────── */}
      {item.period && (
        <View style={styles.row}>
          <MaterialIcons name="history" size={13} color="#64748B" />
          <Text style={[styles.rowText, { color: colors.textMuted }]}>{item.period}</Text>
        </View>
      )}

      {/* ── Description short ───────────────────────────────────────────── */}
      <Text style={[styles.descShort, { color: colors.textSecondary }]}>{item.description_short}</Text>

      {/* ── Instruments Chips ───────────────────────────────────────────── */}
      {visibleInstruments.length > 0 && (
        <View style={styles.chipsRow}>
          {visibleInstruments.map((inst) => (
            <View key={inst} style={styles.chip}>
              <Text style={styles.chipText}>{inst}</Text>
            </View>
          ))}
          {extraInstruments > 0 && (
            <View style={[styles.chip, styles.chipExtra]}>
              <Text style={[styles.chipText, styles.chipExtraText]}>+{extraInstruments} mais</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Artists Row ─────────────────────────────────────────────────── */}
      {item.artists && item.artists.length > 0 && (
        <View style={styles.artistsRow}>
          <MaterialIcons name="person" size={13} color="#8B5CF6" />
          <Text style={styles.artistsText} numberOfLines={2}>
            {item.artists.join(', ')}
          </Text>
        </View>
      )}

      {/* ── Expanded: long description ──────────────────────────────────── */}
      {expanded && item.description_long && (
        <Text style={[styles.descLong, { color: colors.textSecondary, borderTopColor: colors.border }]}>{item.description_long}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#120818',
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
  itemName: {
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
  unescoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#B4530920',
  },
  unescoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
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
    borderTopColor: '#2D1B4E',
    paddingTop: 10,
  },

  // Instrument chips
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
    backgroundColor: '#1E0F2E',
    borderWidth: 1,
    borderColor: '#2D1B4E',
  },
  chipText: {
    fontSize: 11,
    color: '#C4B5FD',
    fontWeight: '500',
  },
  chipExtra: {
    backgroundColor: '#2D1B4E',
    borderColor: '#3D2B5E',
  },
  chipExtraText: {
    color: '#DDD6FE',
  },

  // Artists
  artistsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  artistsText: {
    fontSize: 12,
    color: '#C4B5FD',
    flex: 1,
    lineHeight: 17,
  },
});
