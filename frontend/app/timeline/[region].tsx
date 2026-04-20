import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../src/theme';
import { API_BASE } from '../../src/config/api';

// ─── Epoch colour fallbacks (mirror backend EPOCH_COLOURS) ──────────────────
const EPOCH_COLOURS: Record<string, string> = {
  'Pré-História': '#8B7355',
  'Roma Antiga': '#B5651D',
  'Alta Idade Média': '#6B5B45',
  'Fundação de Portugal': '#2E5E4E',
  'Expansão Marítima': '#1A5276',
  'Barroco': '#7D4E57',
  'Liberalismo': '#5D6D7E',
  'Século XX': '#4A235A',
  'Contemporâneo': '#1C2833',
  'Tradição Viva': '#4A6741',
  default: '#666',
};

const REGION_LABELS: Record<string, string> = {
  minho: 'Minho',
  lisboa: 'Lisboa',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  centro: 'Centro',
  norte: 'Norte',
  acores: 'Açores',
  madeira: 'Madeira',
};

// ─── API fetch ───────────────────────────────────────────────────────────────
async function fetchTimeline(region: string) {
  const res = await fetch(`${API_BASE}/timeline/${region}`);
  if (!res.ok) throw new Error(`Timeline fetch failed: ${res.status}`);
  return res.json();
}

// ─── Sub-components ──────────────────────────────────────────────────────────
interface TimelineEvent {
  year?: number;
  era: string;
  event: string;
  event_type?: string;
  figure?: string;
  emoji?: string;
  era_colour?: string;
  linked_poi?: { id: string; name: string };
  recurring_month?: number;
}

const MONTH_NAMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function EventCard({
  event,
  onPoiPress,
}: {
  event: TimelineEvent;
  onPoiPress: (id: string) => void;
}) {
  const { colors } = useTheme();
  const accentColor = event.era_colour || EPOCH_COLOURS[event.era] || EPOCH_COLOURS.default;

  const yearLabel = event.year !== undefined
    ? event.year < 0
      ? `${Math.abs(event.year)} a.C.`
      : String(event.year)
    : event.recurring_month
    ? `Cada ${MONTH_NAMES[event.recurring_month]}`
    : '';

  return (
    <View style={styles.eventRow}>
      {/* Timeline spine dot */}
      <View style={styles.spineCol}>
        <View style={[styles.spineDot, { backgroundColor: accentColor }]} />
        <View style={[styles.spineLine, { backgroundColor: accentColor + '44' }]} />
      </View>

      {/* Card */}
      <View style={[styles.eventCard, { backgroundColor: colors.surface }]}>
        <View style={styles.eventCardHeader}>
          {event.emoji ? (
            <Text style={styles.eventEmoji}>{event.emoji}</Text>
          ) : null}
          <View style={styles.eventMeta}>
            <Text style={[styles.eventYear, { color: accentColor }]}>{yearLabel}</Text>
            <View style={[styles.eraBadge, { backgroundColor: accentColor + '22' }]}>
              <Text style={[styles.eraText, { color: accentColor }]}>{event.era}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.eventText, { color: colors.text }]}>{event.event}</Text>

        {event.figure && (
          <Text style={[styles.figureLine, { color: colors.textSecondary }]}>
            <MaterialIcons name="person" size={12} /> {event.figure}
          </Text>
        )}

        {event.linked_poi && (
          <TouchableOpacity
            style={[styles.poiChip, { borderColor: accentColor + '66' }]}
            onPress={() => onPoiPress(event.linked_poi!.id)}
            accessibilityLabel={`Ver ${event.linked_poi.name}`}
          >
            <MaterialIcons name="place" size={13} color={accentColor} />
            <Text style={[styles.poiChipText, { color: accentColor }]}>
              {event.linked_poi.name}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Filter pill ─────────────────────────────────────────────────────────────
function FilterPill({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterPill,
        {
          backgroundColor: active ? (colors.primary || '#4A6741') : (colors.surface),
          borderColor: active ? 'transparent' : (colors.border || '#ddd'),
        },
      ]}
      accessibilityState={{ selected: active }}
    >
      <Text style={[
        styles.filterPillText,
        { color: active ? '#fff' : (colors.textSecondary || '#888') },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function TimelineScreen() {
  const { region } = useLocalSearchParams<{ region: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark: _isDark } = useTheme();

  const [showRecurring, setShowRecurring] = useState(true);
  const [eraFilter, setEraFilter] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['timeline', region],
    queryFn: () => fetchTimeline(region as string),
    enabled: !!region,
    staleTime: 10 * 60 * 1000,
  });

  const handlePoiPress = useCallback((poiId: string) => {
    router.push(`/heritage/${poiId}` as any);
  }, [router]);

  const events: TimelineEvent[] = data?.events || [];

  // Unique eras for filter
  const eras = Array.from(new Set(events.map((e: TimelineEvent) => e.era)));

  // Apply filters
  const filtered = events.filter((e: TimelineEvent) => {
    if (!showRecurring && e.recurring_month) return false;
    if (eraFilter && e.era !== eraFilter) return false;
    return true;
  });

  const regionLabel = REGION_LABELS[region as string] || (region as string);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.surface },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Voltar"
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Linha do Tempo
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {regionLabel}
          </Text>
        </View>
        <MaterialIcons name="history-edu" size={26} color={colors.primary || '#4A6741'} />
      </View>

      {/* Filters */}
      <View style={[styles.filtersBar, { backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          <FilterPill
            label="Todos"
            active={eraFilter === null}
            onPress={() => setEraFilter(null)}
          />
          {eras.map((era) => (
            <FilterPill
              key={era}
              label={era}
              active={eraFilter === era}
              onPress={() => setEraFilter(eraFilter === era ? null : era)}
            />
          ))}
          <FilterPill
            label={showRecurring ? 'Com tradições' : 'Só história'}
            active={!showRecurring}
            onPress={() => setShowRecurring(!showRecurring)}
          />
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary || '#4A6741'} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            A carregar linha do tempo…
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <MaterialIcons name="history" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Não foi possível carregar a linha do tempo.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary || '#4A6741'}
            />
          }
        >
          {/* Summary bar */}
          <View style={[styles.summaryBar, { backgroundColor: colors.surface }]}>
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              {filtered.length} evento{filtered.length !== 1 ? 's' : ''} •{' '}
              {data?.total_pois_linked || 0} POIs ligados
            </Text>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nenhum evento corresponde aos filtros selecionados.
              </Text>
            </View>
          ) : (
            <View style={styles.timelineContainer}>
              {filtered.map((event: TimelineEvent, idx: number) => (
                <EventCard
                  key={`${event.year ?? event.recurring_month}-${idx}`}
                  event={event}
                  onPoiPress={handlePoiPress}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  backBtn: { padding: 4 },
  headerTextCol: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  filtersBar: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 12, fontWeight: '600' },
  scrollContent: { flexGrow: 1 },
  summaryBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 8,
  },
  summaryText: { fontSize: 12 },
  timelineContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  eventRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  spineCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  spineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 14,
  },
  spineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  eventCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  eventEmoji: { fontSize: 22, lineHeight: 28 },
  eventMeta: { flex: 1, gap: 4 },
  eventYear: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  eraBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  eraText: { fontSize: 10, fontWeight: '600' },
  eventText: {
    fontSize: 14,
    lineHeight: 20,
  },
  figureLine: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  poiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  poiChipText: { fontSize: 12, fontWeight: '600' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center', marginTop: 12 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#4A6741',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
