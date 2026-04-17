/**
 * HojeEmPortugalCard — contextual "today in Portugal" feed widget
 * Shows season, moon, flora/fauna active, events nearby and surf conditions.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export interface HojeItem {
  label: string;
  emoji?: string;
  region?: string;
  distance_km?: number;
  type: 'flora' | 'fauna' | 'event' | 'trail' | 'surf';
}

export interface HojeData {
  date: string;
  month_pt: string;
  season: { id: string; label: string; emoji: string };
  flora_active: { label: string; emoji: string; region: string }[];
  fauna_active: { label: string; emoji: string; region: string }[];
  surf: { note: string; emoji: string };
  events_nearby: { name?: string; title?: string; distance_km?: number; region?: string }[];
  trails_nearby: { name: string; difficulty?: string; distance_km?: number }[];
  llm_summary?: string;
  has_location: boolean;
  cached?: boolean;
}

interface Props {
  data?: HojeData;
  loading?: boolean;
  accentColor?: string;
}

function Chip({ emoji, label, sub, color }: { emoji?: string; label: string; sub?: string; color: string }) {
  return (
    <View style={[styles.chip, { borderColor: color + '50', backgroundColor: color + '12' }]}>
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <View>
        <Text style={[styles.chipLabel, { color }]} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={styles.chipSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export default function HojeEmPortugalCard({ data, loading, accentColor = '#10B981' }: Props) {
  const router = useRouter();

  if (loading) {
    return (
      <View style={[styles.card, { borderColor: accentColor + '40' }]}>
        <ActivityIndicator color={accentColor} size="small" />
      </View>
    );
  }

  if (!data) return null;

  const chips: { emoji?: string; label: string; sub?: string; color: string }[] = [];

  // Season + date
  chips.push({ emoji: data.season.emoji, label: data.season.label, sub: data.month_pt, color: accentColor });

  // Flora
  data.flora_active.slice(0, 2).forEach((f) =>
    chips.push({ emoji: f.emoji, label: f.label, sub: f.region, color: '#22C55E' })
  );

  // Fauna
  data.fauna_active.slice(0, 2).forEach((f) =>
    chips.push({ emoji: f.emoji, label: f.label, sub: f.region, color: '#06B6D4' })
  );

  // Events nearby
  if (data.events_nearby.length > 0) {
    const ev = data.events_nearby[0];
    chips.push({
      emoji: '🎉',
      label: ev.name || ev.title || 'Evento próximo',
      sub: ev.distance_km != null ? `${ev.distance_km} km` : ev.region,
      color: '#F59E0B',
    });
  }

  // Trails nearby
  if (data.trails_nearby.length > 0) {
    const tr = data.trails_nearby[0];
    chips.push({
      emoji: '🥾',
      label: tr.name,
      sub: tr.distance_km != null ? `${tr.distance_km} km` : tr.difficulty,
      color: '#84CC16',
    });
  }

  // Surf
  if (data.surf.note) {
    chips.push({ emoji: data.surf.emoji, label: 'Mar & Surf', sub: data.surf.note.split('—')[0].trim(), color: '#3B82F6' });
  }

  return (
    <View style={[styles.card, { borderColor: accentColor + '40' }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
        <Text style={[styles.title, { color: accentColor }]}>Hoje em Portugal</Text>
        {!data.has_location && (
          <View style={styles.noloc}>
            <MaterialIcons name="location-off" size={11} color="#6B7280" />
            <Text style={styles.nolocText}>Sem GPS</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => router.push('/nearby' as any)} style={styles.link}>
          <Text style={[styles.linkText, { color: accentColor }]}>Ver perto</Text>
          <MaterialIcons name="arrow-forward" size={12} color={accentColor} />
        </TouchableOpacity>
      </View>

      {/* LLM summary */}
      {!!data.llm_summary && (
        <Text style={styles.summary} numberOfLines={3}>{data.llm_summary}</Text>
      )}

      {/* Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {chips.map((c, i) => (
          <Chip key={i} emoji={c.emoji} label={c.label} sub={c.sub} color={c.color} />
        ))}
      </ScrollView>

      {/* Event count footer */}
      {data.events_nearby.length > 1 && (
        <TouchableOpacity style={styles.footer} onPress={() => router.push('/(tabs)/eventos' as any)} activeOpacity={0.7}>
          <MaterialIcons name="event" size={12} color="#6B7280" />
          <Text style={styles.footerText}>
            {data.events_nearby.length} eventos em {data.month_pt} · toque para ver
          </Text>
          <MaterialIcons name="chevron-right" size={14} color="#6B7280" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#0D1F1A',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  noloc: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nolocText: { fontSize: 10, color: '#6B7280' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { fontSize: 11, fontWeight: '600' },
  summary: { fontSize: 12, color: '#9CA3AF', lineHeight: 17, fontStyle: 'italic' },
  chips: { gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12,
    borderWidth: 1, maxWidth: 180,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 11, fontWeight: '700', maxWidth: 130 },
  chipSub: { fontSize: 10, color: '#6B7280', maxWidth: 130 },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingTop: 6, borderTopWidth: 1, borderTopColor: '#1A3028',
  },
  footerText: { fontSize: 11, color: '#6B7280', flex: 1 },
});
