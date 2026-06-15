/**
 * Cultural route detail — premium thematic route with a real route mini-map
 * (the stops carry coordinates, so it renders immediately), full description,
 * numbered stops and the cultural layers (instruments, dances, gastronomy,
 * costumes, voices, festivals). Mobile-first.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getCulturalRoute, getRouteLiveCalendar } from '../../src/services/api/cultural';
import TrailMiniMap from '../../src/components/TrailMiniMap';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const FAMILY: Record<string, { color: string; label: string; icon: IconName }> = {
  musicais:     { color: '#8B5CF6', label: 'Musical',      icon: 'music-note' },
  danca:        { color: '#EC4899', label: 'Dança',        icon: 'directions-run' },
  festas:       { color: '#F59E0B', label: 'Festas',       icon: 'celebration' },
  trajes:       { color: '#06B6D4', label: 'Trajes',       icon: 'checkroom' },
  instrumentos: { color: '#10B981', label: 'Instrumentos', icon: 'piano' },
  integradas:   { color: '#EF4444', label: 'Integrada',    icon: 'auto-awesome' },
};

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatDate(s?: string): string {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]} ${MONTHS[parseInt(m[2], 10) - 1]}`;
  return s.slice(0, 10);
}

const C = {
  bg: '#F3F4F6', card: '#FFFFFF', textDark: '#1F2937', textMed: '#6B7280', border: '#E5E7EB',
};

export default function CulturalRouteDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: route, isLoading, isError } = useQuery({
    queryKey: ['cultural-route', id],
    queryFn: () => getCulturalRoute(String(id)),
    enabled: !!id,
  });

  const { data: calendar } = useQuery({
    queryKey: ['cultural-route-events', id],
    queryFn: () => getRouteLiveCalendar(String(id)),
    enabled: !!id,
  });
  const events = calendar?.events ?? [];

  const fam = (route && FAMILY[route.family]) || FAMILY.integradas;
  const stops = route?.stops ?? [];
  const geoStops = stops.filter((s) => s.lat != null && s.lng != null);
  const points = geoStops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const waypoints = geoStops.map((s, i) => ({
    lat: s.lat, lng: s.lng, name: s.name, order: i + 1,
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar">
          <MaterialIcons name="arrow-back" size={24} color={C.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Rota cultural</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={fam.color} /></View>
      ) : isError || !route ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={40} color={C.textMed} />
          <Text style={styles.muted}>Não foi possível carregar a rota.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.name}>{route.name}</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.chip, { backgroundColor: fam.color }]}>
              <MaterialIcons name={fam.icon} size={12} color="#FFFFFF" />
              <Text style={styles.chipText}>{fam.label}</Text>
            </View>
            {route.unesco ? (
              <View style={[styles.chip, styles.unesco]}>
                <Text style={styles.unescoText}>UNESCO</Text>
              </View>
            ) : null}
            {route.premium ? (
              <View style={[styles.chip, styles.premium]}>
                <MaterialIcons name="star" size={11} color="#92400E" />
                <Text style={styles.premiumText}>Premium</Text>
              </View>
            ) : null}
          </View>

          {(route.region || (route.municipalities?.length)) ? (
            <Text style={styles.location} numberOfLines={2}>
              {[route.region, (route.municipalities ?? []).slice(0, 4).join(' · ')].filter(Boolean).join(' — ')}
            </Text>
          ) : null}

          <View style={styles.statsRow}>
            {route.duration_days ? (
              <Stat icon="schedule" value={`${route.duration_days} dia${route.duration_days > 1 ? 's' : ''}`} color={fam.color} />
            ) : null}
            {stops.length ? <Stat icon="pin-drop" value={`${stops.length} paragens`} color={fam.color} /> : null}
            {route.iq_score != null ? <Stat icon="auto-awesome" value={`IQ ${route.iq_score}`} color={fam.color} /> : null}
          </View>

          {points.length > 1 ? (
            <>
              <Text style={styles.sectionTitle}>Traçado da rota</Text>
              <TrailMiniMap points={points} waypoints={waypoints} color={fam.color} height={220} />
            </>
          ) : null}

          {(route.description_long || route.description_short) ? (
            <>
              <Text style={styles.sectionTitle}>Sobre a rota</Text>
              <Text style={styles.body}>{route.description_long || route.description_short}</Text>
            </>
          ) : null}

          {route.unesco_label ? (
            <View style={styles.unescoCard}>
              <MaterialIcons name="verified" size={16} color="#B45309" />
              <Text style={styles.unescoLabel}>{route.unesco_label}</Text>
            </View>
          ) : null}

          {events.length ? (
            <>
              <Text style={styles.sectionTitle}>Eventos a acontecer</Text>
              {events.map((ev) => (
                <View key={ev.id ?? ev.name} style={styles.eventRow}>
                  <MaterialIcons name="event-available" size={18} color={fam.color} />
                  <View style={styles.eventBody}>
                    <Text style={styles.eventName} numberOfLines={2}>{ev.name}</Text>
                    <Text style={styles.eventMeta} numberOfLines={1}>
                      {[formatDate(ev.date_start), ev.region, ev.category].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {stops.length ? (
            <>
              <Text style={styles.sectionTitle}>Paragens</Text>
              {stops.map((s, i) => (
                <View key={`${s.name}-${i}`} style={styles.stopRow}>
                  <View style={[styles.stopNum, { backgroundColor: fam.color }]}>
                    <Text style={styles.stopNumText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stopBody}>
                    <Text style={styles.stopName}>{s.name}</Text>
                    {s.municipality ? <Text style={styles.stopMun}>{s.municipality}</Text> : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <Section title="Instrumentos" items={route.instruments} color="#10B981" />
          <Section title="Danças" items={route.dances} color="#EC4899" />
          <Section title="Gastronomia" items={route.gastronomy} color="#F59E0B" />
          <Section title="Trajes" items={route.costumes} color="#06B6D4" />
          <Section title="Vozes & oralidade" items={route.voices_orality} color="#8B5CF6" />

          {route.festivals?.length ? (
            <>
              <Text style={styles.sectionTitle}>Festivais associados</Text>
              {route.festivals.map((f) => (
                <View key={f} style={styles.festivalRow}>
                  <MaterialIcons name="event" size={14} color={fam.color} />
                  <Text style={styles.body}>{f}</Text>
                </View>
              ))}
            </>
          ) : null}

          {route.best_months?.length ? (
            <>
              <Text style={styles.sectionTitle}>Melhor altura</Text>
              <View style={styles.tagsWrap}>
                {route.best_months.map((m) => (
                  <View key={m} style={styles.monthChip}>
                    <Text style={styles.monthText}>{MONTHS[m - 1]}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.footer} />
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ icon, value, color }: { icon: IconName; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <MaterialIcons name={icon} size={16} color={color} />
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Section({ title, items, color }: { title: string; items?: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.tagsWrap}>
        {items.map((it) => (
          <View key={it} style={[styles.tag, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
            <Text style={[styles.tagText, { color }]}>{it.replace(/_/g, ' ')}</Text>
          </View>
        ))}
      </View>
    </>
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
  scroll: { padding: 16 },
  name: { fontSize: 22, fontWeight: '800', color: C.textDark, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  unesco: { backgroundColor: '#FEF3C7' },
  unescoText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  premium: { backgroundColor: '#FDE68A' },
  premiumText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  location: { fontSize: 13, color: C.textMed, marginBottom: 6 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { fontSize: 14, fontWeight: '700', color: C.textDark },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textDark, marginTop: 20, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 21, color: '#374151' },
  unescoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
  },
  unescoLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E' },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  stopNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stopNumText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  stopBody: { flex: 1 },
  stopName: { fontSize: 14, fontWeight: '600', color: C.textDark },
  stopMun: { fontSize: 12, color: C.textMed },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  eventBody: { flex: 1 },
  eventName: { fontSize: 14, fontWeight: '600', color: C.textDark },
  eventMeta: { fontSize: 12, color: C.textMed, marginTop: 1 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '600' },
  festivalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  monthChip: { backgroundColor: '#EDE9FE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  monthText: { fontSize: 12, fontWeight: '600', color: '#6D28D9' },
  footer: { height: 24 },
});
