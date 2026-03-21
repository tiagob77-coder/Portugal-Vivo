/**
 * Admin Dashboard — Unified management panel
 * Shows POI stats, user metrics, subscription data, data quality, and quick actions
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Image, Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../src/services/api';
import { useTheme } from '../src/context/ThemeContext';
import { shadows } from '../src/theme';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

interface AdminData {
  overview: {
    total_pois: number;
    total_routes: number;
    total_users: number;
    total_events: number;
    active_subscriptions: number;
  };
  data_quality: {
    pois_with_gps: number;
    pois_without_gps: number;
    gps_coverage_pct: number;
    pois_with_images: number;
    image_coverage_pct: number;
    iq_processed: number;
    iq_pending: number;
    iq_coverage_pct: number;
    avg_iq_score: number;
  };
  activity: {
    new_users_7d: number;
    visits_30d: number;
    reviews_7d: number;
  };
  categories: { id: string; count: number }[];
  regions: { id: string; count: number }[];
  top_subcategories: { id: string; count: number }[];
  top_pois: { name: string; iq_score: number; category: string; region: string }[];
}

const fetchAdmin = async (): Promise<AdminData> => {
  const r = await api.get('/admin/dashboard');
  return r.data;
};

const REGION_COLORS: Record<string, string> = {
  norte: '#3B82F6', centro: '#22C55E', lisboa: '#F59E0B',
  alentejo: '#EF4444', algarve: '#06B6D4', acores: '#8B5CF6', madeira: '#EC4899',
};

const QUICK_ACTIONS = [
  { label: 'IQ Admin', icon: 'admin-panel-settings', route: '/iq-admin', color: '#8B5CF6' },
  { label: 'IQ Dashboard', icon: 'insights', route: '/iq-dashboard', color: '#3B82F6' },
  { label: 'Importador', icon: 'cloud-upload', route: '/importer', color: '#22C55E' },
  { label: 'Premium Stats', icon: 'diamond', route: '/premium', color: '#C49A6C' },
  { label: 'Analytics', icon: 'bar-chart', route: '/analytics', color: '#F59E0B' },
  { label: 'CAOP', icon: 'public', route: '', color: '#10B981' },
  { label: 'Moderação Imagens', icon: 'photo-library', route: '', color: '#EC4899' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [showModeration, setShowModeration] = useState(false);
  const [showCaop, setShowCaop] = useState(false);
  const [caopLaunching, setCaopLaunching] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchAdmin,
    refetchInterval: 30000,
  });

  const { data: uploadsData, isLoading: uploadsLoading } = useQuery({
    queryKey: ['admin-uploads'],
    queryFn: async () => { const res = await api.get('/admin/uploads', { params: { limit: 20 } }); return res.data; },
    enabled: showModeration,
  });

  // CAOP stats + live job status
  const { data: caopStats, refetch: refetchCaopStats } = useQuery({
    queryKey: ['caop-stats'],
    queryFn: async () => { const res = await api.get('/geo/stats'); return res.data; },
    enabled: showCaop,
    staleTime: 0,
  });

  const { data: caopJob, refetch: refetchCaopJob } = useQuery({
    queryKey: ['caop-job'],
    queryFn: async () => { const res = await api.get('/geo/enrich-status'); return res.data; },
    enabled: showCaop,
    refetchInterval: (data: any) => (data?.status === 'running' ? 3000 : false),
  });

  const handleStartCaop = async () => {
    if (caopJob?.status === 'running') {
      if (Platform.OS === 'web') {
        window.alert('Já existe um job em curso. Aguarda a conclusão.');
      } else {
        Alert.alert('Em curso', 'Já existe um job em curso. Aguarda a conclusão.');
      }
      return;
    }
    setCaopLaunching(true);
    try {
      await api.post('/geo/enrich-all', null, { params: { only_missing: true, delay: 1.1 } });
      setTimeout(() => { refetchCaopJob(); refetchCaopStats(); }, 800);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Erro ao iniciar job';
      if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Erro', msg); }
    } finally {
      setCaopLaunching(false);
    }
  };

  const handleCancelCaop = async () => {
    try {
      await api.post('/geo/enrich-cancel');
      refetchCaopJob();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Erro ao cancelar';
      if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Erro', msg); }
    }
  };

  const handleModerate = useCallback(async (imageId: string, action: 'approve' | 'reject' | 'delete') => {
    try {
      await api.post(`/admin/uploads/${imageId}/moderate`, { action });
      queryClient.invalidateQueries({ queryKey: ['admin-uploads'] });
      const msg = action === 'approve' ? 'Imagem aprovada' : action === 'reject' ? 'Imagem rejeitada' : 'Imagem eliminada';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sucesso', msg); // eslint-disable-line no-unused-expressions
    } catch {
      const errMsg = 'Erro ao moderar imagem';
      Platform.OS === 'web' ? window.alert(errMsg) : Alert.alert('Erro', errMsg); // eslint-disable-line no-unused-expressions
    }
  }, [queryClient]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const ov = data?.overview;
  const dq = data?.data_quality;
  const act = data?.activity;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#1E3A3F', '#2A5F6B']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Painel de Administração</Text>
            <TouchableOpacity onPress={() => router.push('/iq-admin' as any)}>
              <MaterialIcons name="settings" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Portugal Vivo — Métricas e Gestão</Text>
        </LinearGradient>

        {/* Overview Cards */}
        <View style={styles.cardsGrid}>
          <MetricCard icon="place" label="POIs" value={ov?.total_pois || 0} color="#3B82F6" colors={colors} />
          <MetricCard icon="alt-route" label="Rotas" value={ov?.total_routes || 0} color="#22C55E" colors={colors} />
          <MetricCard icon="people" label="Utilizadores" value={ov?.total_users || 0} color="#F59E0B" colors={colors} />
          <MetricCard icon="event" label="Eventos" value={ov?.total_events || 0} color="#EC4899" colors={colors} />
          <MetricCard icon="diamond" label="Subscrições" value={ov?.active_subscriptions || 0} color="#C49A6C" colors={colors} />
          <MetricCard icon="star" label="IQ Score" value={dq?.avg_iq_score || 0} color="#8B5CF6" colors={colors} decimal />
        </View>

        {/* Data Quality */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Qualidade dos Dados</Text>
          <QualityBar label="GPS" value={dq?.gps_coverage_pct || 0} count={dq?.pois_with_gps || 0} total={ov?.total_pois || 0} color="#3B82F6" colors={colors} />
          <QualityBar label="Imagens" value={dq?.image_coverage_pct || 0} count={dq?.pois_with_images || 0} total={ov?.total_pois || 0} color="#22C55E" colors={colors} />
          <QualityBar label="IQ Score" value={dq?.iq_coverage_pct || 0} count={dq?.iq_processed || 0} total={ov?.total_pois || 0} color="#8B5CF6" colors={colors} />
        </View>

        {/* Activity */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Atividade Recente</Text>
          <View style={styles.activityRow}>
            <ActivityStat icon="person-add" label="Novos (7d)" value={act?.new_users_7d || 0} color="#3B82F6" colors={colors} />
            <ActivityStat icon="place" label="Visitas (30d)" value={act?.visits_30d || 0} color="#22C55E" colors={colors} />
            <ActivityStat icon="rate-review" label="Reviews (7d)" value={act?.reviews_7d || 0} color="#F59E0B" colors={colors} />
          </View>
        </View>

        {/* Regions breakdown */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>POIs por Região</Text>
          {data?.regions.map(r => (
            <View key={r.id} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.textPrimary }]}>{r.id}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                  width: `${Math.min(100, r.count / Math.max(1, ...(data?.regions.map(x => x.count) || [1])) * 100)}%`,
                  backgroundColor: REGION_COLORS[r.id] || colors.accent,
                }]} />
              </View>
              <Text style={[styles.barCount, { color: colors.textMuted }]}>{r.count}</Text>
            </View>
          ))}
        </View>

        {/* Top Subcategories */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top Subcategorias</Text>
          {data?.top_subcategories.slice(0, 10).map((s, i) => (
            <View key={s.id} style={styles.rankRow}>
              <Text style={[styles.rankNum, { color: colors.textMuted }]}>#{i + 1}</Text>
              <Text style={[styles.rankLabel, { color: colors.textPrimary }]}>{s.id.replace(/_/g, ' ')}</Text>
              <Text style={[styles.rankCount, { color: colors.accent }]}>{s.count}</Text>
            </View>
          ))}
        </View>

        {/* Top POIs */}
        {data?.top_pois && data.top_pois.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top 5 POIs (IQ Score)</Text>
            {data.top_pois.map((poi, i) => (
              <View key={i} style={styles.poiRow}>
                <View style={[styles.poiRank, { backgroundColor: i === 0 ? '#C49A6C' : colors.accent + '20' }]}>
                  <Text style={[styles.poiRankText, { color: i === 0 ? '#FFF' : colors.accent }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.poiName, { color: colors.textPrimary }]} numberOfLines={1}>{poi.name}</Text>
                  <Text style={[styles.poiMeta, { color: colors.textMuted }]}>{poi.region} · {poi.category}</Text>
                </View>
                <Text style={[styles.poiScore, { color: '#C49A6C' }]}>{poi.iq_score.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ações Rápidas</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map(action => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionCard, { borderColor: colors.borderLight }]}
                onPress={() => {
                  if (action.label === 'Moderação Imagens') {
                    setShowModeration(!showModeration);
                  } else if (action.label === 'CAOP') {
                    setShowCaop(!showCaop);
                  } else {
                    router.push(action.route as any);
                  }
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                  <MaterialIcons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* CAOP Enrichment Panel */}
        {showCaop && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.moderationHeader}>
              <MaterialIcons name="public" size={22} color="#10B981" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                CAOP — Dados Administrativos
              </Text>
            </View>

            {/* Coverage stats */}
            {caopStats && (
              <View style={styles.caopStatsRow}>
                <View style={[styles.caopStat, { backgroundColor: '#10B98115' }]}>
                  <Text style={[styles.caopStatVal, { color: '#10B981' }]}>
                    {caopStats.caop_coverage?.pct_concelho ?? '–'}%
                  </Text>
                  <Text style={[styles.caopStatLabel, { color: colors.textMuted }]}>Concelhos</Text>
                </View>
                <View style={[styles.caopStat, { backgroundColor: '#3B82F615' }]}>
                  <Text style={[styles.caopStatVal, { color: '#3B82F6' }]}>
                    {caopStats.caop_coverage?.pct_freguesia ?? '–'}%
                  </Text>
                  <Text style={[styles.caopStatLabel, { color: colors.textMuted }]}>Freguesias</Text>
                </View>
                <View style={[styles.caopStat, { backgroundColor: '#F59E0B15' }]}>
                  <Text style={[styles.caopStatVal, { color: '#F59E0B' }]}>
                    {caopStats.pending_enrichment ?? '–'}
                  </Text>
                  <Text style={[styles.caopStatLabel, { color: colors.textMuted }]}>Pendentes</Text>
                </View>
              </View>
            )}

            {/* Job status bar */}
            {caopJob && caopJob.status !== 'idle' && (
              <View style={[styles.caopJobBox, { borderColor: colors.borderLight }]}>
                <View style={styles.caopJobHeader}>
                  <Text style={[styles.caopJobStatus, {
                    color: caopJob.status === 'running' ? '#10B981'
                         : caopJob.status === 'done' ? '#3B82F6'
                         : '#EF4444'
                  }]}>
                    {caopJob.status === 'running' ? '⬤ A enriquecer…'
                   : caopJob.status === 'done' ? '✓ Concluído'
                   : caopJob.status === 'error' ? '✗ Erro'
                   : caopJob.status}
                  </Text>
                  <Text style={[styles.caopJobMeta, { color: colors.textMuted }]}>
                    {caopJob.processed}/{caopJob.total} POIs
                  </Text>
                </View>

                {/* Progress bar */}
                <View style={[styles.caopProgressBg, { backgroundColor: colors.borderLight }]}>
                  <View style={[styles.caopProgressFill, {
                    width: `${caopJob.pct_complete ?? 0}%` as any,
                    backgroundColor: caopJob.status === 'error' ? '#EF4444' : '#10B981',
                  }]} />
                </View>

                <Text style={[styles.caopJobDetail, { color: colors.textMuted }]}>
                  {caopJob.pct_complete}% · {caopJob.updated} atualizados · {caopJob.errors} erros
                  {caopJob.last_poi ? ` · ${caopJob.last_poi}` : ''}
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.caopBtnRow}>
              <TouchableOpacity
                style={[styles.caopBtn, {
                  backgroundColor: caopJob?.status === 'running' ? '#6B7280' : '#10B981',
                  flex: 1,
                }]}
                onPress={handleStartCaop}
                disabled={caopLaunching || caopJob?.status === 'running'}
              >
                {caopLaunching
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <MaterialIcons name="play-arrow" size={18} color="#FFF" />
                }
                <Text style={styles.caopBtnText}>
                  {caopJob?.status === 'running' ? 'Em curso…' : 'Iniciar Enriquecimento'}
                </Text>
              </TouchableOpacity>

              {caopJob?.status === 'running' && (
                <TouchableOpacity
                  style={[styles.caopBtn, { backgroundColor: '#EF4444', paddingHorizontal: 14 }]}
                  onPress={handleCancelCaop}
                >
                  <MaterialIcons name="stop" size={18} color="#FFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.caopBtn, { backgroundColor: colors.borderLight, paddingHorizontal: 14 }]}
                onPress={() => { refetchCaopStats(); refetchCaopJob(); }}
              >
                <MaterialIcons name="refresh" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.caopNote, { color: colors.textMuted }]}>
              Corre dentro do Docker — sem necessidade de SSH.{'\n'}
              Fonte: GeoAPI.pt (DGT/CAOP oficial). Rate: 1 req/s.
            </Text>
          </View>
        )}

        {/* Image Moderation */}
        {showModeration && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.moderationHeader}>
              <MaterialIcons name="photo-library" size={22} color="#EC4899" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                Moderação de Imagens
              </Text>
              <View style={[styles.modBadge, { backgroundColor: '#EC489920' }]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#EC4899' }}>
                  {uploadsData?.total || 0}
                </Text>
              </View>
            </View>
            {uploadsLoading ? (
              <ActivityIndicator size="large" color="#EC4899" style={{ marginTop: 20 }} />
            ) : uploadsData?.uploads && uploadsData.uploads.length > 0 ? (
              <View style={styles.moderationGrid}>
                {uploadsData.uploads.map((upload: any, idx: number) => {
                  const imgId = upload.public_id || upload.id || `img-${idx}`;
                  const status = upload.moderation_status;
                  return (
                    <View key={imgId} style={[styles.modCard, { borderColor: colors.borderLight }]}>
                      <Image
                        source={{ uri: upload.thumbnail_url || upload.url }}
                        style={styles.modImage}
                        resizeMode="cover"
                      />
                      <View style={styles.modInfo}>
                        <Text style={[styles.modUser, { color: colors.textMuted }]} numberOfLines={1}>
                          {upload.user_id?.slice(0, 8) || 'user'}
                        </Text>
                        {upload.poi_id && (
                          <Text style={[styles.modPoi, { color: colors.textMuted }]} numberOfLines={1}>
                            POI: {upload.poi_id.slice(0, 8)}
                          </Text>
                        )}
                        {status && (
                          <View style={[styles.modStatusBadge, {
                            backgroundColor: status === 'approved' ? '#22C55E20' : status === 'rejected' ? '#EF444420' : '#F59E0B20',
                          }]}>
                            <Text style={{
                              fontSize: 10, fontWeight: '600',
                              color: status === 'approved' ? '#22C55E' : status === 'rejected' ? '#EF4444' : '#F59E0B',
                            }}>
                              {status === 'approved' ? 'Aprovada' : status === 'rejected' ? 'Rejeitada' : 'Pendente'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.modActions}>
                        <TouchableOpacity
                          style={[styles.modBtn, { backgroundColor: '#22C55E' }]}
                          onPress={() => handleModerate(imgId, 'approve')}
                        >
                          <MaterialIcons name="check" size={16} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modBtn, { backgroundColor: '#F59E0B' }]}
                          onPress={() => handleModerate(imgId, 'reject')}
                        >
                          <MaterialIcons name="block" size={16} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modBtn, { backgroundColor: '#EF4444' }]}
                          onPress={() => handleModerate(imgId, 'delete')}
                        >
                          <MaterialIcons name="delete" size={16} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
                <MaterialIcons name="check-circle" size={40} color="#22C55E" />
                <Text style={[{ fontSize: 14, fontWeight: '600', color: colors.textMuted }]}>
                  Nenhuma imagem pendente
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// Sub-components
function MetricCard({ icon, label, value, color, colors, decimal }: any) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
      <MaterialIcons name={icon} size={22} color={color} />
      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
        {decimal ? value.toFixed(1) : value.toLocaleString()}
      </Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function QualityBar({ label, value, count, total, color, colors }: any) {
  return (
    <View style={styles.qualityRow}>
      <View style={styles.qualityHeader}>
        <Text style={[styles.qualityLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.qualityPct, { color }]}>{value}%</Text>
      </View>
      <View style={[styles.qualityTrack, { backgroundColor: colors.borderLight }]}>
        <View style={[styles.qualityFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.qualityCount, { color: colors.textMuted }]}>{count}/{total}</Text>
    </View>
  );
}

function ActivityStat({ icon, label, value, color, colors }: any) {
  return (
    <View style={styles.activityItem}>
      <MaterialIcons name={icon} size={20} color={color} />
      <Text style={[styles.activityValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.activityLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', fontFamily: serif },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  // Cards Grid
  cardsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: -20,
    gap: 10, justifyContent: 'space-between',
  },
  metricCard: {
    width: '31%' as any, flexBasis: '30%', alignItems: 'center', padding: 14,
    borderRadius: 12, gap: 4, ...shadows.sm,
  },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  // Sections
  section: {
    marginHorizontal: 16, marginTop: 16, padding: 16,
    borderRadius: 14, ...shadows.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, fontFamily: serif },
  // Quality bars
  qualityRow: { marginBottom: 14 },
  qualityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  qualityLabel: { fontSize: 13, fontWeight: '600' },
  qualityPct: { fontSize: 13, fontWeight: '700' },
  qualityTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  qualityFill: { height: '100%', borderRadius: 3 },
  qualityCount: { fontSize: 11, marginTop: 2 },
  // Activity
  activityRow: { flexDirection: 'row', justifyContent: 'space-around' },
  activityItem: { alignItems: 'center', gap: 4 },
  activityValue: { fontSize: 20, fontWeight: '800' },
  activityLabel: { fontSize: 11 },
  // Bars
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { width: 60, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { width: 40, fontSize: 12, textAlign: 'right' },
  // Rank
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  rankNum: { width: 24, fontSize: 12, fontWeight: '600' },
  rankLabel: { flex: 1, fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
  rankCount: { fontSize: 13, fontWeight: '700' },
  // POIs
  poiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  poiRank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  poiRankText: { fontSize: 13, fontWeight: '700' },
  poiName: { fontSize: 14, fontWeight: '600' },
  poiMeta: { fontSize: 11, marginTop: 1, textTransform: 'capitalize' },
  poiScore: { fontSize: 16, fontWeight: '800' },
  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '47%' as any, flexBasis: '47%', alignItems: 'center', padding: 16,
    borderRadius: 12, borderWidth: 1, gap: 8,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  // Image Moderation
  moderationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  modBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 'auto' },
  moderationGrid: { gap: 10 },
  modCard: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderRadius: 10, borderWidth: 1, gap: 10,
  },
  modImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#E5E7EB' },
  modInfo: { flex: 1, gap: 2 },
  modUser: { fontSize: 12, fontWeight: '600' },
  modPoi: { fontSize: 11 },
  modStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  modActions: { flexDirection: 'column', gap: 4 },
  modBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  // CAOP
  caopStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  caopStat: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  caopStatVal: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  caopStatLabel: { fontSize: 11, fontWeight: '500' },
  caopJobBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14, gap: 8 },
  caopJobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caopJobStatus: { fontSize: 13, fontWeight: '700' },
  caopJobMeta: { fontSize: 12 },
  caopProgressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  caopProgressFill: { height: 6, borderRadius: 3 },
  caopJobDetail: { fontSize: 11 },
  caopBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  caopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10,
  },
  caopBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  caopNote: { fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
