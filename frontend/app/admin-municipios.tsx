/**
 * Admin — Contratos municipais (B2G)
 * Lista de subscrições municipais (plano, estado, fim, concelhos), KPIs de
 * receita e formulário para criar/atualizar um contrato.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, type ThemeColors } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { palette } from '../src/theme/colors';
import { shadows, fontFamilies } from '../src/theme';
import {
  getMunicipalPlans, listMunicipalSubscriptions, upsertMunicipalSubscription, partnerApiErrorMessage,
  type MunicipalPlanId, type MunicipalSubscription, type MunicipalSubscriptionStatus,
  type MunicipalSubscriptionUpsert,
} from '../src/services/api/partnerApi';

const serif = fontFamilies.serif;

const FALLBACK_PLANS: { id: MunicipalPlanId; name: string }[] = [
  { id: 'essencial', name: 'Essencial' },
  { id: 'territorio', name: 'Território' },
  { id: 'destino', name: 'Destino' },
];

const STATUS_META: Record<MunicipalSubscriptionStatus, { label: string; color: string }> = {
  pilot: { label: 'Piloto', color: '#3B82F6' },
  active: { label: 'Ativo', color: '#22C55E' },
  suspended: { label: 'Suspenso', color: '#F59E0B' },
  expired: { label: 'Expirado', color: '#6B7280' },
};
const STATUS_OPTIONS = (Object.keys(STATUS_META) as MunicipalSubscriptionStatus[])
  .map((id) => ({ id, name: STATUS_META[id].label }));

const MAX_CONCELHOS = 20;
const MAX_ALIASES = 10;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface SubForm {
  municipality_id: string;
  plan: MunicipalPlanId;
  status: MunicipalSubscriptionStatus;
  starts_at: string;
  ends_at: string;
  concelhos: string;
  aliases: string;
  contract_ref: string;
  notes: string;
}

const EMPTY_FORM: SubForm = {
  municipality_id: '', plan: 'essencial', status: 'pilot', starts_at: '', ends_at: '',
  concelhos: '', aliases: '', contract_ref: '', notes: '',
};

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const toDateInput = (value?: string | null) => (value ? String(value).slice(0, 10) : '');

const isValidDate = (value: string) => DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

const splitList = (value: string) => value.split(',').map((s) => s.trim()).filter(Boolean);

const formatEur = (v: number) => `${v.toLocaleString('pt-PT')} €`;

function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export default function AdminMunicipiosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && (user.role === 'admin' || !!user.is_admin);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'admin' && !user.is_admin))) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);
  const [form, setForm] = useState<SubForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: plansData } = useQuery({
    queryKey: ['municipal-plans'],
    queryFn: getMunicipalPlans,
    enabled: isAdmin,
    staleTime: 10 * 60_000,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-municipal-subscriptions'],
    queryFn: listMunicipalSubscriptions,
    enabled: isAdmin,
    staleTime: 15_000,
  });

  const plans = useMemo(
    () => (plansData?.plans?.length ? plansData.plans.map((p) => ({ id: p.id, name: p.name })) : FALLBACK_PLANS),
    [plansData],
  );
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;
  const selectedPlan = plansData?.plans?.find((p) => p.id === form.plan);

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MunicipalSubscriptionUpsert }) =>
      upsertMunicipalSubscription(id, payload),
    onSuccess: (saved: MunicipalSubscription) => {
      queryClient.invalidateQueries({ queryKey: ['admin-municipal-subscriptions'] });
      setForm(EMPTY_FORM);
      setEditing(null);
      setFormError(null);
      notify('Contrato guardado', `${saved?.municipality_id ?? 'Município'} · válido até ${formatDate(saved?.ends_at)}`);
    },
    onError: (err: unknown) => setFormError(partnerApiErrorMessage(err, 'Não foi possível guardar o contrato.')),
  });

  const handleEdit = (sub: MunicipalSubscription) => {
    setEditing(sub.municipality_id);
    setForm({
      municipality_id: sub.municipality_id,
      plan: sub.plan,
      status: sub.status,
      starts_at: toDateInput(sub.starts_at),
      ends_at: toDateInput(sub.ends_at),
      concelhos: (sub.concelhos || []).join(', '),
      aliases: (sub.municipality_aliases || []).join(', '),
      contract_ref: sub.contract_ref || '',
      notes: sub.notes || '',
    });
    setFormError(null);
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, formY.current - 12), animated: true }), 50);
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setFormError(null);
  };

  const handleSubmit = () => {
    const id = form.municipality_id.trim();
    const startsAt = form.starts_at.trim();
    const endsAt = form.ends_at.trim();
    const concelhos = splitList(form.concelhos);
    const aliases = splitList(form.aliases);
    if (id.length < 2) { setFormError('Indique o identificador do município (ex.: arcos-de-valdevez).'); return; }
    if (startsAt && !isValidDate(startsAt)) { setFormError('Data de início inválida — use AAAA-MM-DD.'); return; }
    if (endsAt && !isValidDate(endsAt)) { setFormError('Data de fim inválida — use AAAA-MM-DD.'); return; }
    if (startsAt && endsAt && endsAt <= startsAt) { setFormError('A data de fim tem de ser posterior ao início.'); return; }
    if (concelhos.length > MAX_CONCELHOS) { setFormError(`Máximo de ${MAX_CONCELHOS} concelhos.`); return; }
    if (aliases.length > MAX_ALIASES) { setFormError(`Máximo de ${MAX_ALIASES} aliases.`); return; }
    setFormError(null);
    saveMutation.mutate({
      id,
      payload: {
        plan: form.plan,
        status: form.status,
        starts_at: startsAt ? `${startsAt}T00:00:00Z` : undefined,
        ends_at: endsAt ? `${endsAt}T23:59:59Z` : undefined,
        concelhos,
        municipality_aliases: aliases,
        contract_ref: form.contract_ref.trim() || undefined,
        notes: form.notes.trim() || undefined,
      },
    });
  };

  if (authLoading || !isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const saving = saveMutation.isPending;
  const subscriptions = data?.subscriptions ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={[palette.forest[700], palette.ocean[500]]} style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Voltar">
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Contratos municipais</Text>
            <TouchableOpacity onPress={() => refetch()} accessibilityLabel="Atualizar">
              <MaterialIcons name="refresh" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Planos B2G, pilotos e receita anual</Text>
        </LinearGradient>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <Kpi icon="verified" label="Ativos" value={String(data?.active ?? 0)} color="#22C55E" colors={colors} />
          <Kpi icon="euro" label="ARR (preço de tabela)" value={formatEur(data?.arr_eur_list_price ?? 0)} color="#C49A6C" colors={colors} />
          <Kpi icon="account-balance" label="Contratos" value={String(data?.total ?? 0)} color="#3B82F6" colors={colors} />
        </View>

        {/* Subscriptions list */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="account-balance" size={22} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Subscrições</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : error ? (
            <Text style={styles.errorText}>{partnerApiErrorMessage(error, 'Falha ao carregar os contratos.')}</Text>
          ) : subscriptions.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="handshake" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Ainda sem contratos municipais</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {subscriptions.map((sub) => {
                const status = STATUS_META[sub.status] ?? { label: sub.status, color: '#6B7280' };
                const days = daysUntil(sub.ends_at);
                const endingSoon = days != null && days >= 0 && days <= 30 && (sub.status === 'pilot' || sub.status === 'active');
                const ended = days != null && days < 0;
                return (
                  <View
                    key={sub.municipality_id}
                    style={[styles.card, { borderColor: editing === sub.municipality_id ? colors.primary : colors.borderLight }]}
                  >
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {sub.municipality_id}
                      </Text>
                      <View style={[styles.pill, { backgroundColor: '#8B5CF620' }]}>
                        <Text style={[styles.pillText, { color: '#7C3AED' }]}>{planName(sub.plan)}</Text>
                      </View>
                      <View style={[styles.pill, { backgroundColor: status.color + '20' }]}>
                        <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                    <View style={styles.metaRow}>
                      <MaterialIcons
                        name="event"
                        size={14}
                        color={ended ? '#EF4444' : endingSoon ? '#F59E0B' : colors.textMuted}
                      />
                      <Text style={[styles.cardMeta, { color: ended ? '#EF4444' : endingSoon ? '#B45309' : colors.textSecondary }]}>
                        {formatDate(sub.starts_at)} → {formatDate(sub.ends_at)}
                        {endingSoon ? ` · termina em ${days} dia${days === 1 ? '' : 's'}` : ''}
                        {ended ? ' · terminado' : ''}
                      </Text>
                    </View>
                    {sub.concelhos?.length > 0 && (
                      <View style={styles.metaRow}>
                        <MaterialIcons name="place" size={14} color={colors.textMuted} />
                        <Text style={[styles.cardMeta, { color: colors.textSecondary, flex: 1 }]}>
                          {sub.concelhos.join(', ')}
                        </Text>
                      </View>
                    )}
                    {(sub.contract_ref || sub.municipality_aliases?.length > 0) && (
                      <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                        {sub.contract_ref ? `Contrato ${sub.contract_ref}` : ''}
                        {sub.contract_ref && sub.municipality_aliases?.length ? ' · ' : ''}
                        {sub.municipality_aliases?.length ? `Aliases: ${sub.municipality_aliases.join(', ')}` : ''}
                      </Text>
                    )}
                    {sub.notes ? (
                      <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={3}>{sub.notes}</Text>
                    ) : null}
                    <View style={styles.cardBottom}>
                      <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                        Atualizado {formatDate(sub.updated_at)}
                      </Text>
                      <TouchableOpacity
                        style={[styles.outlineBtn, { borderColor: colors.border }]}
                        onPress={() => handleEdit(sub)}
                      >
                        <MaterialIcons name="edit" size={14} color={colors.textSecondary} />
                        <Text style={[styles.outlineBtnText, { color: colors.textSecondary }]}>Editar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Create / update form */}
        <View
          style={[styles.section, { backgroundColor: colors.surface }]}
          onLayout={(e) => { formY.current = e.nativeEvent.layout.y; }}
        >
          <View style={styles.sectionHeader}>
            <MaterialIcons name={editing ? 'edit' : 'add-circle'} size={22} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
              {editing ? `Editar contrato · ${editing}` : 'Novo contrato'}
            </Text>
            {editing && (
              <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={handleReset} accessibilityLabel="Cancelar edição">
                <MaterialIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Field
              label="Município (identificador)"
              hint="Slug do município, ex.: arcos-de-valdevez"
              value={form.municipality_id}
              onChangeText={(v) => setForm({ ...form, municipality_id: v })}
              editable={!editing}
              autoCapitalize="none"
              placeholder="arcos-de-valdevez"
              colors={colors}
            />
            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Plano</Text>
              <ChoiceChips options={plans} value={form.plan} onChange={(id) => setForm({ ...form, plan: id as MunicipalPlanId })} colors={colors} />
              {selectedPlan && (
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  {formatEur(selectedPlan.price_eur_year)}/ano · {selectedPlan.max_pois == null ? 'POIs ilimitados' : `até ${selectedPlan.max_pois} POIs`}
                  {' '}· {selectedPlan.max_audio_guides} áudio-guias{selectedPlan.white_label ? ' · white-label' : ''} · {selectedPlan.audience}
                </Text>
              )}
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Estado</Text>
              <ChoiceChips options={STATUS_OPTIONS} value={form.status} onChange={(id) => setForm({ ...form, status: id as MunicipalSubscriptionStatus })} colors={colors} />
            </View>
            <View style={styles.twoCols}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Início (opcional)"
                  value={form.starts_at}
                  onChangeText={(v) => setForm({ ...form, starts_at: v })}
                  placeholder="AAAA-MM-DD"
                  autoCapitalize="none"
                  colors={colors}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Fim (opcional)"
                  value={form.ends_at}
                  onChangeText={(v) => setForm({ ...form, ends_at: v })}
                  placeholder="AAAA-MM-DD"
                  autoCapitalize="none"
                  colors={colors}
                />
              </View>
            </View>
            <Text style={[styles.hint, { color: colors.textMuted, marginTop: -6 }]}>
              Sem início, conta a partir de hoje. Sem fim: piloto = {plansData?.pilot_months ?? 3} meses, restantes = 1 ano.
            </Text>
            <Field
              label="Concelhos (separados por vírgulas)"
              value={form.concelhos}
              onChangeText={(v) => setForm({ ...form, concelhos: v })}
              placeholder="Arcos de Valdevez, Ponte da Barca"
              colors={colors}
            />
            <Field
              label="Aliases do município (separados por vírgulas)"
              value={form.aliases}
              onChangeText={(v) => setForm({ ...form, aliases: v })}
              placeholder="arcos_de_valdevez, cm-arcos"
              autoCapitalize="none"
              colors={colors}
            />
            <Field
              label="Referência do contrato (opcional)"
              value={form.contract_ref}
              onChangeText={(v) => setForm({ ...form, contract_ref: v })}
              placeholder="CT-2026-014"
              colors={colors}
            />
            <Field
              label="Notas (opcional)"
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              placeholder="Contactos, condições do piloto…"
              multiline
              colors={colors}
            />
            {formError && <Text style={styles.errorText}>{formError}</Text>}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#FFF" />
                : <MaterialIcons name="save" size={18} color="#FFF" />}
              <Text style={styles.primaryBtnText}>{editing ? 'Atualizar contrato' : 'Criar contrato'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Kpi({ icon, label, value, color, colors }: {
  icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; value: string; color: string; colors: ThemeColors;
}) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.surface }]}>
      <MaterialIcons name={icon} size={20} color={color} />
      <Text style={[styles.kpiValue, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.textMuted }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function ChoiceChips({ options, value, onChange, colors }: {
  options: { id: string; name: string }[]; value: string; onChange: (id: string) => void; colors: ThemeColors;
}) {
  return (
    <View style={styles.chipsRow}>
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, {
              backgroundColor: selected ? colors.primary : 'transparent',
              borderColor: selected ? colors.primary : colors.border,
            }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipText, { color: selected ? '#FFF' : colors.textSecondary }]}>{opt.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Field({ label, hint, colors, ...input }: {
  label: string; hint?: string; colors: ThemeColors;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          input.multiline ? { minHeight: 72, textAlignVertical: 'top' } : null,
          {
            borderColor: colors.border,
            color: colors.textPrimary,
            backgroundColor: input.editable === false ? colors.borderLight : colors.background,
          },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', fontFamily: serif },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -20 },
  kpi: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, gap: 4, ...shadows.sm },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  section: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 14, ...shadows.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, fontFamily: serif, flexShrink: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  twoCols: { flexDirection: 'row', gap: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  errorText: { color: '#DC2626', fontSize: 13 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10,
  },
  primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardMeta: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pillText: { fontSize: 11, fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  outlineBtnText: { fontSize: 12, fontWeight: '600' },
});
