/**
 * Painel Municipal — Impacto
 *
 * Indicadores anónimos de utilização da app no território do município
 * (GET /municipal/me/impact) e relatório mensal em PDF.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import { shadows } from '../../src/theme';
import {
  getMyImpact,
  downloadMonthlyReport,
  getApiErrorStatus,
  getApiErrorMessage,
  countryLabel,
  formatCount,
  type ImpactResponse,
  type ImpactDailyPoint,
} from '../../src/services/api/municipal';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#2E5E4E';
const BG = '#F8FAFC';
const INTL = '#2563EB';
const UNKNOWN = '#CBD5E1';
const isWeb = Platform.OS === 'web';
const DAY_MS = 24 * 60 * 60 * 1000;

const PRESETS = [7, 30, 90] as const;
type Preset = typeof PRESETS[number];

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  return { from: isoDay(from), to: isoDay(to) };
}

function lastMonths(n = 12): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = d.getUTCMonth();
    out.push({
      value: `${d.getUTCFullYear()}-${String(month + 1).padStart(2, '0')}`,
      label: `${MONTHS_PT[month].slice(0, 3)} ${d.getUTCFullYear()}`,
    });
  }
  return out;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function dayTotal(point: ImpactDailyPoint): number {
  return Object.entries(point).reduce(
    (acc, [key, value]) => (key !== 'date' && typeof value === 'number' ? acc + value : acc),
    0,
  );
}

function buildDailySeries(impact: ImpactResponse): { date: string; total: number }[] {
  const byDate = new Map(impact.daily.map((p) => [p.date, dayTotal(p)]));
  const out: { date: string; total: number }[] = [];
  let cur = Date.parse(`${impact.from}T00:00:00Z`);
  const end = Date.parse(`${impact.to}T00:00:00Z`);
  if (Number.isNaN(cur) || Number.isNaN(end)) return out;
  while (cur <= end && out.length < 400) {
    const key = new Date(cur).toISOString().slice(0, 10);
    out.push({ date: key, total: byDate.get(key) ?? 0 });
    cur += DAY_MS;
  }
  return out;
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <MaterialIcons name={icon as any} size={18} color={ACCENT} />
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <View style={[s.kpi, isWeb && s.kpiWeb]}>
      <View style={[s.kpiIcon, { backgroundColor: color + '18' }]}>
        <MaterialIcons name={icon as any} size={18} color={color} />
      </View>
      <Text style={s.kpiValue}>{formatCount(value)}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function DailyChart({ series }: { series: { date: string; total: number }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((p) => p.total));
  const gap = series.length > 45 ? 1 : 2;
  const current = selected != null ? series[selected] : null;

  if (!series.length) return <Text style={s.emptyInline}>Sem dados no período</Text>;

  return (
    <View>
      <View style={s.chartMeta}>
        <Text style={s.chartMetaText}>
          {current
            ? `${shortDate(current.date)}: ${formatCount(current.total)} eventos`
            : 'Toque numa barra para ver o dia'}
        </Text>
        <Text style={s.chartMetaText}>máx. {formatCount(max)}</Text>
      </View>
      <View style={[s.chart, { gap }]} accessibilityLabel="Eventos por dia">
        {series.map((p, i) => {
          const pct = (p.total / max) * 100;
          return (
            <Pressable
              key={p.date}
              style={s.barSlot}
              onPress={() => setSelected(i === selected ? null : i)}
              accessibilityLabel={`${shortDate(p.date)}: ${p.total} eventos`}
            >
              <View
                style={[
                  s.bar,
                  {
                    height: p.total > 0 ? (`${Math.max(pct, 2)}%` as `${number}%`) : 1,
                    backgroundColor: p.total > 0 ? (i === selected ? '#F59E0B' : ACCENT) : '#E2E8F0',
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={s.chartAxis}>
        <Text style={s.axisText}>{shortDate(series[0].date)}</Text>
        <Text style={s.axisText}>{shortDate(series[series.length - 1].date)}</Text>
      </View>
    </View>
  );
}

function PctBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={s.pctTrack}>
      <View style={[s.pctFill, { width: `${Math.min(100, Math.max(0, pct))}%` as `${number}%`, backgroundColor: color }]} />
    </View>
  );
}

function NoPlanCard() {
  const router = useRouter();
  return (
    <View style={s.noPlan}>
      <View style={s.noPlanIcon}>
        <MaterialIcons name="workspace-premium" size={32} color={ACCENT} />
      </View>
      <Text style={s.noPlanTitle}>O painel de impacto faz parte dos planos municipais</Text>
      <Text style={s.noPlanText}>
        Com um plano ativo (ou o piloto de 3 meses) passa a ver quantos visitantes descobrem o seu
        território na app, de onde vêm, que POIs e rotas preferem e recebe um relatório mensal em PDF.
      </Text>
      <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/municipio/plano')}>
        <Text style={s.primaryBtnText}>Ver planos</Text>
        <MaterialIcons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MunicipioImpacto() {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>(30);
  const months = useMemo(() => lastMonths(12), []);
  const [period, setPeriod] = useState<string>(months[1]?.value ?? months[0].value);
  const [reportError, setReportError] = useState<string | null>(null);

  const range = useMemo(() => rangeForDays(preset), [preset]);

  const { data: impact, isLoading, isFetching, error, refetch } = useQuery<ImpactResponse>({
    queryKey: ['municipal-impact', range.from, range.to],
    queryFn: () => getMyImpact(range),
    placeholderData: keepPreviousData,
  });
  const status = getApiErrorStatus(error);

  const report = useMutation({
    mutationFn: (p: string) => downloadMonthlyReport(p),
    onMutate: () => setReportError(null),
    onSuccess: (downloaded) => {
      if (!downloaded) {
        notify(
          'Relatório PDF',
          'O relatório PDF está disponível na versão web do painel municipal (portugal-vivo.app/municipio/impacto).',
        );
      }
    },
    onError: (err) => {
      const code = getApiErrorStatus(err);
      setReportError(
        code === 402
          ? 'O relatório mensal faz parte dos planos municipais.'
          : getApiErrorMessage(err, 'Não foi possível gerar o relatório. Tente novamente.'),
      );
    },
  });

  const series = useMemo(() => (impact ? buildDailySeries(impact) : []), [impact]);
  const nvi = impact?.national_vs_international;
  const knownTotal = nvi ? nvi.national_sessions + nvi.international_sessions + nvi.unknown_sessions : 0;
  const isEmpty = !!impact && impact.totals.unique_visitors === 0 && impact.daily.length === 0;
  const platforms = impact?.platforms ?? {};
  const platformParts = [
    platforms.ios ? `iOS ${formatCount(platforms.ios)}` : null,
    platforms.android ? `Android ${formatCount(platforms.android)}` : null,
    platforms.web ? `Web ${formatCount(platforms.web)}` : null,
  ].filter(Boolean);

  const header = (
    <View style={s.pageHeaderRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.pageTitle}>Impacto</Text>
        <Text style={s.pageSubtitle}>
          {impact ? `${shortDate(impact.from)} – ${shortDate(impact.to)}` : 'Utilização da app no seu território'}
        </Text>
      </View>
      {isFetching && !isLoading && <ActivityIndicator size="small" color={ACCENT} />}
    </View>
  );

  const presets = (
    <View style={s.chipsRow}>
      {PRESETS.map((d) => (
        <TouchableOpacity
          key={d}
          style={[s.chip, preset === d && s.chipActive]}
          onPress={() => setPreset(d)}
          accessibilityRole="button"
          accessibilityState={{ selected: preset === d }}
        >
          <Text style={[s.chipText, preset === d && s.chipTextActive]}>{d} dias</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View style={s.stateWrap}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={s.stateText}>A carregar indicadores…</Text>
      </View>
    );
  } else if (status === 402) {
    body = <NoPlanCard />;
  } else if (error || !impact) {
    body = (
      <View style={s.stateWrap}>
        <MaterialIcons name="error-outline" size={40} color="#EF4444" />
        <Text style={s.errorText}>{getApiErrorMessage(error, 'Erro ao carregar o painel de impacto')}</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => refetch()}>
          <Text style={s.primaryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    const t = impact.totals;
    body = (
      <>
        {presets}

        {isEmpty && (
          <View style={s.infoBanner}>
            <MaterialIcons name="info-outline" size={18} color="#0369A1" />
            <Text style={s.infoBannerText}>
              Ainda não há eventos registados neste período. Os dados aparecem à medida que os visitantes
              usam a app no seu território.
            </Text>
          </View>
        )}

        {/* KPIs */}
        <View style={s.kpiGrid}>
          <KpiCard label="Visitantes únicos" value={t.unique_visitors} icon="people" color="#3B82F6" />
          <KpiCard label="Visualizações de POIs" value={t.poi_views} icon="visibility" color={ACCENT} />
          <KpiCard label="Áudio-guias ouvidos" value={t.audio_plays} icon="headphones" color="#8B5CF6" />
          <KpiCard label="Rotas iniciadas" value={t.route_starts} icon="directions-walk" color="#F59E0B" />
          <KpiCard label="Leituras QR" value={t.qr_scans} icon="qr-code-scanner" color="#0EA5E9" />
          <KpiCard label="Partilhas" value={t.shares} icon="share" color="#EC4899" />
        </View>

        {/* Daily */}
        <Card title="Eventos por dia" icon="bar-chart">
          <DailyChart series={series} />
        </Card>

        <View style={isWeb ? s.twoCol : undefined}>
          {/* Top POIs */}
          <View style={isWeb ? s.col : undefined}>
            <Card title="POIs mais visitados" icon="place">
              {impact.top_pois.length === 0 ? (
                <Text style={s.emptyInline}>Sem dados no período</Text>
              ) : (
                impact.top_pois.map((p, i) => (
                  <TouchableOpacity
                    key={p.poi_id}
                    style={s.rankRow}
                    onPress={() => router.push(`/heritage/${p.poi_id}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.rank}>{i + 1}</Text>
                    <Text style={s.rankName} numberOfLines={1}>{p.name}</Text>
                    <View style={s.rankStat}>
                      <MaterialIcons name="visibility" size={13} color="#64748B" />
                      <Text style={s.rankStatText}>{formatCount(p.views)}</Text>
                    </View>
                    <View style={s.rankStat}>
                      <MaterialIcons name="headphones" size={13} color="#64748B" />
                      <Text style={s.rankStatText}>{formatCount(p.audio_plays)}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </Card>
          </View>

          {/* Origin */}
          <View style={isWeb ? s.col : undefined}>
            <Card title="Origem dos visitantes" icon="public">
              {nvi && knownTotal > 0 ? (
                <View style={s.splitWrap}>
                  <View style={s.splitBar}>
                    {nvi.national_sessions > 0 && (
                      <View style={{ flex: nvi.national_sessions, backgroundColor: ACCENT }} />
                    )}
                    {nvi.international_sessions > 0 && (
                      <View style={{ flex: nvi.international_sessions, backgroundColor: INTL }} />
                    )}
                    {nvi.unknown_sessions > 0 && (
                      <View style={{ flex: nvi.unknown_sessions, backgroundColor: UNKNOWN }} />
                    )}
                  </View>
                  <View style={s.legendRow}>
                    <View style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: ACCENT }]} />
                      <Text style={s.legendText}>Nacionais {formatCount(nvi.national_sessions)}</Text>
                    </View>
                    <View style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: INTL }]} />
                      <Text style={s.legendText}>Internacionais {formatCount(nvi.international_sessions)}</Text>
                    </View>
                    <View style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: UNKNOWN }]} />
                      <Text style={s.legendText}>Desconhecida {formatCount(nvi.unknown_sessions)}</Text>
                    </View>
                  </View>
                  <Text style={s.splitNote}>
                    {nvi.international_pct}% de visitantes internacionais (entre os de origem conhecida)
                  </Text>
                </View>
              ) : null}
              {impact.origin.length === 0 ? (
                <Text style={s.emptyInline}>Sem dados no período</Text>
              ) : (
                impact.origin.slice(0, 8).map((o) => (
                  <View key={o.country} style={s.originRow}>
                    <Text style={s.originName} numberOfLines={1}>{countryLabel(o.country)}</Text>
                    <PctBar pct={o.pct} color={o.country === 'PT' ? ACCENT : o.country === 'ZZ' ? UNKNOWN : INTL} />
                    <Text style={s.originPct}>{o.pct}%</Text>
                  </View>
                ))
              )}
            </Card>
          </View>
        </View>

        {/* Top routes */}
        <Card title="Rotas mais usadas" icon="route">
          {impact.top_routes.length === 0 ? (
            <Text style={s.emptyInline}>Sem dados no período</Text>
          ) : (
            impact.top_routes.map((r, i) => (
              <TouchableOpacity
                key={r.route_id}
                style={s.rankRow}
                onPress={() => router.push(`/route/${r.route_id}`)}
                activeOpacity={0.7}
              >
                <Text style={s.rank}>{i + 1}</Text>
                <Text style={s.rankName} numberOfLines={1}>{r.name}</Text>
                <View style={s.rankStat}>
                  <MaterialIcons name="directions-walk" size={13} color="#64748B" />
                  <Text style={s.rankStatText}>{formatCount(r.starts)}</Text>
                </View>
                <View style={s.rankStat}>
                  <MaterialIcons name="visibility" size={13} color="#64748B" />
                  <Text style={s.rankStatText}>{formatCount(r.views)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Card>

        {platformParts.length > 0 && (
          <Text style={s.platformText}>Plataformas: {platformParts.join(' · ')}</Text>
        )}
        {!!impact.methodology && <Text style={s.methodology}>{impact.methodology}</Text>}
      </>
    );
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, isWeb && s.contentWeb]}
        showsVerticalScrollIndicator={false}
      >
        {header}
        {body}

        {/* Monthly report — hidden only when the plan is missing */}
        {status !== 402 && (
          <Card title="Relatório mensal" icon="picture-as-pdf">
            <Text style={s.reportHint}>
              Relatório de impacto em PDF, pronto a anexar a relatórios de atividade e candidaturas.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.monthRow}>
              {months.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[s.chip, period === m.value && s.chipActive]}
                  onPress={() => setPeriod(m.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === m.value }}
                >
                  <Text style={[s.chipText, period === m.value && s.chipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[s.primaryBtn, s.reportBtn, report.isPending && { opacity: 0.6 }]}
              onPress={() => report.mutate(period)}
              disabled={report.isPending}
              accessibilityRole="button"
            >
              {report.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="file-download" size={18} color="#fff" />
              )}
              <Text style={s.primaryBtnText}>Descarregar relatório PDF</Text>
            </TouchableOpacity>
            {!!reportError && <Text style={s.reportError}>{reportError}</Text>}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 32 },
  contentWeb: { maxWidth: 1100, alignSelf: 'center', width: '100%', paddingTop: 24, paddingHorizontal: 24 },
  pageHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#FFFFFF' },
  infoBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#E0F2FE', borderRadius: 10, padding: 12, marginBottom: 14,
  },
  infoBannerText: { flex: 1, fontSize: 13, color: '#075985', lineHeight: 19 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpi: {
    width: '48%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9', ...shadows.sm,
  },
  kpiWeb: { width: undefined, minWidth: 150, flexBasis: 150 },
  kpiIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  kpiLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#F1F5F9', ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  chartMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartMetaText: { fontSize: 11, color: '#64748B' },
  chart: {
    height: 140, flexDirection: 'row', alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { fontSize: 10, color: '#94A3B8' },
  twoCol: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  col: { flex: 1 },
  rankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  rank: { width: 20, fontSize: 12, fontWeight: '800', color: '#94A3B8', textAlign: 'center' },
  rankName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E293B' },
  rankStat: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 48, justifyContent: 'flex-end' },
  rankStatText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  splitWrap: { marginBottom: 14 },
  splitBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#475569' },
  splitNote: { fontSize: 12, color: '#1E293B', fontWeight: '600', marginTop: 8 },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  originName: { width: 110, fontSize: 13, color: '#1E293B' },
  originPct: { width: 48, fontSize: 12, color: '#475569', textAlign: 'right', fontWeight: '600' },
  pctTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  pctFill: { height: '100%', borderRadius: 4 },
  emptyInline: { fontSize: 13, color: '#94A3B8', paddingVertical: 8 },
  platformText: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  methodology: { fontSize: 11, color: '#94A3B8', lineHeight: 16, marginBottom: 14 },
  reportHint: { fontSize: 13, color: '#64748B', marginBottom: 10 },
  monthRow: { gap: 6, paddingBottom: 4 },
  reportBtn: { alignSelf: 'flex-start', marginTop: 12 },
  reportError: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  stateText: { fontSize: 14, color: '#64748B' },
  errorText: { fontSize: 14, color: '#EF4444', fontWeight: '600', textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  noPlan: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#D1FAE5', ...shadows.sm,
  },
  noPlanIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center',
  },
  noPlanTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  noPlanText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21, maxWidth: 520 },
});
