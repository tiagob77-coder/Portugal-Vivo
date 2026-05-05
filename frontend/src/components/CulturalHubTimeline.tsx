/**
 * CulturalHubTimeline — horizontal monthly calendar strip
 * Shows which months have the most cultural route activity.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { palette } from '../theme';
import { borderRadius, spacing } from '../theme/spacing';

export interface TimelineMonth {
  month: number; // 1-12
  label: string;
  routeCount: number;
  highlight?: string; // e.g. "São João"
}

interface Props {
  months: TimelineMonth[];
  accentColor?: string;
}

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function buildTimelineMonths(bestMonths: number[][]): TimelineMonth[] {
  const counts = new Array(12).fill(0);
  for (const arr of bestMonths) {
    for (const m of arr) {
      if (m >= 1 && m <= 12) counts[m - 1]++;
    }
  }
  const HIGHLIGHTS: Record<number, string> = {
    6: 'São João', 7: 'Arraiais', 8: 'Verão', 12: 'Natal',
    4: 'Páscoa', 2: 'Carnaval',
  };
  return counts.map((count, i) => ({
    month: i + 1,
    label: MONTH_LABELS[i],
    routeCount: count,
    highlight: HIGHLIGHTS[i + 1],
  }));
}

export default function CulturalHubTimeline({ months, accentColor = '#A855F7' }: Props) {
  const max = Math.max(...months.map((m) => m.routeCount), 1);
  const now = new Date().getMonth() + 1;

  return (
    <View style={styles.wrapper}>
      <View style={styles.titleRow}>
        <MaterialIcons name="timeline" size={15} color={accentColor} />
        <Text style={[styles.title, { color: accentColor }]}>Calendário Cultural</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {months.map((m) => {
          const isNow = m.month === now;
          const barH = Math.max(4, Math.round((m.routeCount / max) * 40));
          return (
            <View key={m.month} style={[styles.monthCol, isNow && { borderColor: accentColor, borderWidth: 1, borderRadius: 8 }]}>
              {m.highlight ? (
                <Text style={[styles.highlight, { color: accentColor }]} numberOfLines={1}>{m.highlight}</Text>
              ) : (
                <Text style={styles.highlightSpacer}> </Text>
              )}
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: barH, backgroundColor: isNow ? accentColor : accentColor + '55' }]} />
              </View>
              <Text style={[styles.monthLabel, isNow && { color: accentColor, fontWeight: '700' }]}>{m.label}</Text>
              <Text style={styles.count}>{m.routeCount}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: spacing.base, marginBottom: spacing.base, backgroundColor: palette.gray[900], borderRadius: borderRadius.lg, padding: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  scroll: { gap: spacing.xs, paddingBottom: 2 },
  monthCol: { alignItems: 'center', width: 38, paddingVertical: spacing.xs, paddingHorizontal: 2 },
  highlight: { fontSize: 7, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center', marginBottom: 2 },
  highlightSpacer: { fontSize: 7, marginBottom: 2 },
  barTrack: { height: 44, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 14, borderRadius: 3 },
  monthLabel: { fontSize: 10, color: palette.gray[400], marginTop: 3, fontWeight: '500' },
  count: { fontSize: 9, color: palette.gray[500], marginTop: 1 },
});
