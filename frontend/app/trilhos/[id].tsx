/**
 * Trail detail — rich view for a curated AllTrails trail: editorial description,
 * review highlights, stats, features and an AllTrails deep-link. Mobile-first.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getFeaturedTrail } from '../../src/services/api/routes';
import TrailMiniMap from '../../src/components/TrailMiniMap';

const C = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  accent: '#1F4E79',
  textDark: '#1F2937',
  textMed: '#6B7280',
  border: '#E5E7EB',
  fallback: '#3F6F4A',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  facil: 'Fácil',
  moderado: 'Moderado',
  dificil: 'Difícil',
  muito_dificil: 'Muito difícil',
};

function prettyTag(tag: string): string {
  const t = tag.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function TrailDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: trail, isLoading, isError } = useQuery({
    queryKey: ['featured-trail', id],
    queryFn: () => getFeaturedTrail(String(id)),
    enabled: !!id,
  });

  const chipColor = trail?.color || C.fallback;
  const difficultyLabel =
    (trail?.difficulty && DIFFICULTY_LABEL[trail.difficulty]) || trail?.difficulty || '—';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <MaterialIcons name="arrow-back" size={24} color={C.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Trilho</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>
      ) : isError || !trail ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={40} color={C.textMed} />
          <Text style={styles.muted}>Não foi possível carregar o trilho.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Title + difficulty */}
          <Text style={styles.name}>{trail.name}</Text>
          <View style={styles.row}>
            <View style={[styles.chip, { backgroundColor: chipColor }]}>
              <Text style={styles.chipText}>{difficultyLabel}</Text>
            </View>
            {(trail.region || trail.park) ? (
              <Text style={styles.location} numberOfLines={1}>
                {[trail.region, trail.park].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>

          {/* Stats */}
          <View style={styles.statsCard}>
            {trail.distance_km !== undefined ? (
              <Stat icon="straighten" label="Distância" value={`${trail.distance_km} km`} color={chipColor} />
            ) : null}
            <Stat
              icon="schedule"
              label="Duração"
              value={trail.avg_time || (trail.estimated_hours ? `${trail.estimated_hours} h` : '—')}
              color={chipColor}
            />
            {trail.max_elevation ? (
              <Stat icon="terrain" label="Cota máx." value={`${trail.max_elevation} m`} color={chipColor} />
            ) : null}
            {trail.rating !== undefined ? (
              <Stat icon="star" label="Avaliação" value={trail.rating.toFixed(1)} color="#F59E0B" />
            ) : null}
          </View>

          {/* Geometry status */}
          <View style={[styles.statusChip, trail.needs_geometry ? styles.statusPending : styles.statusReady]}>
            <MaterialIcons
              name={trail.needs_geometry ? 'help-outline' : 'timeline'}
              size={14}
              color={trail.needs_geometry ? '#92400E' : '#166534'}
            />
            <Text style={[styles.statusText, trail.needs_geometry ? styles.statusPendingText : styles.statusReadyText]}>
              {trail.needs_geometry ? 'Geometria por confirmar' : 'Traçado no mapa'}
            </Text>
          </View>

          {/* Route preview (renders once real geometry is available) */}
          {trail.points && trail.points.length > 1 ? (
            <>
              <Text style={styles.sectionTitle}>Traçado do percurso</Text>
              <TrailMiniMap points={trail.points} color={chipColor} height={200} />
            </>
          ) : null}

          {/* Description */}
          {trail.description ? (
            <>
              <Text style={styles.sectionTitle}>Sobre o trilho</Text>
              <Text style={styles.body}>{trail.description}</Text>
            </>
          ) : null}

          {/* Review highlights */}
          {trail.review_summary ? (
            <View style={styles.reviewCard}>
              <View style={styles.row}>
                <MaterialIcons name="reviews" size={16} color={C.accent} />
                <Text style={styles.reviewTitle}>Destaques de quem já foi</Text>
              </View>
              <Text style={styles.body}>{trail.review_summary}</Text>
            </View>
          ) : null}

          {/* Features */}
          {trail.tags && trail.tags.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Destaques</Text>
              <View style={styles.tagsWrap}>
                {trail.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{prettyTag(tag)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* AllTrails link */}
          {trail.external_url ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(trail.external_url as string).catch(() => {})}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${trail.name} no AllTrails`}
            >
              <MaterialIcons name="open-in-new" size={18} color="#FFFFFF" />
              <Text style={styles.linkBtnText}>Ver no AllTrails</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.attribution}>Conteúdo e dados do trilho © AllTrails</Text>
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ icon, label, value, color }: {
  icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; color: string;
}) {
  return (
    <View style={styles.statItem}>
      <MaterialIcons name={icon} size={18} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.textDark },
  headerSpacer: { width: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { fontSize: 14, color: C.textMed },
  scroll: { padding: 16, paddingBottom: 32 },
  name: { fontSize: 22, fontWeight: '800', color: C.textDark, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  location: { flex: 1, fontSize: 13, color: C.textMed },
  statsCard: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    backgroundColor: C.card, borderRadius: 14, padding: 14, marginTop: 14, gap: 12,
  },
  statItem: { alignItems: 'center', minWidth: 64, flexGrow: 1 },
  statValue: { fontSize: 15, fontWeight: '700', color: C.textDark, marginTop: 4 },
  statLabel: { fontSize: 11, color: C.textMed, marginTop: 2 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 14,
  },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusReady: { backgroundColor: '#DCFCE7' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusPendingText: { color: '#92400E' },
  statusReadyText: { color: '#166534' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textDark, marginTop: 20, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 21, color: '#374151' },
  reviewCard: {
    backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginTop: 16, gap: 8,
  },
  reviewTitle: { fontSize: 14, fontWeight: '700', color: C.accent },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1F4E79', borderRadius: 12, paddingVertical: 13, marginTop: 22,
  },
  linkBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  attribution: { fontSize: 11, color: C.textMed, textAlign: 'center', marginTop: 16 },
});
