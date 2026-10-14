/**
 * Painel Municipal — Plano
 *
 * Plano e estado da subscrição, consumo das quotas, áudio-guias em destaque
 * e catálogo de planos municipais (GET /municipal/plans).
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shadows } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import {
  getMySubscription,
  getMunicipalPlans,
  getFeaturedAudioGuides,
  unfeatureAudioGuide,
  getApiErrorMessage,
  formatCount,
  SUBSCRIPTION_STATUS_LABELS,
  type MunicipalPlan,
  type MunicipalSubscriptionStatus,
  type MySubscriptionResponse,
  type FeaturedAudioGuide,
} from '../../src/services/api/municipal';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#2E5E4E';
const BG = '#F8FAFC';
const CONTACT_EMAIL = 'municipios@portugalvivo.pt';
const isWeb = Platform.OS === 'web';

const STATUS_COLORS: Record<MunicipalSubscriptionStatus, { bg: string; fg: string }> = {
  pilot: { bg: '#E0F2FE', fg: '#0369A1' },
  active: { bg: '#DCFCE7', fg: '#15803D' },
  suspended: { bg: '#FEF3C7', fg: '#B45309' },
  expired: { bg: '#FEE2E2', fg: '#B91C1C' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatEuros(value: number): string {
  return `${formatCount(value)} €`;
}

function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

function openContact(municipalityId?: string) {
  const subject = encodeURIComponent(
    `Portugal Vivo — plano municipal${municipalityId ? ` (${municipalityId})` : ''}`,
  );
  Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${subject}`).catch(() => {
    Alert.alert('Contacto', `Escreva-nos para ${CONTACT_EMAIL}`);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, icon, children, right }: {
  title: string; icon: string; children: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <MaterialIcons name={icon as any} size={18} color={ACCENT} />
        <Text style={s.cardTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {children}
    </View>
  );
}

function QuotaRow({ label, used, max }: { label: string; used: number; max: number | null }) {
  const unlimited = max == null;
  const pct = unlimited || max === 0 ? 0 : Math.min(100, (used / max) * 100);
  const color = pct >= 100 ? '#DC2626' : pct >= 85 ? '#F59E0B' : ACCENT;
  return (
    <View style={s.quotaRow}>
      <View style={s.quotaTop}>
        <Text style={s.quotaLabel}>{label}</Text>
        <Text style={s.quotaValue}>
          {formatCount(used)} / {unlimited ? 'ilimitado' : formatCount(max)}
        </Text>
      </View>
      <View style={s.quotaTrack}>
        <View
          style={[
            s.quotaFill,
            { width: (unlimited ? '100%' : `${pct}%`) as `${number}%`, backgroundColor: unlimited ? '#A7F3D0' : color },
          ]}
        />
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: MunicipalSubscriptionStatus }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.expired;
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.fg }]}>{SUBSCRIPTION_STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

function PlanCard({ plan, current, vatIncluded }: { plan: MunicipalPlan; current: boolean; vatIncluded: boolean }) {
  return (
    <View style={[s.planCard, isWeb && s.planCardWeb, current && s.planCardCurrent]}>
      {current && (
        <View style={s.currentBadge}>
          <Text style={s.currentBadgeText}>Plano atual</Text>
        </View>
      )}
      <Text style={s.planName}>{plan.name}</Text>
      <Text style={s.planAudience}>{plan.audience}</Text>
      <View style={s.priceRow}>
        <Text style={s.price}>{formatEuros(plan.price_eur_year)}</Text>
        <Text style={s.priceUnit}>/ano{vatIncluded ? '' : ' + IVA'}</Text>
      </View>
      <View style={s.featureList}>
        <View style={s.featureRow}>
          <MaterialIcons name="check" size={15} color={ACCENT} />
          <Text style={s.featureText}>
            {plan.max_pois == null ? 'POIs curados ilimitados' : `Até ${formatCount(plan.max_pois)} POIs curados`}
          </Text>
        </View>
        <View style={s.featureRow}>
          <MaterialIcons name="check" size={15} color={ACCENT} />
          <Text style={s.featureText}>{plan.max_audio_guides} áudio-guias em destaque</Text>
        </View>
        <View style={s.featureRow}>
          <MaterialIcons name="check" size={15} color={ACCENT} />
          <Text style={s.featureText}>Painel de impacto e relatório mensal em PDF</Text>
        </View>
        <View style={s.featureRow}>
          <MaterialIcons name="check" size={15} color={ACCENT} />
          <Text style={s.featureText}>Página pública do município</Text>
        </View>
        {plan.white_label && (
          <View style={s.featureRow}>
            <MaterialIcons name="check" size={15} color={ACCENT} />
            <Text style={s.featureText}>Marca própria (sem marca Portugal Vivo)</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function AudioGuideRow({ item, onRemove, removing }: {
  item: FeaturedAudioGuide; onRemove: () => void; removing: boolean;
}) {
  return (
    <View style={s.audioRow}>
      <View style={s.audioIcon}>
        <MaterialIcons name="headphones" size={16} color="#8B5CF6" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.audioName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.audioMeta} numberOfLines={1}>
          {[item.category, item.audio_featured_at ? `desde ${formatDate(item.audio_featured_at)}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <TouchableOpacity
        style={s.removeBtn}
        onPress={onRemove}
        disabled={removing}
        accessibilityRole="button"
        accessibilityLabel={`Remover destaque de ${item.name}`}
      >
        {removing ? (
          <ActivityIndicator size="small" color="#DC2626" />
        ) : (
          <MaterialIcons name="remove-circle-outline" size={18} color="#DC2626" />
        )}
        <Text style={s.removeBtnText}>Remover</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MunicipioPlano() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.user_id ?? null;

  const subQuery = useQuery<MySubscriptionResponse>({
    queryKey: ['municipal-subscription', userId],
    queryFn: getMySubscription,
    retry: false,
  });
  const plansQuery = useQuery({
    queryKey: ['municipal-plans'],
    queryFn: getMunicipalPlans,
    staleTime: 1000 * 60 * 60,
  });
  const audioQuery = useQuery({
    queryKey: ['municipal-audio-guides', userId],
    queryFn: getFeaturedAudioGuides,
    retry: false,
  });

  const unfeature = useMutation({
    mutationFn: (poiId: string) => unfeatureAudioGuide(poiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipal-audio-guides'] });
      queryClient.invalidateQueries({ queryKey: ['municipal-subscription'] });
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err, 'Não foi possível remover o destaque.');
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.alert(msg);
      } else {
        Alert.alert('Áudio-guias', msg);
      }
    },
  });

  const sub = subQuery.data;
  const subscription = sub?.subscription ?? null;
  const usage = sub?.usage;
  const catalogue = plansQuery.data;
  const audioItems = audioQuery.data?.items ?? [];

  const handleRemove = (item: FeaturedAudioGuide) => {
    confirmAction(
      'Remover destaque',
      `Remover o destaque do áudio-guia de "${item.name}"? Liberta um lugar na quota do plano.`,
      'Remover',
      () => unfeature.mutate(item.id),
    );
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, isWeb && s.contentWeb]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.pageTitle}>Plano</Text>
        <Text style={s.pageSubtitle}>Subscrição municipal, quotas e áudio-guias em destaque</Text>

        {/* Current plan */}
        {subQuery.isLoading ? (
          <View style={s.stateWrap}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : subQuery.error || !sub ? (
          <View style={s.card}>
            <Text style={s.errorText}>{getApiErrorMessage(subQuery.error, 'Erro ao carregar o plano.')}</Text>
            <TouchableOpacity style={[s.primaryBtn, { alignSelf: 'flex-start' }]} onPress={() => subQuery.refetch()}>
              <Text style={s.primaryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Card
              title="O seu plano"
              icon="workspace-premium"
              right={subscription ? <StatusBadge status={subscription.status} /> : null}
            >
              {sub.plan && subscription ? (
                <>
                  <Text style={s.currentPlanName}>{sub.plan.name}</Text>
                  <Text style={s.currentPlanAudience}>{sub.plan.audience}</Text>
                  <View style={s.metaGrid}>
                    <View style={s.metaItem}>
                      <Text style={s.metaLabel}>Início</Text>
                      <Text style={s.metaValue}>{formatDate(subscription.starts_at)}</Text>
                    </View>
                    <View style={s.metaItem}>
                      <Text style={s.metaLabel}>Fim</Text>
                      <Text style={s.metaValue}>{formatDate(subscription.ends_at)}</Text>
                    </View>
                    {!!subscription.contract_ref && (
                      <View style={s.metaItem}>
                        <Text style={s.metaLabel}>Contrato</Text>
                        <Text style={s.metaValue}>{subscription.contract_ref}</Text>
                      </View>
                    )}
                  </View>
                  {subscription.concelhos?.length > 0 && (
                    <Text style={s.concelhos}>Concelhos abrangidos: {subscription.concelhos.join(', ')}</Text>
                  )}
                  {!sub.active && (
                    <View style={s.warnBanner}>
                      <MaterialIcons name="info-outline" size={16} color="#B45309" />
                      <Text style={s.warnBannerText}>
                        A subscrição não está ativa: o painel de impacto, o relatório mensal e a edição da
                        página pública ficam indisponíveis até à renovação.
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={s.currentPlanName}>Sem plano ativo</Text>
                  <Text style={s.currentPlanAudience}>
                    Ative o piloto para aceder ao painel de impacto, ao relatório mensal, aos áudio-guias em
                    destaque e à página pública do município.
                  </Text>
                </>
              )}
            </Card>

            {/* Quotas */}
            {usage && (
              <Card title="Consumo das quotas" icon="data-usage">
                <QuotaRow label="POIs curados" used={usage.curated_pois} max={usage.max_pois} />
                <QuotaRow
                  label="Áudio-guias em destaque"
                  used={usage.featured_audio_guides}
                  max={usage.max_audio_guides}
                />
                <Text style={s.quotaNote}>
                  {formatCount(usage.territory_pois_total)} POIs no território do município no Portugal Vivo.
                </Text>
              </Card>
            )}

            {/* Contact CTA when no active plan */}
            {!sub.active && (
              <View style={s.ctaCard}>
                <MaterialIcons name="mail-outline" size={26} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={s.ctaTitle}>Quer ativar o piloto de {catalogue?.pilot_months ?? 3} meses?</Text>
                  <Text style={s.ctaText}>Fale com a equipa Portugal Vivo: {CONTACT_EMAIL}</Text>
                </View>
                <TouchableOpacity style={s.ctaBtn} onPress={() => openContact(sub.municipality_id)}>
                  <Text style={s.ctaBtnText}>Contactar</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Featured audio guides */}
        <Card
          title="Áudio-guias em destaque"
          icon="headphones"
          right={
            audioQuery.data ? (
              <Text style={s.cardRight}>
                {audioQuery.data.used}{audioQuery.data.max != null ? ` / ${audioQuery.data.max}` : ''}
              </Text>
            ) : null
          }
        >
          {audioQuery.isLoading ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : audioQuery.error ? (
            <Text style={s.errorText}>
              {getApiErrorMessage(audioQuery.error, 'Erro ao carregar os áudio-guias em destaque.')}
            </Text>
          ) : audioItems.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>
                Ainda não há áudio-guias em destaque. Destaque-os a partir da lista de POIs.
              </Text>
              <TouchableOpacity onPress={() => router.push('/municipio/pois')}>
                <Text style={s.link}>Ir para POIs</Text>
              </TouchableOpacity>
            </View>
          ) : (
            audioItems.map((item) => (
              <AudioGuideRow
                key={item.id}
                item={item}
                onRemove={() => handleRemove(item)}
                removing={unfeature.isPending && unfeature.variables === item.id}
              />
            ))
          )}
        </Card>

        {/* Catalogue */}
        <Text style={s.sectionTitle}>Planos municipais</Text>
        {plansQuery.isLoading ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : plansQuery.error || !catalogue ? (
          <Text style={s.errorText}>Não foi possível carregar o catálogo de planos.</Text>
        ) : (
          <>
            <View style={s.planGrid}>
              {catalogue.plans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  current={!!subscription && subscription.plan === p.id}
                  vatIncluded={catalogue.vat_included}
                />
              ))}
            </View>
            <View style={s.catalogueNotes}>
              <View style={s.featureRow}>
                <MaterialIcons name="schedule" size={15} color="#475569" />
                <Text style={s.noteText}>Piloto de {catalogue.pilot_months} meses</Text>
              </View>
              <View style={s.featureRow}>
                <MaterialIcons name="build" size={15} color="#475569" />
                <Text style={s.noteText}>
                  Implementação (pagamento único): {formatEuros(catalogue.setup_fee_eur)}
                  {catalogue.vat_included ? '' : ' + IVA'}
                </Text>
              </View>
              <View style={s.featureRow}>
                <MaterialIcons name="receipt" size={15} color="#475569" />
                <Text style={s.noteText}>
                  {catalogue.vat_included ? 'Valores com IVA incluído.' : 'Valores anuais sem IVA.'}
                </Text>
              </View>
              {!!catalogue.notes && <Text style={s.notesSmall}>{catalogue.notes}</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 32 },
  contentWeb: { maxWidth: 1000, alignSelf: 'center', width: '100%', paddingTop: 24, paddingHorizontal: 24 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2, marginBottom: 16 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#F1F5F9', ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  cardRight: { fontSize: 13, fontWeight: '700', color: '#475569' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  currentPlanName: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  currentPlanAudience: { fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 19 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 14 },
  metaItem: { minWidth: 90 },
  metaLabel: { fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginTop: 2 },
  concelhos: { fontSize: 12, color: '#64748B', marginTop: 12 },
  warnBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12,
    backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10,
  },
  warnBannerText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  quotaRow: { marginBottom: 14 },
  quotaTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  quotaLabel: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  quotaValue: { fontSize: 13, fontWeight: '700', color: '#475569' },
  quotaTrack: { height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  quotaFill: { height: '100%', borderRadius: 4 },
  quotaNote: { fontSize: 12, color: '#94A3B8' },
  ctaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    backgroundColor: ACCENT, borderRadius: 12, padding: 16, marginBottom: 14,
  },
  ctaTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  ctaText: { fontSize: 12, color: '#D1FAE5', marginTop: 2 },
  ctaBtn: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  ctaBtnText: { fontSize: 13, fontWeight: '800', color: ACCENT },
  audioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  audioIcon: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3E8FF',
    alignItems: 'center', justifyContent: 'center',
  },
  audioName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  audioMeta: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  removeBtnText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  emptyBox: { gap: 6 },
  emptyText: { fontSize: 13, color: '#64748B' },
  link: { fontSize: 13, fontWeight: '700', color: ACCENT },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginTop: 6, marginBottom: 12 },
  planGrid: { flexDirection: isWeb ? 'row' : 'column', gap: 12, flexWrap: 'wrap' },
  planCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: '#E2E8F0', ...shadows.sm,
  },
  planCardWeb: { flex: 1, minWidth: 240 },
  planCardCurrent: { borderColor: ACCENT, borderWidth: 2 },
  currentBadge: {
    alignSelf: 'flex-start', backgroundColor: ACCENT, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8,
  },
  currentBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  planName: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  planAudience: { fontSize: 12, color: '#64748B', marginTop: 2, minHeight: 32 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10, marginBottom: 12 },
  price: { fontSize: 24, fontWeight: '900', color: ACCENT },
  priceUnit: { fontSize: 13, color: '#64748B', marginLeft: 4, marginBottom: 3 },
  featureList: { gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 13, color: '#334155', flex: 1 },
  catalogueNotes: { marginTop: 14, gap: 6 },
  noteText: { fontSize: 13, color: '#475569', flex: 1 },
  notesSmall: { fontSize: 11, color: '#94A3B8', marginTop: 4, lineHeight: 16 },
  stateWrap: { alignItems: 'center', paddingVertical: 40 },
  errorText: { fontSize: 13, color: '#DC2626', marginBottom: 10 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
