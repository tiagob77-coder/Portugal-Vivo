/**
 * CulturalRouteCard — rich card for Portuguese cultural routes (Premium)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RouteStop {
  name: string;
  lat: number;
  lng: number;
  municipality: string;
  type: string;
}

export interface CulturalRoute {
  id?: string;
  _id?: string;
  name: string;
  family: 'musicais' | 'danca' | 'festas' | 'trajes' | 'instrumentos' | 'integradas';
  sub_family: string;
  region: string;
  municipalities: string[];
  unesco?: boolean;
  unesco_label?: string;
  description_short: string;
  description_long?: string;
  stops?: RouteStop[];
  duration_days: number;
  best_months: number[];
  music_genres?: string[];
  instruments?: string[];
  dances?: string[];
  gastronomy?: string[];
  costumes?: string[];
  festivals?: string[];
  tags?: string[];
  premium?: boolean;
  iq_score?: number;
  lat: number;
  lng: number;
  distance_km?: number;
}

interface CulturalRouteCardProps {
  route: CulturalRoute;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Family Config ───────────────────────────────────────────────────────────

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const FAMILY_CONFIG: Record<
  CulturalRoute['family'],
  { color: string; bg: string; label: string; icon: MaterialIconName }
> = {
  musicais:      { color: '#8B5CF6', bg: '#8B5CF620', label: 'Musical',      icon: 'music-note' },
  danca:         { color: '#EC4899', bg: '#EC489920', label: 'Dança',        icon: 'directions-run' },
  festas:        { color: '#F59E0B', bg: '#F59E0B20', label: 'Festas',       icon: 'celebration' },
  trajes:        { color: '#06B6D4', bg: '#06B6D420', label: 'Trajes',       icon: 'checkroom' },
  instrumentos:  { color: '#10B981', bg: '#10B98120', label: 'Instrumentos', icon: 'piano' },
  integradas:    { color: '#EF4444', bg: '#EF444420', label: 'Integrada',    icon: 'auto-awesome' },
};

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CulturalRouteCard({
  route,
  expanded = false,
  onPress,
}: CulturalRouteCardProps) {
  const { colors } = useTheme();
  const cfg = FAMILY_CONFIG[route.family];
  const bestMonthsStr = route.best_months.map((m) => MONTH_NAMES[m - 1]).join(' · ');
  const visibleInstruments = route.instruments?.slice(0, 3) ?? [];
  const visibleGastronomy = route.gastronomy?.slice(0, 3) ?? [];
  const visibleDances = route.dances?.slice(0, 3) ?? [];

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
          <Text style={[styles.routeName, { color: colors.textPrimary }]} numberOfLines={2}>{route.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.familyBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.familyBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {route.unesco && (
              <View style={styles.unescoBadge}>
                <Text style={styles.unescoBadgeText}>UNESCO</Text>
              </View>
            )}
            {route.premium && (
              <View style={styles.premiumBadge}>
                <MaterialIcons name="star" size={10} color="#F59E0B" />
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>
        </View>

        {route.iq_score !== undefined && (
          <View style={styles.iqBadge}>
            <Text style={styles.iqText}>{route.iq_score}</Text>
          </View>
        )}
      </View>

      {/* ── Region + Duration ───────────────────────────────────────────── */}
      <View style={styles.row}>
        <MaterialIcons name="place" size={13} color="#94A3B8" />
        <Text style={styles.rowText}>{route.region} · {route.municipalities.slice(0, 3).join(', ')}</Text>
        {route.distance_km !== undefined && (
          <View style={styles.distBadge}>
            <Text style={styles.distText}>{route.distance_km.toFixed(0)} km</Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <MaterialIcons name="schedule" size={13} color="#94A3B8" />
        <Text style={styles.rowText}>{route.duration_days} dia{route.duration_days > 1 ? 's' : ''}</Text>
        <View style={styles.monthsBadge}>
          <Text style={styles.monthsText}>{bestMonthsStr}</Text>
        </View>
      </View>

      {/* ── Stops count ─────────────────────────────────────────────────── */}
      {route.stops && route.stops.length > 0 && (
        <View style={styles.row}>
          <MaterialIcons name="pin-drop" size={13} color="#94A3B8" />
          <Text style={styles.rowText}>{route.stops.length} paragens mapeadas</Text>
        </View>
      )}

      {/* ── Description ─────────────────────────────────────────────────── */}
      <Text style={[styles.descShort, { color: colors.textSecondary }]}>{route.description_short}</Text>

      {/* ── Instruments chips ───────────────────────────────────────────── */}
      {visibleInstruments.length > 0 && (
        <View style={styles.chipsSection}>
          <MaterialIcons name="piano" size={12} color="#10B981" />
          <View style={styles.chipsRow}>
            {visibleInstruments.map((inst) => (
              <View key={inst} style={styles.chip}>
                <Text style={styles.chipText}>{inst.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Dances chips ────────────────────────────────────────────────── */}
      {visibleDances.length > 0 && (
        <View style={styles.chipsSection}>
          <MaterialIcons name="directions-run" size={12} color="#EC4899" />
          <View style={styles.chipsRow}>
            {visibleDances.map((d) => (
              <View key={d} style={[styles.chip, styles.chipDance]}>
                <Text style={[styles.chipText, styles.chipDanceText]}>{d.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Gastronomy ──────────────────────────────────────────────────── */}
      {visibleGastronomy.length > 0 && (
        <View style={styles.chipsSection}>
          <MaterialIcons name="restaurant" size={12} color="#F59E0B" />
          <View style={styles.chipsRow}>
            {visibleGastronomy.map((dish) => (
              <View key={dish} style={[styles.chip, styles.chipGastro]}>
                <Text style={[styles.chipText, styles.chipGastroText]}>{dish}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Festivals ───────────────────────────────────────────────────── */}
      {expanded && route.festivals && route.festivals.length > 0 && (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedLabel}>Festivais associados</Text>
          {route.festivals.map((f) => (
            <View key={f} style={styles.festivalRow}>
              <MaterialIcons name="event" size={12} color="#A78BFA" />
              <Text style={styles.festivalText}>{f}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Expanded: long description ──────────────────────────────────── */}
      {expanded && route.description_long && (
        <Text style={[styles.descLong, { color: colors.textSecondary, borderTopColor: colors.border }]}>{route.description_long}</Text>
      )}

      {/* ── UNESCO label ────────────────────────────────────────────────── */}
      {expanded && route.unesco_label && (
        <View style={styles.unescoRow}>
          <MaterialIcons name="verified" size={14} color="#F59E0B" />
          <Text style={styles.unescoLabelText}>{route.unesco_label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A0E30',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    gap: 8,
  },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 4 },
  routeName: { fontSize: 15, fontWeight: '700', color: '#F3E8FF', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  familyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  familyBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  unescoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#F59E0B20' },
  unescoBadgeText: { fontSize: 10, fontWeight: '700', color: '#FCD34D', letterSpacing: 0.4 },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#78350F30',
  },
  premiumBadgeText: { fontSize: 10, fontWeight: '700', color: '#FCD34D' },
  iqBadge: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#A855F720', alignItems: 'center', justifyContent: 'center',
  },
  iqText: { fontSize: 11, fontWeight: '800', color: '#A855F7' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { fontSize: 12, color: '#C4B5D4', flex: 1 },
  distBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: '#A855F720' },
  distText: { fontSize: 10, fontWeight: '600', color: '#A855F7' },
  monthsBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: '#1E1040' },
  monthsText: { fontSize: 10, fontWeight: '600', color: '#A78BFA' },

  descShort: { fontSize: 12, color: '#C4B5D4', lineHeight: 17, marginTop: 2 },
  descLong: {
    fontSize: 13, color: '#DDD0F0', lineHeight: 19, marginTop: 4,
    borderTopWidth: 1, borderTopColor: '#2A1A50', paddingTop: 10,
  },

  chipsSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  chip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B98130',
  },
  chipText: { fontSize: 11, color: '#6EE7B7', fontWeight: '500' },
  chipDance: { backgroundColor: '#EC489915', borderColor: '#EC489930' },
  chipDanceText: { color: '#F9A8D4' },
  chipGastro: { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' },
  chipGastroText: { color: '#FCD34D' },

  expandedSection: { marginTop: 4, gap: 4 },
  expandedLabel: { fontSize: 11, fontWeight: '700', color: '#A78BFA', textTransform: 'uppercase', letterSpacing: 0.5 },
  festivalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  festivalText: { fontSize: 12, color: '#C4B5D4' },

  unescoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    padding: 8, borderRadius: 8, backgroundColor: '#F59E0B10', borderWidth: 1, borderColor: '#F59E0B30',
  },
  unescoLabelText: { fontSize: 11, color: '#FCD34D', fontWeight: '600', flex: 1 },
});
