/**
 * Analytics Dashboard
 * Engagement metrics: visits, retention, user growth, top POIs/routes,
 * category & region breakdown with configurable time period.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/context/ThemeContext';
import { shadows } from '../src/theme';
import { getAnalyticsDashboard, getAnalyticsTrends } from '../src/services/api';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

const PERIODS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

const REGION_COLORS: Record<string, string> = {
  norte: '#3B82F6', centro: '#22C55E', lisboa: '#F59E0B',
  alentejo: '#EF4444', algarve: '#06B6D4', acores: '#8B5CF6', madeira: '#EC4899',
};

const CATEGORY_COLORS = ['#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444',
  '#06B6D4', '#EC4899', '#C49A6C', '#64748B', '#0EA5E9'];

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color, colors }: any) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{label}</Text>
      {sub ? <Text style={[styles.kpiSub, { color }]}>{sub}</Text> : null}
    </View>
  );
}

function SectionHeader({ title, icon, color, colors }: any) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialIcons name={icon} size={18} color={color} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

/** Pure-View bar chart — no external chart library needed. */
function BarChart({
  data,
  color,
  height = 80,
  labelKey = 'date',
  valueKey = 'value',
  colors,
}: {
  data: Record<string, any>[];
  color: string;
  height?: number;
  labelKey?: string;
  valueKey?: string;
  colors: any;
}) {
  if (!data.length) {
    return (
      <View style={[styles.chartEmpty, { borderColor: colors.borderLight }]}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Sem dados no período</Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  // Show at most 30 bars to keep it readable
  const slice = data.length > 30 ? data.slice(-30) : data;

  return (
    <View style={styles.chartWrap}>
      <View style={[styles.chartBars, { height }]}>
        {slice.map((d, i) => {
          const barH = Math.max(2, ((d[valueKey] || 0) / maxVal) * (height - 12));
          return (
            <View key={i} style={styles.barCol}>
              <Text style={[styles.barValLabel, { color: colors.textMuted }]}>
                {d[valueKey] > 0 ? d[valueKey] : ''}
              </Text>
              <View style={[styles.chartBar, { height: barH, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
      {/* X-axis labels (first, middle, last) */}
      <View style={styles.chartXAxis}>
        <Text style={[styles.chartXLabel, { color: colors.textMuted }]}>
          {slice[0]?.[labelKey]?.slice(5)}
        </Text>
        {slice.length > 2 && (
          <Text style={[styles.chartXLabel, { color: colors.textMuted }]}>
            {slice[Math.floor(slice.length / 2)]?.[labelKey]?.slice(5)}
          </Text>
        )}
        <Text style={[styles.chartXLabel, { color: colors.textMuted }]}>
          {slice[slice.length - 1]?.[labelKey]?.slice(5)}
        </Text>
      </View>
    </View>
  );
}

function HBar({
  label, value, maxValue, color, suffix = '', colors,
}: {
  label: string; value: number; maxValue: number; color: string; suffix?: string; colors: any;
}) {
  const pct = Math.max(2, Math.min(100, (value / Math.max(maxValue, 1)) * 100));
  return (
    <View style={styles.hbarRow}>
      <Text style={[styles.hbarLabel, { color: colors.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.hbarTrack, { backgroundColor: colors.borderLight }]}>
        <View style={[styles.hbarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.hbarCount, { color: colors.textMuted }]}>{value}{suffix}</Text>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [period, setPeriod] = useState(30);
  const [trendMetric, setTrendMetric] = useState<'visits' | 'new_users'>('visits');

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-dashboard', period],
    queryFn: () => getAnalyticsDashboard(period),
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['analytics-trends', trendMetric, period],
    queryFn: () => getAnalyticsTrends(trendMetric, period),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['#1E1F4B', '#2D2F6B']}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Voltar">
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={styles.headerTitle}>Analytics</Text>
              <Text style={styles.headerSub}>Métricas de engagement</Text>
            </View>
            <MaterialIcons name="bar-chart" size={26} color="rgba(255,255,255,0.6)" />
          </View>

          {/* Period selector */}
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.days}
                style={[
                  styles.periodPill,
                  period === p.days && styles.periodPillActive,
                ]}
                onPress={() => setPeriod(p.days)}
                accessibilityRole="button"
                accessibilityState={{ selected: period === p.days }}
              >
                <Text style={[
                  styles.periodLabel,
                  period === p.days && styles.periodLabelActive,
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={[styles.loaderText, { color: colors.textMuted }]}>
              A carregar métricas…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={40} color="#EF4444" />
            <Text style={[styles.errorText, { color: colors.textMuted }]}>
              Não foi possível carregar os dados de analytics.
            </Text>
            <Text style={[styles.errorSub, { color: colors.textMuted }]}>
              Verifica que a sessão de admin está ativa.
            </Text>
          </View>
        ) : data ? (
          <>
            {/* ── KPI cards ── */}
            <View style={styles.kpiGrid}>
              <KpiCard
                icon="bar-chart"
                label="Total Visitas"
                value={data.visits.total.toLocaleString()}
                sub={`${data.visits.avg_visits_per_user} visitas/user`}
                color="#3B82F6"
                colors={colors}
              />
              <KpiCard
                icon="people"
                label="Únicos"
                value={data.visits.unique_visitors.toLocaleString()}
                color="#8B5CF6"
                colors={colors}
              />
              <KpiCard
                icon="loop"
                label="Retenção"
                value={`${data.retention.retention_rate_pct}%`}
                sub={`${data.retention.returning_visitors} recorrentes`}
                color="#22C55E"
                colors={colors}
              />
              <KpiCard
                icon="person-add"
                label="Novos Users"
                value={data.user_growth.new_users_period.toLocaleString()}
                sub={`últimos ${data.period_days}d`}
                color="#F59E0B"
                colors={colors}
              />
            </View>

            {/* ── Trend chart ── */}
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <View style={styles.trendHeaderRow}>
                <SectionHeader
                  title="Tendência"
                  icon="show-chart"
                  color="#3B82F6"
                  colors={colors}
                />
                <View style={styles.metricToggle}>
                  {(['visits', 'new_users'] as const).map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.metricPill,
                        trendMetric === m && { backgroundColor: '#3B82F620' },
                      ]}
                      onPress={() => setTrendMetric(m)}
                    >
                      <Text style={[
                        styles.metricPillText,
                        { color: trendMetric === m ? '#3B82F6' : colors.textMuted },
                      ]}>
                        {m === 'visits' ? 'Visitas' : 'Registos'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {trendLoading ? (
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 12 }} />
              ) : (
                <BarChart
                  data={trendData?.data || []}
                  color="#3B82F6"
                  height={90}
                  colors={colors}
                />
              )}
            </View>

            {/* ── Weekly user growth ── */}
            {data.user_growth.by_week.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.surface }]}>
                <SectionHeader
                  title="Crescimento Semanal"
                  icon="trending-up"
                  color="#22C55E"
                  colors={colors}
                />
                <BarChart
                  data={data.user_growth.by_week}
                  color="#22C55E"
                  labelKey="week"
                  valueKey="count"
                  height={80}
                  colors={colors}
                />
              </View>
            )}

            {/* ── Top favorited POIs ── */}
            {data.top_pois_favorited.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.surface }]}>
                <SectionHeader
                  title="POIs mais Guardados"
                  icon="favorite"
                  color="#EC4899"
                  colors={colors}
                />
                {data.top_pois_favorited.slice(0, 5).map((poi, i) => (
                  <View key={poi.poi_id || i} style={styles.poiRow}>
                    <View style={[
                      styles.poiRankBadge,
                      { backgroundColor: i === 0 ? '#C49A6C' : colors.accent + '20' },
                    ]}>
                      <Text style={[
                        styles.poiRankText,
                        { color: i === 0 ? '#FFF' : colors.accent },
                      ]}>
                        {i + 1}
                      </Text>
                    </View>
                    {poi.image_url ? (
                      <Image
                        source={{ uri: poi.image_url }}
                        style={styles.poiThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.poiThumb, styles.poiThumbPlaceholder, { backgroundColor: colors.borderLight }]}>
                        <MaterialIcons name="place" size={18} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.poiName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {poi.name}
                      </Text>
                      <Text style={[styles.poiMeta, { color: colors.textMuted }]}>
                        {poi.region} · {poi.category}
                      </Text>
                    </View>
                    <View style={styles.favCount}>
                      <MaterialIcons name="favorite" size={12} color="#EC4899" />
                      <Text style={[styles.favCountText, { color: colors.textMuted }]}>
                        {poi.favorites_count}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Top shared routes ── */}
            {data.top_routes_shared.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.surface }]}>
                <SectionHeader
                  title="Rotas mais Partilhadas"
                  icon="alt-route"
                  color="#3B82F6"
                  colors={colors}
                />
                {data.top_routes_shared.slice(0, 5).map((route, i) => (
                  <View key={route.route_id || i} style={styles.routeRow}>
                    <Text style={[styles.routeRank, { color: colors.textMuted }]}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.routeName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {route.name || `Rota #${i + 1}`}
                      </Text>
                      <Text style={[styles.routeMeta, { color: colors.textMuted }]}>
                        {route.category || '—'}
                      </Text>
                    </View>
                    <View style={styles.routeStats}>
                      <View style={styles.routeStat}>
                        <MaterialIcons name="share" size={12} color="#3B82F6" />
                        <Text style={[styles.routeStatText, { color: colors.textMuted }]}>
                          {route.share_count}
                        </Text>
                      </View>
                      <View style={styles.routeStat}>
                        <MaterialIcons name="visibility" size={12} color="#22C55E" />
                        <Text style={[styles.routeStatText, { color: colors.textMuted }]}>
                          {route.view_count}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Category engagement ── */}
            {data.category_engagement.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.surface }]}>
                <SectionHeader
                  title="Visitas por Categoria"
                  icon="category"
                  color="#8B5CF6"
                  colors={colors}
                />
                {data.category_engagement.slice(0, 10).map((c, i) => (
                  <HBar
                    key={c.category || i}
                    label={c.category?.replace(/_/g, ' ') || '—'}
                    value={c.visits}
                    maxValue={data.category_engagement[0]?.visits || 1}
                    color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                    suffix=" visitas"
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* ── Region engagement ── */}
            {data.region_engagement.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.surface }]}>
                <SectionHeader
                  title="Visitas por Região"
                  icon="map"
                  color="#F59E0B"
                  colors={colors}
                />
                {data.region_engagement.map((r, i) => (
                  <HBar
                    key={r.region || i}
                    label={r.region || '—'}
                    value={r.visits}
                    maxValue={data.region_engagement[0]?.visits || 1}
                    color={REGION_COLORS[r.region] || '#64748B'}
                    suffix=" visitas"
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Footer timestamp */}
            <Text style={[styles.generatedAt, { color: colors.textMuted }]}>
              Gerado em{' '}
              {new Date(data.generated_at).toLocaleString('pt-PT', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    fontSize: 22, fontWeight: '800', color: '#FFF', fontFamily: serif,
  },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // Period selector
  periodRow: {
    flexDirection: 'row', gap: 8, marginTop: 16,
  },
  periodPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  periodPillActive: { backgroundColor: '#8B5CF6' },
  periodLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  periodLabelActive: { color: '#FFF' },

  // Loaders / errors
  loader: { alignItems: 'center', paddingTop: 60, gap: 12 },
  loaderText: { fontSize: 14 },
  errorBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  errorText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  errorSub: { fontSize: 13, textAlign: 'center' },

  // KPI grid (2 cols)
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginHorizontal: 16, marginTop: 16,
  },
  kpiCard: {
    width: '47%' as any, padding: 14, borderRadius: 12,
    alignItems: 'flex-start', gap: 4, ...shadows.sm,
  },
  kpiIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  kpiValue: { fontSize: 24, fontWeight: '800' },
  kpiLabel: { fontSize: 12, fontWeight: '600' },
  kpiSub: { fontSize: 11, marginTop: 2, fontWeight: '500' },

  // Sections
  section: {
    marginHorizontal: 16, marginTop: 16,
    padding: 16, borderRadius: 14, ...shadows.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', fontFamily: serif },

  // Trend header
  trendHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricToggle: { flexDirection: 'row', gap: 4 },
  metricPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  metricPillText: { fontSize: 12, fontWeight: '600' },

  // Bar chart
  chartWrap: { gap: 4 },
  chartBars: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 2, overflow: 'hidden',
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  barValLabel: { fontSize: 8, textAlign: 'center' },
  chartBar: { width: '100%', borderRadius: 2, minHeight: 2 },
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartXLabel: { fontSize: 10 },
  chartEmpty: {
    height: 60, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  // Horizontal bars
  hbarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  hbarLabel: {
    width: 90, fontSize: 12, fontWeight: '500', textTransform: 'capitalize',
  },
  hbarTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  hbarFill: { height: '100%', borderRadius: 4 },
  hbarCount: { width: 64, fontSize: 11, textAlign: 'right' },

  // POI rows
  poiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  poiRankBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  poiRankText: { fontSize: 12, fontWeight: '700' },
  poiThumb: { width: 44, height: 44, borderRadius: 8 },
  poiThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  poiName: { fontSize: 14, fontWeight: '600' },
  poiMeta: { fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  favCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  favCountText: { fontSize: 12, fontWeight: '600' },

  // Route rows
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 10 },
  routeRank: { width: 24, fontSize: 12, fontWeight: '600' },
  routeName: { fontSize: 14, fontWeight: '600' },
  routeMeta: { fontSize: 11, marginTop: 1, textTransform: 'capitalize' },
  routeStats: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  routeStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  routeStatText: { fontSize: 11, fontWeight: '600' },

  // Footer
  generatedAt: {
    textAlign: 'center', fontSize: 11, marginTop: 20,
    fontStyle: 'italic', paddingHorizontal: 20,
  },
});
