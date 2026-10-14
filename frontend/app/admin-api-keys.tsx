/**
 * Admin — API para parceiros (B2B)
 * Gestão de API keys (plano, estado, consumo mensal), emissão de novas chaves
 * e fila de pedidos de acesso vindos de /api-docs.
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
  getApiPlans, listApiKeys, createApiKey, updateApiKey, revokeApiKey,
  listAccessRequests, partnerApiErrorMessage,
  type ApiKey, type ApiKeyCreated, type ApiKeyStatus, type ApiPlanId, type AccessRequest,
} from '../src/services/api/partnerApi';

const serif = fontFamilies.serif;
const MONO = Platform.OS === 'web' ? 'monospace' : Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const FALLBACK_PLANS: { id: ApiPlanId; name: string }[] = [
  { id: 'explorador', name: 'Explorador' },
  { id: 'parceiro', name: 'Parceiro' },
  { id: 'pro', name: 'Pro' },
  { id: 'enterprise', name: 'Enterprise' },
];

const STATUS_META: Record<ApiKeyStatus, { label: string; color: string }> = {
  active: { label: 'Ativa', color: '#22C55E' },
  suspended: { label: 'Suspensa', color: '#F59E0B' },
  revoked: { label: 'Revogada', color: '#EF4444' },
};

type StatusFilter = 'all' | ApiKeyStatus;
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Ativas' },
  { id: 'suspended', label: 'Suspensas' },
  { id: 'revoked', label: 'Revogadas' },
];

interface KeyForm {
  name: string;
  org_name: string;
  contact_email: string;
  plan: ApiPlanId;
  request_id?: string;
}

const EMPTY_FORM: KeyForm = { name: '', org_name: '', contact_email: '', plan: 'explorador' };

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

function formatDate(value?: string | null, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-PT', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

const formatEur = (v: number) => `${v.toLocaleString('pt-PT')} €`;
const formatInt = (v: number) => v.toLocaleString('pt-PT');

export default function AdminApiKeysScreen() {
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<KeyForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingPlanFor, setEditingPlanFor] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data: plansData } = useQuery({
    queryKey: ['partner-api-plans'],
    queryFn: getApiPlans,
    enabled: isAdmin,
    staleTime: 10 * 60_000,
  });

  const { data: keysData, isLoading: keysLoading, error: keysError, refetch: refetchKeys } = useQuery({
    queryKey: ['admin-api-keys'],
    queryFn: () => listApiKeys(),
    enabled: isAdmin,
    staleTime: 15_000,
  });

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['admin-api-access-requests'],
    queryFn: () => listAccessRequests('pending'),
    enabled: isAdmin,
    staleTime: 15_000,
  });

  const plans = useMemo(
    () => (plansData?.plans?.length ? plansData.plans.map((p) => ({ id: p.id, name: p.name })) : FALLBACK_PLANS),
    [plansData],
  );
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
    queryClient.invalidateQueries({ queryKey: ['admin-api-access-requests'] });
  };

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (result: ApiKeyCreated) => {
      setCreated(result);
      setCopied(false);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setFormError(null);
      invalidate();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    onError: (err: unknown) => setFormError(partnerApiErrorMessage(err, 'Não foi possível emitir a chave.')),
  });

  const keys = useMemo(() => keysData?.keys ?? [], [keysData]);
  const visibleKeys = statusFilter === 'all' ? keys : keys.filter((k) => k.status === statusFilter);
  const activeCount = keys.filter((k) => k.status === 'active').length;
  const pendingRequests = requestsData?.requests ?? [];

  const runKeyAction = async (keyId: string, action: () => Promise<unknown>, failMsg: string) => {
    setBusyKey(keyId);
    try {
      await action();
      invalidate();
    } catch (err) {
      notify('Erro', partnerApiErrorMessage(err, failMsg));
    } finally {
      setBusyKey(null);
    }
  };

  const handleChangePlan = (key: ApiKey, plan: ApiPlanId) => {
    setEditingPlanFor(null);
    if (plan === key.plan) return;
    runKeyAction(key.key_id, () => updateApiKey(key.key_id, { plan }), 'Não foi possível mudar o plano.');
  };

  const handleToggleStatus = (key: ApiKey) => {
    const next = key.status === 'active' ? 'suspended' : 'active';
    runKeyAction(key.key_id, () => updateApiKey(key.key_id, { status: next }), 'Não foi possível alterar o estado.');
  };

  const handleRevoke = async (key: ApiKey) => {
    const ok = await confirmAction(
      'Revogar chave',
      `A chave ${key.key_prefix}… de ${key.org_name} deixa de funcionar imediatamente. Esta ação é irreversível.`,
      'Revogar',
    );
    if (!ok) return;
    runKeyAction(key.key_id, () => revokeApiKey(key.key_id), 'Não foi possível revogar a chave.');
  };

  const handleIssueFromRequest = (req: AccessRequest) => {
    setForm({
      name: `${req.org_name} — produção`.slice(0, 120),
      org_name: req.org_name,
      contact_email: req.contact_email || '',
      plan: req.desired_plan || 'explorador',
      request_id: req.request_id,
    });
    setFormError(null);
    setShowForm(true);
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, formY.current - 12), animated: true }), 50);
  };

  const handleSubmit = () => {
    const name = form.name.trim();
    const org = form.org_name.trim();
    const email = form.contact_email.trim();
    if (name.length < 2) { setFormError('Indique um nome interno para a chave (mín. 2 caracteres).'); return; }
    if (org.length < 2) { setFormError('Indique a organização (mín. 2 caracteres).'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError('Email de contacto inválido.'); return; }
    setFormError(null);
    createMutation.mutate({
      name, org_name: org, contact_email: email || undefined, plan: form.plan, request_id: form.request_id,
    });
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(created.api_key);
        setCopied(true);
        return;
      }
    } catch {
      // fall through to the manual-copy hint
    }
    notify('Copiar chave', 'Mantenha premido o texto da chave para o selecionar e copiar.');
  };

  if (authLoading || !isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const creating = createMutation.isPending;

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
            <Text style={styles.headerTitle}>API para parceiros</Text>
            <TouchableOpacity onPress={() => refetchKeys()} accessibilityLabel="Atualizar">
              <MaterialIcons name="refresh" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Chaves, planos e consumo mensal da API v1</Text>
        </LinearGradient>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <Kpi icon="vpn-key" label="Chaves ativas" value={formatInt(activeCount)} color="#22C55E" colors={colors} />
          <Kpi icon="euro" label="MRR (preço de tabela)" value={formatEur(keysData?.mrr_eur_list_price ?? 0)} color="#C49A6C" colors={colors} />
          <Kpi icon="inbox" label="Pedidos pendentes" value={formatInt(requestsData?.total ?? 0)} color="#3B82F6" colors={colors} />
        </View>

        {/* Newly created key — shown once */}
        {created && (
          <View style={[styles.section, styles.createdBox, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="warning" size={22} color="#B45309" />
              <Text style={[styles.sectionTitle, { color: '#78350F', marginBottom: 0 }]}>Nova chave emitida</Text>
              <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={() => setCreated(null)} accessibilityLabel="Fechar">
                <MaterialIcons name="close" size={20} color="#78350F" />
              </TouchableOpacity>
            </View>
            <Text style={styles.createdMeta}>
              {created.org_name} · {planName(created.plan)} · {created.key_prefix}…
            </Text>
            <View style={styles.keyBox}>
              <Text style={[styles.keyText, { fontFamily: MONO }]} selectable>{created.api_key}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <MaterialIcons name={copied ? 'check' : 'content-copy'} size={16} color="#FFF" />
              <Text style={styles.copyBtnText}>{copied ? 'Copiada' : 'Copiar chave'}</Text>
            </TouchableOpacity>
            <Text style={styles.createdWarning}>
              {created.warning || 'Guarde esta chave agora — não volta a ser mostrada.'}
            </Text>
          </View>
        )}

        {/* New key form */}
        <View
          style={[styles.section, { backgroundColor: colors.surface }]}
          onLayout={(e) => { formY.current = e.nativeEvent.layout.y; }}
        >
          <TouchableOpacity style={styles.sectionHeader} onPress={() => { setShowForm(!showForm); setFormError(null); }}>
            <MaterialIcons name="add-circle" size={22} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Nova chave</Text>
            <MaterialIcons
              name={showForm ? 'expand-less' : 'expand-more'}
              size={22}
              color={colors.textMuted}
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          {showForm && (
            <View style={{ marginTop: 12, gap: 12 }}>
              {form.request_id ? (
                <View style={[styles.infoPill, { backgroundColor: '#3B82F615' }]}>
                  <MaterialIcons name="link" size={14} color="#3B82F6" />
                  <Text style={{ fontSize: 12, color: '#1E40AF', flex: 1 }}>
                    Associada ao pedido {form.request_id.slice(0, 8)} — será marcado como aprovado.
                  </Text>
                  <TouchableOpacity onPress={() => setForm({ ...form, request_id: undefined })} accessibilityLabel="Desassociar pedido">
                    <MaterialIcons name="close" size={14} color="#1E40AF" />
                  </TouchableOpacity>
                </View>
              ) : null}
              <Field label="Nome interno" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex.: Hotel X — produção" colors={colors} />
              <Field label="Organização" value={form.org_name} onChangeText={(v) => setForm({ ...form, org_name: v })} placeholder="Ex.: Hotel X, Lda." colors={colors} />
              <Field
                label="Email de contacto (opcional)"
                value={form.contact_email}
                onChangeText={(v) => setForm({ ...form, contact_email: v })}
                placeholder="tecnico@empresa.pt"
                keyboardType="email-address"
                colors={colors}
              />
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Plano</Text>
                <ChoiceChips
                  options={plans}
                  value={form.plan}
                  onChange={(id) => setForm({ ...form, plan: id as ApiPlanId })}
                  colors={colors}
                />
              </View>
              {formError && <Text style={styles.errorText}>{formError}</Text>}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: creating ? 0.6 : 1 }]}
                onPress={handleSubmit}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <MaterialIcons name="vpn-key" size={18} color="#FFF" />}
                <Text style={styles.primaryBtnText}>Emitir chave</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Keys list */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="vpn-key" size={22} color="#8B5CF6" />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Chaves</Text>
            <View style={[styles.badge, { backgroundColor: '#8B5CF620' }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#8B5CF6' }}>{keysData?.total ?? 0}</Text>
            </View>
          </View>

          <ChoiceChips
            options={STATUS_FILTERS.map((f) => ({ id: f.id, name: f.label }))}
            value={statusFilter}
            onChange={(id) => setStatusFilter(id as StatusFilter)}
            colors={colors}
          />

          {keysLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : keysError ? (
            <Text style={[styles.errorText, { marginTop: 12 }]}>
              {partnerApiErrorMessage(keysError, 'Falha ao carregar as chaves.')}
            </Text>
          ) : visibleKeys.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="vpn-key-off" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Nenhuma chave nesta vista</Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 12 }}>
              {visibleKeys.map((key) => (
                <KeyCard
                  key={key.key_id}
                  apiKey={key}
                  planLabel={planName(key.plan)}
                  plans={plans}
                  editingPlan={editingPlanFor === key.key_id}
                  busy={busyKey === key.key_id}
                  onTogglePlanEditor={() => setEditingPlanFor(editingPlanFor === key.key_id ? null : key.key_id)}
                  onChangePlan={(plan) => handleChangePlan(key, plan)}
                  onToggleStatus={() => handleToggleStatus(key)}
                  onRevoke={() => handleRevoke(key)}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </View>

        {/* Access requests */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="inbox" size={22} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Pedidos de acesso</Text>
            <View style={[styles.badge, { backgroundColor: '#3B82F620' }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>{requestsData?.total ?? 0}</Text>
            </View>
          </View>

          {requestsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : pendingRequests.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="check-circle" size={36} color="#22C55E" />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Nenhum pedido pendente</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {pendingRequests.map((req) => (
                <View key={req.request_id} style={[styles.card, { borderColor: colors.borderLight }]}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{req.org_name}</Text>
                    <PlanBadge label={planName(req.desired_plan)} />
                  </View>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]} selectable>
                    {req.contact_name} · {req.contact_email}
                  </Text>
                  {req.website ? (
                    <Text style={[styles.cardMeta, { color: colors.textMuted }]} selectable numberOfLines={1}>{req.website}</Text>
                  ) : null}
                  <Text style={[styles.useCase, { color: colors.textPrimary }]}>{req.use_case}</Text>
                  <View style={styles.cardBottom}>
                    <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Recebido {formatDate(req.created_at, true)}</Text>
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleIssueFromRequest(req)}
                    >
                      <MaterialIcons name="vpn-key" size={14} color="#FFF" />
                      <Text style={styles.smallBtnText}>Emitir chave</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
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

function PlanBadge({ label }: { label: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: '#8B5CF620' }]}>
      <Text style={[styles.pillText, { color: '#7C3AED' }]}>{label}</Text>
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

function Field({ label, colors, ...input }: {
  label: string; colors: ThemeColors;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        {...input}
        autoCapitalize={input.keyboardType === 'email-address' ? 'none' : input.autoCapitalize}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background }]}
      />
    </View>
  );
}

function UsageBar({ used, quota, colors }: { used: number; quota: number | null; colors: ThemeColors }) {
  const pct = quota ? Math.min(100, (used / Math.max(1, quota)) * 100) : 0;
  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#22C55E';
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.usageHeader}>
        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Consumo do mês</Text>
        <Text style={[styles.cardMeta, { color: colors.textPrimary, fontWeight: '700' }]}>
          {formatInt(used)} / {quota == null ? 'ilimitado' : formatInt(quota)}
        </Text>
      </View>
      <View style={[styles.usageTrack, { backgroundColor: colors.borderLight }]}>
        <View style={[styles.usageFill, {
          width: quota == null ? '100%' : `${pct}%`,
          backgroundColor: quota == null ? '#3B82F655' : barColor,
        }]} />
      </View>
    </View>
  );
}

function KeyCard({
  apiKey, planLabel, plans, editingPlan, busy,
  onTogglePlanEditor, onChangePlan, onToggleStatus, onRevoke, colors,
}: {
  apiKey: ApiKey;
  planLabel: string;
  plans: { id: ApiPlanId; name: string }[];
  editingPlan: boolean;
  busy: boolean;
  onTogglePlanEditor: () => void;
  onChangePlan: (plan: ApiPlanId) => void;
  onToggleStatus: () => void;
  onRevoke: () => void;
  colors: ThemeColors;
}) {
  const status = STATUS_META[apiKey.status] ?? { label: apiKey.status, color: '#6B7280' };
  const revoked = apiKey.status === 'revoked';
  const usage = apiKey.usage;
  return (
    <View style={[styles.card, { borderColor: colors.borderLight, opacity: revoked ? 0.6 : 1 }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{apiKey.org_name}</Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>{apiKey.name}</Text>
        </View>
        <PlanBadge label={planLabel} />
        <View style={[styles.pill, { backgroundColor: status.color + '20' }]}>
          <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <Text style={[styles.prefix, { color: colors.textSecondary, fontFamily: MONO }]} selectable>
        {apiKey.key_prefix}…
      </Text>

      {usage && <UsageBar used={usage.used} quota={usage.quota} colors={colors} />}

      <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
        Último uso: {formatDate(apiKey.last_used_at, true)} · Criada {formatDate(apiKey.created_at)}
        {apiKey.contact_email ? ` · ${apiKey.contact_email}` : ''}
      </Text>

      {!revoked && (
        <>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.border }]}
              onPress={onTogglePlanEditor}
              disabled={busy}
            >
              <MaterialIcons name="swap-horiz" size={16} color={colors.textSecondary} />
              <Text style={[styles.outlineBtnText, { color: colors.textSecondary }]}>Mudar plano</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.border }]}
              onPress={onToggleStatus}
              disabled={busy}
            >
              <MaterialIcons
                name={apiKey.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                size={16}
                color={apiKey.status === 'active' ? '#B45309' : '#15803D'}
              />
              <Text style={[styles.outlineBtnText, { color: apiKey.status === 'active' ? '#B45309' : '#15803D' }]}>
                {apiKey.status === 'active' ? 'Suspender' : 'Reativar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: '#EF444466' }]}
              onPress={onRevoke}
              disabled={busy}
            >
              <MaterialIcons name="block" size={16} color="#DC2626" />
              <Text style={[styles.outlineBtnText, { color: '#DC2626' }]}>Revogar</Text>
            </TouchableOpacity>
            {busy && <ActivityIndicator size="small" color={colors.accent} />}
          </View>
          {editingPlan && (
            <ChoiceChips
              options={plans}
              value={apiKey.plan}
              onChange={(id) => onChangePlan(id as ApiPlanId)}
              colors={colors}
            />
          )}
        </>
      )}
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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, fontFamily: serif },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 'auto' },
  createdBox: { borderWidth: 2 },
  createdMeta: { fontSize: 12, color: '#78350F', marginBottom: 8 },
  keyBox: { backgroundColor: '#1C1F1C', borderRadius: 10, padding: 12 },
  keyText: { color: '#FDE68A', fontSize: 13, fontWeight: '600' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#B45309', borderRadius: 10, paddingVertical: 10, marginTop: 10,
  },
  copyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  createdWarning: { fontSize: 12, color: '#78350F', fontWeight: '700', marginTop: 10, lineHeight: 17 },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
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
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  cardMeta: { fontSize: 12 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  useCase: { fontSize: 13, lineHeight: 18 },
  prefix: { fontSize: 12 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pillText: { fontSize: 11, fontWeight: '700' },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  usageTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 3 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  outlineBtnText: { fontSize: 12, fontWeight: '600' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
