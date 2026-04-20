/**
 * Content Health Dashboard — Admin
 *
 * Mostra a distribuição de saúde editorial dos POIs e a fila de trabalho
 * ordenada pelos mais críticos. Liga directamente ao Content Toolkit.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../src/context/ThemeContext';
import { shadows, palette } from '../src/theme';
import { API_BASE } from '../src/config/api';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthSummary {
  total_pois: number;
  avg_score: number;
  tiers: { healthy: number; attention: number; stale: number; critical: number };
  top_flags: Record<string, number>;
  last_computed: string;
}

interface StaleItem {
  poi_id: string;
  name: string;
  category: string;
  region: string;
  concelho: string;
  score: number;
  tier: string;
  breakdown: Record<string, number>;
  flags: string[];
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function fetchSummary(): Promise<HealthSummary> {
  const r = await fetch(`${API_BASE}/content-health/summary`);
  if (!r.ok) throw new Error('Erro ao carregar sumário');
  return r.json();
}

async function fetchStale(tier?: string, flag?: string, page = 1): Promise<{ items: StaleItem[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), page_size: '25' });
  if (tier) params.set('tier', tier);
  if (flag) params.set('flag', flag);
  const r = await fetch(`${API_BASE}/content-health/stale?${params}`);
  if (!r.ok) throw new Error('Erro ao carregar fila');
  return r.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  healthy: '#22C55E',
  attention: '#F59E0B',
  stale: '#EF4444',
  critical: '#7C3AED',
};

const TIER_LABELS: Record<string, string> = {
  healthy: 'Saudável',
  attention: 'Atenção',
  stale: 'Desactualizado',
  critical: 'Crítico',
};

const FLAG_LABELS: Record<string, string> = {
  sem_imagem: 'Sem imagem',
  descrição_desactualizada: 'Descrição antiga',
  sem_narrativa: 'Sem narrativa',
  sem_iq_score: 'Sem IQ Score',
  evento_próximo_sem_actualização: 'Evento próximo',
};

// ─── Componentes ─────────────────────────────────────────────────────────────

function TierBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.tierBarRow}>
      <Text style={styles.tierBarLabel}>{label}</Text>
      <View style={styles.tierBarTrack}>
        <View style={[styles.tierBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.tierBarCount, { color }]}>{count}</Text>
    </View>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  const color = flag === 'evento_próximo_sem_actualização' ? palette.terracotta[500] : '#64748B';
  return (
    <View style={[styles.flagBadge, { borderColor: color }]}>
      <Text style={[styles.flagText, { color }]}>{FLAG_LABELS[flag] || flag}</Text>
    </View>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const tier = score >= 75 ? 'healthy' : score >= 50 ? 'attention' : score >= 25 ? 'stale' : 'critical';
  const color = TIER_COLORS[tier];
  return (
    <View style={[styles.scoreMeter, { borderColor: color }]}>
      <Text style={[styles.scoreNum, { color }]}>{score}</Text>
    </View>
  );
}

// ─── Ecrã principal ──────────────────────────────────────────────────────────

export default function ContentHealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const [activeTier, setActiveTier] = useState<string | undefined>(undefined);
  const [activeFlag, setActiveFlag] = useState<string | undefined>(undefined);

  const { data: summary, isLoading: loadingSum, refetch: refetchSum } = useQuery({
    queryKey: ['content-health-summary'],
    queryFn: fetchSummary,
  });

  const { data: staleData, isLoading: loadingStale, refetch: refetchStale } = useQuery({
    queryKey: ['content-health-stale', activeTier, activeFlag],
    queryFn: () => fetchStale(activeTier, activeFlag),
  });

  const refresh = () => { refetchSum(); refetchStale(); };

  const tiers = summary?.tiers;
  const total = summary?.total_pois || 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={tc.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: tc.textPrimary }]}>Saúde Editorial</Text>
            <Text style={[styles.subtitle, { color: tc.textMuted }]}>
              {total > 0 ? `${total} POIs analisados` : 'A carregar…'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => fetch(`${API_BASE}/content-health/recompute`, { method: 'POST' })}
            style={[styles.recomputeBtn, { borderColor: tc.borderLight }]}
          >
            <MaterialIcons name="refresh" size={18} color={tc.textMuted} />
            <Text style={[styles.recomputeText, { color: tc.textMuted }]}>Recomputar</Text>
          </TouchableOpacity>
        </View>

        {/* Resumo global */}
        {loadingSum ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : summary ? (
          <View style={[styles.summaryCard, { backgroundColor: tc.surface }]}>
            <View style={styles.avgRow}>
              <View>
                <Text style={[styles.avgLabel, { color: tc.textMuted }]}>Score médio</Text>
                <Text style={[styles.avgValue, {
                  color: summary.avg_score >= 75 ? '#22C55E' : summary.avg_score >= 50 ? '#F59E0B' : '#EF4444',
                }]}>
                  {summary.avg_score}
                  <Text style={[styles.avgMax, { color: tc.textMuted }]}> /100</Text>
                </Text>
              </View>
              <View style={styles.tierPills}>
                {Object.entries(TIER_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.tierPill,
                      { borderColor: TIER_COLORS[key] },
                      activeTier === key && { backgroundColor: TIER_COLORS[key] },
                    ]}
                    onPress={() => setActiveTier(activeTier === key ? undefined : key)}
                  >
                    <Text style={[styles.tierPillText, {
                      color: activeTier === key ? '#fff' : TIER_COLORS[key],
                    }]}>
                      {tiers?.[key as keyof typeof tiers] || 0}
                    </Text>
                    <Text style={[styles.tierPillLabel, {
                      color: activeTier === key ? '#fff' : TIER_COLORS[key],
                    }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Barras de distribuição */}
            <View style={{ marginTop: 16, gap: 8 }}>
              {tiers && Object.entries(TIER_LABELS).map(([key, label]) => (
                <TierBar
                  key={key}
                  label={label}
                  count={tiers[key as keyof typeof tiers]}
                  total={total}
                  color={TIER_COLORS[key]}
                />
              ))}
            </View>

            {/* Top flags */}
            {summary.top_flags && Object.keys(summary.top_flags).length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.flagsTitle, { color: tc.textMuted }]}>Problemas frequentes</Text>
                <View style={styles.flagsRow}>
                  {Object.entries(summary.top_flags).slice(0, 6).map(([flag, count]) => (
                    <TouchableOpacity
                      key={flag}
                      onPress={() => setActiveFlag(activeFlag === flag ? undefined : flag)}
                    >
                      <View style={[
                        styles.flagChip,
                        { backgroundColor: activeFlag === flag ? palette.terracotta[100] : tc.background },
                      ]}>
                        <Text style={[styles.flagChipText, { color: tc.textSecondary }]}>
                          {FLAG_LABELS[flag] || flag}
                        </Text>
                        <Text style={[styles.flagChipCount, { color: palette.terracotta[500] }]}>
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* Filtros activos */}
        {(activeTier || activeFlag) && (
          <View style={styles.activeFilters}>
            <Text style={[styles.filterLabel, { color: tc.textMuted }]}>A filtrar:</Text>
            {activeTier && (
              <TouchableOpacity
                style={[styles.filterChip, { backgroundColor: TIER_COLORS[activeTier] }]}
                onPress={() => setActiveTier(undefined)}
              >
                <Text style={styles.filterChipText}>{TIER_LABELS[activeTier]}</Text>
                <MaterialIcons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            )}
            {activeFlag && (
              <TouchableOpacity
                style={[styles.filterChip, { backgroundColor: palette.terracotta[500] }]}
                onPress={() => setActiveFlag(undefined)}
              >
                <Text style={styles.filterChipText}>{FLAG_LABELS[activeFlag] || activeFlag}</Text>
                <MaterialIcons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Fila de trabalho */}
        <View style={styles.queueHeader}>
          <Text style={[styles.queueTitle, { color: tc.textPrimary }]}>
            Fila de Trabalho
          </Text>
          {staleData && (
            <Text style={[styles.queueCount, { color: tc.textMuted }]}>
              {staleData.total} POIs
            </Text>
          )}
        </View>

        {loadingStale ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : staleData?.items.map((item) => (
          <TouchableOpacity
            key={item.poi_id}
            style={[styles.poiCard, { backgroundColor: tc.surface }]}
            onPress={() => router.push(`/content-toolkit?poi_id=${item.poi_id}&poi_name=${encodeURIComponent(item.name)}`)}
            activeOpacity={0.8}
          >
            <ScoreMeter score={item.score} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.poiName, { color: tc.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.poiMeta, { color: tc.textMuted }]}>
                {item.category} · {item.concelho || item.region}
              </Text>
              {item.flags.length > 0 && (
                <View style={styles.poiFlagsRow}>
                  {item.flags.map((f) => <FlagBadge key={f} flag={f} />)}
                </View>
              )}
            </View>
            <MaterialIcons name="arrow-forward-ios" size={14} color={tc.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', fontFamily: serif },
  subtitle: { fontSize: 12, marginTop: 2 },
  recomputeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  recomputeText: { fontSize: 11 },

  summaryCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  avgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avgLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  avgValue: { fontSize: 36, fontWeight: '800' },
  avgMax: { fontSize: 14 },

  tierPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, justifyContent: 'flex-end' },
  tierPill: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    minWidth: 56,
  },
  tierPillText: { fontSize: 16, fontWeight: '800' },
  tierPillLabel: { fontSize: 9, fontWeight: '600' },

  tierBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierBarLabel: { width: 100, fontSize: 12, color: '#64748B' },
  tierBarTrack: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  tierBarFill: { height: 6, borderRadius: 3 },
  tierBarCount: { width: 36, textAlign: 'right', fontSize: 12, fontWeight: '700' },

  flagsTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  flagChipText: { fontSize: 11 },
  flagChipCount: { fontSize: 12, fontWeight: '700' },

  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterLabel: { fontSize: 12 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  queueTitle: { fontSize: 16, fontWeight: '700' },
  queueCount: { fontSize: 12 },

  poiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    ...shadows.sm,
  },
  scoreMeter: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNum: { fontSize: 15, fontWeight: '800' },
  poiName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  poiMeta: { fontSize: 11 },
  poiFlagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  flagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  flagText: { fontSize: 9, fontWeight: '600' },
});
