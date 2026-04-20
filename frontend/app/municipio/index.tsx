/**
 * Painel Municipal — Dashboard principal
 *
 * Mostra métricas do município, distribuição de saúde de conteúdo,
 * ações rápidas e POIs que precisam de atenção.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import { shadows } from '../../src/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MunicipalityMetrics {
  total_pois: number;
  published_pois: number;
  draft_pois: number;
  avg_health_score: number;
  municipality: string;
}

interface HealthSummary {
  healthy: number;   // ≥75
  attention: number; // ≥50
  stale: number;     // ≥25
  critical: number;  // <25
  total: number;
}

interface PoiAttention {
  id: string;
  name: string;
  category: string;
  content_health_score: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#2E5E4E';
const GRADIENT_START = '#1B3D39';
const GRADIENT_END = '#2E5E4E';
const BG = '#F8FAFC';
const isWeb = Platform.OS === 'web';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getHealthColor(score: number): string {
  if (score >= 75) return '#22C55E';
  if (score >= 50) return '#F59E0B';
  if (score >= 25) return '#F97316';
  return '#EF4444';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function getTodayString(): string {
  return new Date().toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  iconName,
  color,
}: {
  label: string;
  value: string | number;
  iconName: string;
  color: string;
}) {
  return (
    <View style={[s.statCard, isWeb && s.statCardWeb]}>
      <View style={[s.statIconWrap, { backgroundColor: color + '18' }]}>
        <MaterialIcons name={iconName as any} size={20} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function QuickActionButton({
  label,
  iconName,
  onPress,
}: {
  label: string;
  iconName: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.quickAction} onPress={onPress} activeOpacity={0.75}>
      <View style={s.quickActionIcon}>
        <MaterialIcons name={iconName as any} size={22} color={ACCENT} />
      </View>
      <Text style={s.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function PoiAttentionRow({ poi }: { poi: PoiAttention }) {
  const router = useRouter();
  const color = getHealthColor(poi.content_health_score);
  return (
    <TouchableOpacity
      style={s.attentionRow}
      onPress={() => router.push('/municipio/pois' as any)}
      activeOpacity={0.7}
    >
      <View style={[s.attentionDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.attentionName} numberOfLines={1}>{poi.name}</Text>
        <Text style={s.attentionCategory}>{poi.category}</Text>
      </View>
      <View style={[s.healthBadge, { backgroundColor: color + '20' }]}>
        <Text style={[s.healthBadgeText, { color }]}>{poi.content_health_score}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={18} color="#94A3B8" style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}

// ─── Empty state (403 / no partner org) ──────────────────────────────────────

function NoPartnerState() {
  const router = useRouter();
  return (
    <View style={s.emptyState}>
      <MaterialIcons name="location-city" size={56} color="#CBD5E1" />
      <Text style={s.emptyTitle}>Ainda não tens organização parceira</Text>
      <Text style={s.emptySubtitle}>
        Para aceder ao painel municipal, a tua câmara ou organização precisa de
        estar registada como parceira do Portugal Vivo.
      </Text>
      <TouchableOpacity
        style={s.emptyButton}
        onPress={() => router.push('/partner-portal' as any)}
        activeOpacity={0.8}
      >
        <Text style={s.emptyButtonText}>Registar organização</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MunicipioDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, sessionToken } = useAuth();

  const authHeaders = sessionToken
    ? { Authorization: `Bearer ${sessionToken}` }
    : {};

  // Fetch metrics
  const {
    data: metrics,
    isLoading: loadingMetrics,
    error: metricsError,
  } = useQuery<MunicipalityMetrics>({
    queryKey: ['partner-metrics'],
    queryFn: async () => {
      const response = await api.get('/partner/metrics', { headers: authHeaders });
      return response.data;
    },
    retry: false,
  });

  // Fetch health summary
  const {
    data: health,
    isLoading: loadingHealth,
  } = useQuery<HealthSummary>({
    queryKey: ['partner-health-summary'],
    queryFn: async () => {
      const response = await api.get('/partner/health-summary', { headers: authHeaders });
      return response.data;
    },
    retry: false,
    enabled: (metricsError as any)?.response?.status !== 403,
  });

  // Derive attention POIs from health data (critical field may contain array)
  const attentionPois: PoiAttention[] = Array.isArray((health as any)?.critical_pois)
    ? ((health as any).critical_pois as PoiAttention[]).slice(0, 5)
    : [];

  // 403 — not a partner
  if ((metricsError as any)?.response?.status === 403) {
    return (
      <View style={[s.root, { paddingTop: isWeb ? 0 : insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <NoPartnerState />
      </View>
    );
  }

  const isLoading = loadingMetrics || loadingHealth;
  const municipioName = metrics?.municipality ?? (user as any)?.municipality ?? 'Município';
  const userName = (user as any)?.name ?? (user as any)?.email ?? 'Utilizador';

  // Health bar widths
  const total = health?.total || 1;
  const healthSegments = [
    { label: 'Excelente', count: health?.healthy ?? 0, color: '#22C55E' },
    { label: 'Bom',       count: health?.attention ?? 0, color: '#F59E0B' },
    { label: 'Atenção',   count: health?.stale ?? 0, color: '#F97316' },
    { label: 'Crítico',   count: health?.critical ?? 0, color: '#EF4444' },
  ];

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Mobile header (web has sidebar from layout) */}
      {!isWeb && (
        <View style={[s.mobileHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="menu" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={s.mobileHeaderTitle}>Painel Municipal</Text>
          <View style={s.avatarCircle}>
            <Text style={s.avatarInitials}>{getInitials(userName)}</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, isWeb && s.scrollContentWeb]}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome card */}
        <LinearGradient
          colors={[GRADIENT_START, GRADIENT_END]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.welcomeCard}
        >
          <View style={s.welcomeRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.welcomeGreeting}>Bom dia, {userName.split(' ')[0]}</Text>
              <Text style={s.welcomeMunicipio}>{municipioName}</Text>
              <View style={s.roleBadge}>
                <Text style={s.roleBadgeText}>Admin Municipal</Text>
              </View>
            </View>
            <MaterialIcons name="location-city" size={42} color="rgba(255,255,255,0.25)" />
          </View>
          <Text style={s.welcomeDate}>{getTodayString()}</Text>
        </LinearGradient>

        {/* Stats row */}
        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="small" color={ACCENT} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.statsRow}
            scrollEnabled={!isWeb}
          >
            <StatCard
              label="Total POIs"
              value={metrics?.total_pois ?? '—'}
              iconName="place"
              color="#3B82F6"
            />
            <StatCard
              label="Publicados"
              value={metrics?.published_pois ?? '—'}
              iconName="check-circle"
              color="#22C55E"
            />
            <StatCard
              label="Em rascunho"
              value={metrics?.draft_pois ?? '—'}
              iconName="edit"
              color="#F59E0B"
            />
            <StatCard
              label="Score médio"
              value={
                metrics?.avg_health_score != null
                  ? metrics.avg_health_score.toFixed(0)
                  : '—'
              }
              iconName="trending-up"
              color="#8B5CF6"
            />
          </ScrollView>
        )}

        {/* Health distribution */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Saúde do Conteúdo</Text>
          {loadingHealth ? (
            <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 12 }} />
          ) : (
            <>
              {/* Segmented bar */}
              <View style={s.healthBarTrack}>
                {healthSegments.map((seg) => {
                  const pct = total > 0 ? (seg.count / total) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <View
                      key={seg.label}
                      style={[s.healthBarSeg, { flex: pct, backgroundColor: seg.color }]}
                    />
                  );
                })}
              </View>
              {/* Labels */}
              <View style={s.healthLabels}>
                {healthSegments.map((seg) => (
                  <View key={seg.label} style={s.healthLabelItem}>
                    <View style={[s.healthDot, { backgroundColor: seg.color }]} />
                    <Text style={s.healthLabelText}>
                      {seg.label}{' '}
                      <Text style={{ fontWeight: '700' }}>{seg.count}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Quick actions */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Ações Rápidas</Text>
          <View style={s.quickGrid}>
            <QuickActionButton
              label="Adicionar POI"
              iconName="add-location"
              onPress={() => router.push('/municipio/pois?new=1' as any)}
            />
            <QuickActionButton
              label="Importar Excel"
              iconName="upload-file"
              onPress={() => router.push('/municipio/importar' as any)}
            />
            <QuickActionButton
              label="Ver Eventos"
              iconName="event"
              onPress={() => router.push('/municipio/eventos' as any)}
            />
            <QuickActionButton
              label="Gerir Equipa"
              iconName="group"
              onPress={() => router.push('/municipio/utilizadores' as any)}
            />
          </View>
        </View>

        {/* POIs que precisam de atenção */}
        <View style={[s.card, { marginBottom: isWeb ? 32 : 16 }]}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle}>POIs que precisam de atenção</Text>
            <TouchableOpacity onPress={() => router.push('/municipio/pois' as any)}>
              <Text style={s.seeAll}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {loadingHealth ? (
            <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 12 }} />
          ) : attentionPois.length > 0 ? (
            attentionPois.map((poi) => <PoiAttentionRow key={poi.id} poi={poi} />)
          ) : (
            <View style={s.noAttentionWrap}>
              <MaterialIcons name="check-circle" size={32} color="#22C55E" />
              <Text style={s.noAttentionText}>
                {health?.critical === 0
                  ? 'Sem POIs críticos — excelente trabalho!'
                  : 'Navega para a secção de POIs para ver os detalhes.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  // Mobile header
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...shadows.sm,
  },
  mobileHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  scrollContentWeb: {
    maxWidth: 860,
    alignSelf: 'center' as const,
    width: '100%',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  // Welcome card
  welcomeCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 0,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  welcomeGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  welcomeMunicipio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  welcomeDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'capitalize',
  },
  // Loading
  loadingWrap: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stats row
  statsRow: {
    gap: 10,
    paddingVertical: 2,
    flexDirection: 'row',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    minWidth: 90,
    ...shadows.sm,
  },
  statCardWeb: {
    flex: 1,
    minWidth: 0,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    ...shadows.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '600',
    marginBottom: 12,
  },
  // Health bar
  healthBarTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  healthBarSeg: {
    height: '100%',
  },
  healthLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  healthLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthLabelText: {
    fontSize: 12,
    color: '#475569',
  },
  // Quick actions
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAction: {
    width: isWeb ? 'auto' : '47%',
    flex: isWeb ? 1 : undefined,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: ACCENT + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  // POI attention rows
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  attentionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  attentionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  attentionCategory: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  healthBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  healthBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noAttentionWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  noAttentionText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
