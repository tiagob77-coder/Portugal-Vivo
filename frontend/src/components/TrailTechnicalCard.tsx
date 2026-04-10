/**
 * TrailTechnicalCard — Cartão técnico de trilho
 * Mostra: distância, duração, elevação, dificuldade, tipo de trilho, terreno.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

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

const DIFFICULTY_CONFIG: Record<TrailDifficulty, { label: string; color: string; bg: string }> = {
  facil: { label: 'Fácil', color: '#22C55E', bg: '#F0FDF4' },
  moderado: { label: 'Moderado', color: '#EAB308', bg: '#FEFCE8' },
  dificil: { label: 'Difícil', color: '#F97316', bg: '#FFF7ED' },
  muito_dificil: { label: 'Muito Difícil', color: '#EF4444', bg: '#FEF2F2' },
};

const TYPE_CONFIG: Record<TrailType, { label: string; icon: string }> = {
  linear: { label: 'Linear', icon: 'trending-flat' },
  circular: { label: 'Circular', icon: 'loop' },
  ida_volta: { label: 'Ida e Volta', icon: 'compare-arrows' },
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
  const diff = DIFFICULTY_CONFIG[data.difficulty || 'moderado'];
  const type = TYPE_CONFIG[data.trail_type || 'linear'];

  const stats = [
    { icon: 'straighten', color: '#3B82F6', value: data.distance_km ? `${data.distance_km.toFixed(1)} km` : '—', label: 'Distância' },
    { icon: 'schedule', color: '#C49A6C', value: fmtDuration(data.estimated_hours), label: 'Duração' },
    { icon: 'arrow-upward', color: '#22C55E', value: data.elevation_gain ? `+${data.elevation_gain}m` : '—', label: 'Subida' },
    { icon: 'terrain', color: '#8B5CF6', value: data.max_elevation ? `${data.max_elevation}m` : '—', label: 'Alt. Máx.' },
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
          <Text style={[tc.diffTxt, { color: diff.color }]}>{diff.label}</Text>
        </View>
        <View style={[tc.typePill, { backgroundColor: colors.surface }]}>
          <MaterialIcons name={type.icon as any} size={13} color={colors.textSecondary} />
          <Text style={[tc.typeTxt, { color: colors.textSecondary }]}>{type.label}</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
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
