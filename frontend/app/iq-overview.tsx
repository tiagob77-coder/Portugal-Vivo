/**
 * IQ Overview - Painel de Monitorização do IQ Engine (Utilizador)
 * Mostra estatísticas gerais, progresso, scores e distribuição
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform, RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { getIQOverview } from '../src/services/api';
import { colors, shadows } from '../src/theme';

const { width } = Dimensions.get('window');

const CATEGORY_ICONS: Record<string, string> = {
  arte: 'palette', percursos: 'hiking', gastronomia: 'restaurant',
  miradouros: 'landscape', produtos: 'storefront', arqueologia: 'account-balance',
  rotas: 'map', aventura: 'terrain', tascas: 'local-bar',
  festas: 'celebration', fauna: 'pets', termas: 'hot-tub',
  areas_protegidas: 'park', cascatas: 'water', piscinas: 'pool',
  aldeias: 'home', saberes: 'school', religioso: 'church',
};

const CATEGORY_COLORS: Record<string, string> = {
  arte: '#8B5CF6', percursos: '#22C55E', gastronomia: '#EF4444',
  miradouros: '#06B6D4', produtos: '#C49A6C', arqueologia: '#B08556',
  rotas: '#3B82F6', aventura: '#84CC16', tascas: '#A855F7',
  festas: '#EC4899', fauna: '#14B8A6', termas: '#0EA5E9',
  areas_protegidas: '#059669', cascatas: '#6366F1', piscinas: '#0284C7',
};

function ProgressRing({ progress, size = 120 }: { progress: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (Platform.OS === 'web') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} style={{ position: 'absolute' } as any}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#22C55E" strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFF' }}>{Math.round(progress)}%</Text>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>processado</Text>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFF' }}>{Math.round(progress)}%</Text>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>processado</Text>
    </View>
  );
}

function ScoreBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={s.scoreBarRow}>
      <Text style={s.scoreBarLabel}>{label}</Text>
      <View style={s.scoreBarTrack}>
        <View style={[s.scoreBarFill, { width: `${Math.max(pct, 1)}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.scoreBarCount}>{count}</Text>
    </View>
  );
}

function CategoryCard({ name, count, avgScore, maxScore: _maxScore }: { name: string; count: number; avgScore: number; maxScore: number }) {
  const icon = CATEGORY_ICONS[name] || 'label';
  const color = CATEGORY_COLORS[name] || '#6B7280';
  return (
    <View style={s.catCard}>
      <View style={[s.catIcon, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={s.catName} numberOfLines={1}>{name}</Text>
      <Text style={s.catCount}>{count} POIs</Text>
      <View style={s.catScoreRow}>
        <Text style={[s.catScore, { color }]}>{avgScore}</Text>
        <Text style={s.catScoreLabel}>avg</Text>
      </View>
    </View>
  );
}

export default function IQOverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['iq-overview'],
    queryFn: getIQOverview,
    refetchInterval: 15000,
  });

  if (isLoading || !data) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.terracotta[500]} />
        <Text style={{ marginTop: 12, color: colors.gray[500] }}>A carregar IQ Engine...</Text>
      </View>
    );
  }

  const totalScored = data.score_distribution.reduce((acc, d) => acc + d.count, 0);

  return (
    <View style={s.container} data-testid="iq-overview-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} data-testid="iq-overview-back">
          <MaterialIcons name="arrow-back" size={22} color={colors.gray[800]} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>IQ Engine Monitor</Text>
          <Text style={s.headerSub}>{data.total_pois.toLocaleString()} POIs na base de dados</Text>
        </View>
        <TouchableOpacity style={s.adminBtn} onPress={() => router.push('/iq-admin')} data-testid="iq-admin-link">
          <MaterialIcons name="admin-panel-settings" size={20} color={colors.gray[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.terracotta[500]} />}
      >
        {/* Hero Progress Card */}
        <View style={s.heroCard}>
          <LinearGradient colors={['#1E3A5F', '#0F2744']} style={s.heroGrad}>
            <View style={s.heroRow}>
              <ProgressRing progress={data.iq_progress_pct} />
              <View style={s.heroStats}>
                <View style={s.heroStat}>
                  <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                  <Text style={s.heroStatVal}>{data.iq_processed.toLocaleString()}</Text>
                  <Text style={s.heroStatLabel}>processados</Text>
                </View>
                <View style={s.heroStat}>
                  <MaterialIcons name="pending" size={16} color="#C49A6C" />
                  <Text style={s.heroStatVal}>{data.iq_pending.toLocaleString()}</Text>
                  <Text style={s.heroStatLabel}>pendentes</Text>
                </View>
                <View style={s.heroStat}>
                  <MaterialIcons name="place" size={16} color="#3B82F6" />
                  <Text style={s.heroStatVal}>{data.with_coordinates.toLocaleString()}</Text>
                  <Text style={s.heroStatLabel}>com GPS</Text>
                </View>
              </View>
            </View>
            {data.iq_pending > 0 && (
              <View style={s.processingBanner}>
                <ActivityIndicator size="small" color="#22C55E" />
                <Text style={s.processingText}>A processar em background...</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* IQ Score Summary */}
        <View style={s.scoreCard}>
          <View style={s.scoreHeader}>
            <MaterialIcons name="insights" size={20} color={colors.terracotta[500]} />
            <Text style={s.scoreTitle}>Score IQ Médio</Text>
          </View>
          <View style={s.scoreRow}>
            <View style={s.scoreBig}>
              <Text style={s.scoreBigVal}>{data.avg_iq_score}</Text>
              <Text style={s.scoreBigLabel}>média</Text>
            </View>
            <View style={s.scoreMini}>
              <MaterialIcons name="arrow-upward" size={14} color="#22C55E" />
              <Text style={s.scoreMiniVal}>{data.max_iq_score}</Text>
              <Text style={s.scoreMiniLabel}>máximo</Text>
            </View>
            <View style={s.scoreMini}>
              <MaterialIcons name="arrow-downward" size={14} color="#EF4444" />
              <Text style={s.scoreMiniVal}>{data.min_iq_score}</Text>
              <Text style={s.scoreMiniLabel}>mínimo</Text>
            </View>
          </View>
        </View>

        {/* Score Distribution */}
        <View style={s.distCard}>
          <Text style={s.distTitle}>Distribuição de Qualidade</Text>
          {data.score_distribution.map((d) => (
            <ScoreBar key={d.label} label={d.label} count={d.count} total={totalScored} color={d.color} />
          ))}
        </View>

        {/* Categories */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <MaterialIcons name="category" size={18} color={colors.terracotta[500]} />
            <Text style={s.sectionTitle}>Categorias ({data.categories.length})</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
            {data.categories.map((c) => (
              <CategoryCard key={c.name} name={c.name} count={c.count} avgScore={c.avg_score} maxScore={c.max_score} />
            ))}
          </ScrollView>
        </View>

        {/* Regions */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <MaterialIcons name="public" size={18} color={colors.ocean[500]} />
            <Text style={s.sectionTitle}>Regiões</Text>
          </View>
          <View style={s.regGrid}>
            {data.regions.map((r) => (
              <View key={r.name} style={s.regCard}>
                <Text style={s.regName}>{r.name}</Text>
                <Text style={s.regCount}>{r.count} POIs</Text>
                <View style={s.regScoreBadge}>
                  <Text style={s.regScore}>{r.avg_score}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.gray[200],
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.gray[800] },
  headerSub: { fontSize: 12, color: colors.gray[400], marginTop: 1 },
  adminBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Hero
  heroCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden', ...shadows.lg },
  heroGrad: { padding: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  heroStats: { flex: 1, gap: 10 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroStatVal: { fontSize: 16, fontWeight: '700', color: '#FFF', minWidth: 50 },
  heroStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  processingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  processingText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  // Score Card
  scoreCard: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.background.secondary,
    borderRadius: 16, padding: 16, ...shadows.sm,
  },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  scoreTitle: { fontSize: 16, fontWeight: '600', color: colors.gray[800] },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  scoreBig: { alignItems: 'center' },
  scoreBigVal: { fontSize: 36, fontWeight: '800', color: colors.terracotta[500] },
  scoreBigLabel: { fontSize: 11, color: colors.gray[400] },
  scoreMini: { alignItems: 'center', gap: 2 },
  scoreMiniVal: { fontSize: 18, fontWeight: '700', color: colors.gray[700] },
  scoreMiniLabel: { fontSize: 10, color: colors.gray[400] },

  // Distribution
  distCard: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.background.secondary,
    borderRadius: 16, padding: 16, ...shadows.sm,
  },
  distTitle: { fontSize: 14, fontWeight: '600', color: colors.gray[700], marginBottom: 12 },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  scoreBarLabel: { fontSize: 11, fontWeight: '600', color: colors.gray[500], width: 65 },
  scoreBarTrack: { flex: 1, height: 8, backgroundColor: colors.gray[100], borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: 8, borderRadius: 4 },
  scoreBarCount: { fontSize: 12, fontWeight: '700', color: colors.gray[600], width: 40, textAlign: 'right' },

  // Categories
  section: { marginTop: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.gray[800] },
  catScroll: { paddingHorizontal: 16, gap: 10 },
  catCard: {
    width: 110, backgroundColor: colors.background.secondary, borderRadius: 14,
    padding: 12, alignItems: 'center', ...shadows.sm,
  },
  catIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catName: { fontSize: 11, fontWeight: '600', color: colors.gray[700], textAlign: 'center', textTransform: 'capitalize' },
  catCount: { fontSize: 10, color: colors.gray[400], marginTop: 2 },
  catScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 6 },
  catScore: { fontSize: 16, fontWeight: '700' },
  catScoreLabel: { fontSize: 9, color: colors.gray[400] },

  // Regions
  regGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  regCard: {
    width: (width - 48) / 3, backgroundColor: colors.background.secondary, borderRadius: 12,
    padding: 10, alignItems: 'center', ...shadows.sm,
  },
  regName: { fontSize: 12, fontWeight: '600', color: colors.gray[700], textTransform: 'capitalize' },
  regCount: { fontSize: 10, color: colors.gray[400], marginTop: 2 },
  regScoreBadge: {
    marginTop: 6, backgroundColor: colors.ocean[50], paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: 8,
  },
  regScore: { fontSize: 13, fontWeight: '700', color: colors.ocean[500] },
});
