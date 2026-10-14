/**
 * TrailTechnicalCard — Cartão técnico de trilho
 * Mostra: distância, duração, elevação, dificuldade, tipo de trilho, terreno.
 */
import { palette } from '../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

export type TrailDifficulty = 'facil' | 'moderado' | 'dificil' | 'muito_dificil';
export type TrailType = 'linear' | 'circular' | 'ida_volta';

export interface TrailTechnicalData {
  distance_km?: number;
  elevation_gain?: number;
  elevation_loss?: number;
  min_elevation?: number;
  max_elevation?: number;
  estimated_hours?: number;
  difficulty?: TrailDifficulty;
  trail_type?: TrailType;
  terrain_type?: string;
}

interface Props {
  data: TrailTechnicalData;
}

const DIFFICULTY_CONFIG: Record<TrailDifficulty, { labelKey: string; color: string; bg: string }> = {
  facil: { labelKey: 'widgets.trailTech.facil', color: '#22C55E', bg: '#F0FDF4' },
  moderado: { labelKey: 'widgets.trailTech.moderado', color: '#EAB308', bg: '#FEFCE8' },
  dificil: { labelKey: 'widgets.trailTech.dificil', color: '#F97316', bg: '#FFF7ED' },
  muito_dificil: { labelKey: 'widgets.trailTech.muitoDificil', color: '#EF4444', bg: '#FEF2F2' },
};

const TYPE_CONFIG: Record<TrailType, { labelKey: string; icon: string }> = {
  linear: { labelKey: 'widgets.trailTech.linear', icon: 'trending-flat' },
  circular: { labelKey: 'widgets.trailTech.circular', icon: 'loop' },
  ida_volta: { labelKey: 'widgets.trailTech.idaVolta', icon: 'compare-arrows' },
};

function fmtDuration(h?: number): string {
  if (!h) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}min`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}min`;
}

export default function TrailTechnicalCard({ data }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const diff = DIFFICULTY_CONFIG[data.difficulty || 'moderado'];
  const type = TYPE_CONFIG[data.trail_type || 'linear'];

  const stats = [
    { icon: 'straighten', color: '#3B82F6', value: data.distance_km ? `${data.distance_km.toFixed(1)} km` : '—', label: t('widgets.trailTech.distance') },
    { icon: 'schedule', color: palette.terracotta[500], value: fmtDuration(data.estimated_hours), label: t('widgets.trailTech.duration') },
    { icon: 'arrow-upward', color: '#22C55E', value: data.elevation_gain ? `+${data.elevation_gain}m` : '—', label: t('widgets.trailTech.ascent') },
    { icon: 'terrain', color: '#8B5CF6', value: data.max_elevation ? `${data.max_elevation}m` : '—', label: t('widgets.trailTech.maxAlt') },
  ] as const;

  return (
    <View style={[tc.container, { backgroundColor: colors.card }]}>
      {/* Stats grid */}
      <View style={tc.grid}>
        {stats.map(s => (
          <View key={s.label} style={tc.statCell}>
            <MaterialIcons name={s.icon as any} size={18} color={s.color} />
            <Text style={[tc.statVal, { color: colors.textPrimary }]}>{s.value}</Text>
            <Text style={[tc.statLbl, { color: colors.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Divider */}
      <View style={[tc.divider, { backgroundColor: colors.border }]} />

      {/* Difficulty + type + terrain */}
      <View style={tc.metaRow}>
        <View style={[tc.diffBadge, { backgroundColor: diff.bg }]}>
          <Text style={[tc.diffTxt, { color: diff.color }]}>{t(diff.labelKey)}</Text>
        </View>
        <View style={[tc.typePill, { backgroundColor: colors.surface }]}>
          <MaterialIcons name={type.icon as any} size={13} color={colors.textSecondary} />
          <Text style={[tc.typeTxt, { color: colors.textSecondary }]}>{t(type.labelKey)}</Text>
        </View>
        {data.terrain_type && (
          <View style={[tc.terrainPill, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="nature" size={13} color={colors.textSecondary} />
            <Text style={[tc.typeTxt, { color: colors.textSecondary }]}>{data.terrain_type}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  container: {
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  statCell: { alignItems: 'center', gap: 3, flex: 1 },
  statVal: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 2 },
  statLbl: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  diffTxt: { fontSize: 12, fontWeight: '700' },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9FAFB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  terrainPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9FAFB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeTxt: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
});
