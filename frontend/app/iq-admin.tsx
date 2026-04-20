/**
 * IQ Admin Panel - Painel de Monitorização Detalhado (Dev/Admin)
 * Mostra módulos, batches, top/bottom POIs, fontes, processamento recente
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getIQAdmin } from '../src/services/api';
import { colors } from '../src/theme';

const MODULE_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  semantic_validation: { name: 'Validação Semântica', icon: 'spellcheck', color: '#3B82F6' },
  cognitive_inference: { name: 'Inferência Cognitiva', icon: 'psychology', color: '#8B5CF6' },
  image_quality: { name: 'Qualidade Imagem', icon: 'image-search', color: '#EC4899' },
  slug_generator: { name: 'Gerador Slug', icon: 'link', color: '#14B8A6' },
  address_norm: { name: 'Normalização Morada', icon: 'place', color: '#C49A6C' },
  deduplication: { name: 'Deduplicação', icon: 'content-copy', color: '#EF4444' },
  poi_scoring: { name: 'Score POI', icon: 'star', color: '#22C55E' },
  route_scoring: { name: 'Score Rota', icon: 'route', color: '#06B6D4' },
  data_enrichment: { name: 'Enriquecimento', icon: 'auto-fix-high', color: '#E67A4A' },
  description_gen: { name: 'Geração Texto', icon: 'auto-stories', color: '#A855F7' },
  thematic_routing: { name: 'Afinidade Temática', icon: 'palette', color: '#D946EF' },
  time_routing: { name: 'Estimativa Temporal', icon: 'schedule', color: '#0EA5E9' },
  difficulty_routing: { name: 'Dificuldade', icon: 'terrain', color: '#84CC16' },
  profile_routing: { name: 'Perfil Visitante', icon: 'groups', color: '#F472B6' },
  weather_routing: { name: 'Meteorologia', icon: 'wb-sunny', color: '#FBBF24' },
  time_of_day_routing: { name: 'Hora do Dia', icon: 'nightlight', color: '#6366F1' },
  multi_day_routing: { name: 'Multi-dia', icon: 'date-range', color: '#10B981' },
  route_optimizer: { name: 'Conectividade', icon: 'hub', color: '#F97316' },
};

export default function IQAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['iq-admin'],
    queryFn: getIQAdmin,
    refetchInterval: 10000,
  });

  if (isLoading || !data) {
    return (
      <View style={[a.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.terracotta[500]} />
      </View>
    );
  }

  return (
    <View style={a.container} data-testid="iq-admin-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[a.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={a.backBtn} onPress={() => router.back()} data-testid="iq-admin-back">
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={a.headerCenter}>
          <Text style={a.headerTitle}>IQ Admin Panel</Text>
          <Text style={a.headerSub}>Developer Dashboard</Text>
        </View>
        <View style={a.liveIndicator}>
          <View style={a.liveDot} />
          <Text style={a.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView
        style={a.scroll}
        contentContainerStyle={a.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22C55E" />}
      >
        {/* Overview Stats */}
        <View style={a.statsRow}>
          <StatBox label="Total" value={data.total_pois.toLocaleString()} color="#3B82F6" icon="storage" />
          <StatBox label="IQ Done" value={data.iq_processed.toLocaleString()} color="#22C55E" icon="check-circle" />
          <StatBox label="Pending" value={data.iq_pending.toLocaleString()} color="#C49A6C" icon="pending" />
          <StatBox label="GPS" value={data.with_coordinates.toLocaleString()} color="#8B5CF6" icon="gps-fixed" />
        </View>

        {/* Progress Bar */}
        <View style={a.progressCard}>
          <View style={a.progressHeader}>
            <Text style={a.progressTitle}>IQ Processing</Text>
            <Text style={a.progressPct}>{data.iq_progress_pct}%</Text>
          </View>
          <View style={a.progressTrack}>
            <View style={[a.progressFill, { width: `${data.iq_progress_pct}%` }]} />
          </View>
          <Text style={a.progressDetail}>{data.iq_processed}/{data.total_pois} POIs processados pelo motor de 18 módulos</Text>
        </View>

        {/* Modules Performance */}
        <View style={a.sectionCard}>
          <Text style={a.sectionTitle}>18 Módulos IQ Engine</Text>
          {data.modules.map((m) => {
            const display = MODULE_DISPLAY[m.name] || { name: m.name, icon: 'extension', color: '#6B7280' };
            const total = m.pass + m.warn + m.fail;
            const passRate = total > 0 ? Math.round((m.pass / total) * 100) : 0;
            return (
              <View key={m.name} style={a.moduleRow}>
                <View style={[a.moduleIcon, { backgroundColor: display.color + '15' }]}>
                  <MaterialIcons name={display.icon as any} size={16} color={display.color} />
                </View>
                <View style={a.moduleInfo}>
                  <Text style={a.moduleName}>{display.name}</Text>
                  <View style={a.moduleMetrics}>
                    <Text style={a.moduleScore}>avg: {m.avg_score}</Text>
                    <Text style={a.moduleConf}>conf: {m.avg_confidence}</Text>
                  </View>
                </View>
                <View style={a.moduleStatus}>
                  <Text style={[a.statusPass, passRate >= 50 ? { color: '#C49A6C' } : { color: '#EF4444' }]}>{passRate > 0 ? `${passRate}%` : '-'}</Text>
                  <View style={a.statusCounts}>
                    <Text style={{ fontSize: 9, color: '#22C55E' }}>{m.pass}ok</Text>
                    <Text style={{ fontSize: 9, color: '#C49A6C' }}>{m.warn}rev</Text>
                    <Text style={{ fontSize: 9, color: '#EF4444' }}>{m.fail}err</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Top POIs */}
        <View style={a.sectionCard}>
          <View style={a.sectionHeader}>
            <MaterialIcons name="emoji-events" size={18} color="#22C55E" />
            <Text style={a.sectionTitle}>Top 10 POIs (Score)</Text>
          </View>
          {data.top_pois.map((p, i) => (
            <View key={p.id} style={a.poiRow}>
              <Text style={[a.poiRank, { color: i < 3 ? '#C49A6C' : colors.gray[400] }]}>#{i + 1}</Text>
              <View style={a.poiInfo}>
                <Text style={a.poiName} numberOfLines={1}>{p.name}</Text>
                <Text style={a.poiMeta}>{p.category} | {p.region}</Text>
              </View>
              <View style={[a.poiScoreBadge, { backgroundColor: '#22C55E20' }]}>
                <Text style={[a.poiScoreText, { color: '#22C55E' }]}>{p.iq_score}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bottom POIs */}
        <View style={a.sectionCard}>
          <View style={a.sectionHeader}>
            <MaterialIcons name="warning" size={18} color="#EF4444" />
            <Text style={a.sectionTitle}>Bottom 10 POIs (Necessitam atenção)</Text>
          </View>
          {data.bottom_pois.map((p, i) => (
            <View key={p.id} style={a.poiRow}>
              <Text style={[a.poiRank, { color: '#EF4444' }]}>#{i + 1}</Text>
              <View style={a.poiInfo}>
                <Text style={a.poiName} numberOfLines={1}>{p.name}</Text>
                <Text style={a.poiMeta}>{p.category} | {p.region}</Text>
              </View>
              <View style={[a.poiScoreBadge, { backgroundColor: '#EF444420' }]}>
                <Text style={[a.poiScoreText, { color: '#EF4444' }]}>{p.iq_score}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Import Batches */}
        {data.import_batches.length > 0 && (
          <View style={a.sectionCard}>
            <View style={a.sectionHeader}>
              <MaterialIcons name="cloud-upload" size={18} color="#3B82F6" />
              <Text style={a.sectionTitle}>Import Batches</Text>
            </View>
            {data.import_batches.map((b) => (
              <View key={b.batch_id} style={a.batchRow}>
                <Text style={a.batchId}>{b.batch_id}</Text>
                <View style={a.batchMeter}>
                  <View style={[a.batchFill, { width: `${b.total > 0 ? (b.iq_done / b.total) * 100 : 0}%` }]} />
                </View>
                <Text style={a.batchCount}>{b.iq_done}/{b.total}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Data Sources */}
        <View style={a.sectionCard}>
          <View style={a.sectionHeader}>
            <MaterialIcons name="source" size={18} color="#8B5CF6" />
            <Text style={a.sectionTitle}>Fontes de Dados</Text>
          </View>
          {data.sources.map((s) => (
            <View key={s.name} style={a.sourceRow}>
              <View style={a.sourceDot} />
              <Text style={a.sourceName}>{s.name}</Text>
              <Text style={a.sourceCount}>{s.count}</Text>
            </View>
          ))}
        </View>

        {/* Recent Processed */}
        <View style={a.sectionCard}>
          <View style={a.sectionHeader}>
            <MaterialIcons name="history" size={18} color="#06B6D4" />
            <Text style={a.sectionTitle}>Recentemente Processados</Text>
          </View>
          {data.recent_processed.slice(0, 5).map((r) => (
            <View key={r.id} style={a.recentRow}>
              <View style={a.recentInfo}>
                <Text style={a.recentName} numberOfLines={1}>{r.name}</Text>
                <Text style={a.recentMeta}>{r.category} | {r.iq_module_count} módulos</Text>
              </View>
              <Text style={[a.recentScore, { color: r.iq_score >= 60 ? '#22C55E' : r.iq_score >= 40 ? '#C49A6C' : '#EF4444' }]}>{r.iq_score}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={a.statBox}>
      <MaterialIcons name={icon as any} size={16} color={color} />
      <Text style={[a.statVal, { color }]}>{value}</Text>
      <Text style={a.statLabel}>{label}</Text>
    </View>
  );
}

const a = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1419' },
  header: {
    backgroundColor: '#1A2332', paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#2D3748',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2D3748', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#F2EDE4' },
  headerSub: { fontSize: 11, color: '#64748B' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveText: { fontSize: 10, fontWeight: '700', color: '#22C55E', letterSpacing: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20, paddingHorizontal: 12 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statBox: {
    flex: 1, backgroundColor: '#1A2332', borderRadius: 12,
    padding: 10, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#2D3748',
  },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, color: '#64748B', fontWeight: '600' },

  // Progress
  progressCard: {
    marginTop: 12, backgroundColor: '#1A2332', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#2D3748',
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressTitle: { fontSize: 13, fontWeight: '600', color: '#F2EDE4' },
  progressPct: { fontSize: 16, fontWeight: '800', color: '#22C55E' },
  progressTrack: { height: 6, backgroundColor: '#2D3748', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#22C55E', borderRadius: 3 },
  progressDetail: { fontSize: 10, color: '#64748B', marginTop: 6 },

  // Sections
  sectionCard: {
    marginTop: 12, backgroundColor: '#1A2332', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#2D3748',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#F2EDE4' },

  // Modules
  moduleRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#2D374820',
  },
  moduleIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moduleInfo: { flex: 1, marginLeft: 10 },
  moduleName: { fontSize: 12, fontWeight: '600', color: '#C8C3B8' },
  moduleMetrics: { flexDirection: 'row', gap: 12, marginTop: 2 },
  moduleScore: { fontSize: 10, color: '#64748B' },
  moduleConf: { fontSize: 10, color: '#64748B' },
  moduleStatus: { alignItems: 'flex-end' },
  statusPass: { fontSize: 14, fontWeight: '700', color: '#22C55E' },
  statusCounts: { flexDirection: 'row', gap: 6, marginTop: 2 },

  // POIs
  poiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  poiRank: { fontSize: 14, fontWeight: '800', width: 28 },
  poiInfo: { flex: 1 },
  poiName: { fontSize: 12, fontWeight: '600', color: '#C8C3B8' },
  poiMeta: { fontSize: 10, color: '#64748B', marginTop: 1, textTransform: 'capitalize' },
  poiScoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  poiScoreText: { fontSize: 14, fontWeight: '700' },

  // Batches
  batchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  batchId: { fontSize: 10, fontWeight: '600', color: '#64748B', width: 80 },
  batchMeter: { flex: 1, height: 4, backgroundColor: '#2D3748', borderRadius: 2, overflow: 'hidden' },
  batchFill: { height: 4, backgroundColor: '#3B82F6', borderRadius: 2 },
  batchCount: { fontSize: 11, fontWeight: '600', color: '#C8C3B8', width: 70, textAlign: 'right' },

  // Sources
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  sourceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8B5CF6' },
  sourceName: { flex: 1, fontSize: 11, color: '#C8C3B8' },
  sourceCount: { fontSize: 12, fontWeight: '700', color: '#8B5CF6' },

  // Recent
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  recentInfo: { flex: 1 },
  recentName: { fontSize: 12, fontWeight: '600', color: '#C8C3B8' },
  recentMeta: { fontSize: 10, color: '#64748B', marginTop: 1, textTransform: 'capitalize' },
  recentScore: { fontSize: 16, fontWeight: '800' },
});
