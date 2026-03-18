/**
 * Analytics Dashboard - Engagement metrics overview for platform admins.
 * Displays visits, retention, top POIs, top routes, user growth, and category/region engagement.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '../config/api';
import axios from 'axios';
import { stateColors } from '../theme';

interface AnalyticsDashboardProps {
  /** Initial period in days */
  initialPeriod?: number;
}

const PERIOD_OPTIONS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
];

export default function AnalyticsDashboard({ initialPeriod = 30 }: AnalyticsDashboardProps) {
  const [periodDays, setPeriodDays] = useState(initialPeriod);

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-dashboard', periodDays],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/analytics/dashboard`, {
        params: { period_days: periodDays },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5min
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>A carregar métricas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={48} color={stateColors.surf.poor} />
        <Text style={styles.errorText}>Erro ao carregar analytics</Text>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period Selector */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.periodBtn, periodDays === opt.value && styles.periodBtnActive]}
            onPress={() => setPeriodDays(opt.value)}
          >
            <Text style={[styles.periodBtnText, periodDays === opt.value && styles.periodBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview Cards */}
      <Text style={styles.sectionTitle}>Visão Geral</Text>
      <View style={styles.cardRow}>
        <MetricCard icon="people" label="Utilizadores" value={data.overview.total_users} color="#2563EB" />
        <MetricCard icon="place" label="POIs" value={data.overview.total_pois} color="#16A34A" />
        <MetricCard icon="route" label="Rotas" value={data.overview.total_routes} color="#9333EA" />
      </View>

      {/* Visits & Retention */}
      <Text style={styles.sectionTitle}>Engagement ({periodDays}d)</Text>
      <View style={styles.cardRow}>
        <MetricCard icon="visibility" label="Visitas" value={data.visits.total} color="#0EA5E9" />
        <MetricCard icon="person" label="Visitantes únicos" value={data.visits.unique_visitors} color="#F59E0B" />
        <MetricCard icon="repeat" label="Retenção" value={`${data.retention.retention_rate_pct}%`} color={stateColors.surf.poor} />
      </View>

      {/* User Growth */}
      <Text style={styles.sectionTitle}>Crescimento de Utilizadores</Text>
      <View style={styles.growthCard}>
        <View style={styles.growthHeader}>
          <MaterialIcons name="trending-up" size={20} color="#16A34A" />
          <Text style={styles.growthValue}>+{data.user_growth.new_users_period} novos</Text>
        </View>
        {data.user_growth.by_week.length > 0 && (
          <View style={styles.weeklyBars}>
            {data.user_growth.by_week.slice(-8).map((w: { week: string; count: number }) => {
              const maxCount = Math.max(...data.user_growth.by_week.map((x: { count: number }) => x.count), 1);
              const height = Math.max(4, (w.count / maxCount) * 60);
              return (
                <View key={w.week} style={styles.barContainer}>
                  <View style={[styles.bar, { height, backgroundColor: '#2563EB' }]} />
                  <Text style={styles.barLabel}>{w.count}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Top Favorited POIs */}
      {data.top_pois_favorited.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>POIs Mais Favoritos</Text>
          {data.top_pois_favorited.slice(0, 5).map((poi: {
            poi_id: string; name: string; category?: string; favorites_count: number;
          }, i: number) => (
            <View key={poi.poi_id} style={styles.listItem}>
              <Text style={styles.rank}>#{i + 1}</Text>
              <View style={styles.listItemInfo}>
                <Text style={styles.listItemName} numberOfLines={1}>{poi.name}</Text>
                {poi.category && <Text style={styles.listItemSub}>{poi.category}</Text>}
              </View>
              <View style={styles.badge}>
                <MaterialIcons name="favorite" size={14} color={stateColors.surf.poor} />
                <Text style={styles.badgeText}>{poi.favorites_count}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Top Shared Routes */}
      {data.top_routes_shared.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Rotas Mais Partilhadas</Text>
          {data.top_routes_shared.slice(0, 5).map((route: {
            route_id: string; name: string; share_count: number; view_count: number;
          }, i: number) => (
            <View key={route.route_id || i} style={styles.listItem}>
              <Text style={styles.rank}>#{i + 1}</Text>
              <View style={styles.listItemInfo}>
                <Text style={styles.listItemName} numberOfLines={1}>{route.name}</Text>
              </View>
              <View style={styles.badge}>
                <MaterialIcons name="share" size={14} color="#2563EB" />
                <Text style={styles.badgeText}>{route.share_count || 0}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Category Engagement */}
      {data.category_engagement.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Engagement por Categoria</Text>
          {data.category_engagement.slice(0, 8).map((cat: { category: string; visits: number }) => {
            const maxVisits = Math.max(...data.category_engagement.map((c: { visits: number }) => c.visits), 1);
            const pct = (cat.visits / maxVisits) * 100;
            return (
              <View key={cat.category} style={styles.barRow}>
                <Text style={styles.barRowLabel} numberOfLines={1}>{cat.category}</Text>
                <View style={styles.barRowTrack}>
                  <View style={[styles.barRowFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.barRowValue}>{cat.visits}</Text>
              </View>
            );
          })}
        </>
      )}

      {/* Region Engagement */}
      {data.region_engagement.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Engagement por Região</Text>
          {data.region_engagement.slice(0, 7).map((reg: { region: string; visits: number }) => {
            const maxVisits = Math.max(...data.region_engagement.map((r: { visits: number }) => r.visits), 1);
            const pct = (reg.visits / maxVisits) * 100;
            return (
              <View key={reg.region} style={styles.barRow}>
                <Text style={styles.barRowLabel} numberOfLines={1}>{reg.region}</Text>
                <View style={styles.barRowTrack}>
                  <View style={[styles.barRowFill, { width: `${pct}%`, backgroundColor: '#9333EA' }]} />
                </View>
                <Text style={styles.barRowValue}>{reg.visits}</Text>
              </View>
            );
          })}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/** Small metric card sub-component */
function MetricCard({ icon, label, value, color }: {
  icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string | number; color: string;
}) {
  return (
    <View style={styles.metricCard}>
      <MaterialIcons name={icon} size={22} color={color} />
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
  errorText: { marginTop: 12, color: stateColors.surf.poor, fontSize: 14 },

  // Period selector
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  periodBtnActive: { backgroundColor: '#2563EB' },
  periodBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  periodBtnTextActive: { color: '#FFFFFF' },

  // Section
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 20, marginBottom: 12 },

  // Metric cards
  cardRow: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  metricValue: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  metricLabel: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },

  // Growth
  growthCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  growthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  growthValue: { fontSize: 16, fontWeight: '700', color: '#16A34A' },
  weeklyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80, justifyContent: 'center' },
  barContainer: { alignItems: 'center', flex: 1 },
  bar: { width: '100%', borderRadius: 4, minWidth: 12 },
  barLabel: { fontSize: 10, color: '#64748B', marginTop: 4 },

  // List items
  listItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 10, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  rank: { fontSize: 14, fontWeight: '700', color: '#94A3B8', width: 30 },
  listItemInfo: { flex: 1, marginRight: 8 },
  listItemName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  listItemSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#475569' },

  // Horizontal bar rows
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barRowLabel: { width: 100, fontSize: 12, color: '#475569' },
  barRowTrack: {
    flex: 1, height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, overflow: 'hidden',
  },
  barRowFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 5 },
  barRowValue: { width: 36, fontSize: 12, fontWeight: '600', color: '#1E293B', textAlign: 'right' },
});
