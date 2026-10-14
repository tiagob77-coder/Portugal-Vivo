/**
 * API para parceiros (v1) — documentação pública, planos e pedido de acesso.
 *
 * A API v1 (`/api/v1/*`, autenticada por X-API-Key) é o contrato licenciado a
 * terceiros. Os endpoints não versionados servem apenas a app Portugal Vivo.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { API_BASE, API_URL } from '../src/config/api';
import { useTheme } from '../src/context/ThemeContext';
import { palette, withOpacity } from '../src/theme/colors';
import { HIT_SLOP } from '../src/theme/spacing';
import {
  getApiPlans, createAccessRequest, partnerApiErrorMessage,
  type ApiPlan, type ApiPlanId, type AccessRequestCreated,
} from '../src/services/api/partnerApi';

const V1_BASE = `${API_BASE}/v1`;
const MONO = Platform.OS === 'web' ? 'monospace' : Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// ─── Partner API v1 reference ────────────────────────────────────────────────

type Tier = 'publico' | 'chave' | 'explorador' | 'parceiro' | 'pro';

const TIER_META: Record<Tier, { label: string; color: string }> = {
  publico: { label: 'Público', color: palette.gray[500] },
  chave: { label: 'Qualquer plano', color: palette.gray[600] },
  explorador: { label: 'Explorador+', color: palette.mint[600] },
  parceiro: { label: 'Parceiro+', color: palette.ocean[500] },
  pro: { label: 'Pro+', color: palette.terracotta[600] },
};

interface EndpointDoc {
  method: 'GET' | 'POST';
  path: string;
  desc: string;
  tier: Tier;
  params?: string;
}

interface EndpointGroup {
  group: string;
  color: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  endpoints: EndpointDoc[];
}

const V1_GROUPS: EndpointGroup[] = [
  {
    group: 'Património',
    color: palette.terracotta[500],
    icon: 'account-balance',
    endpoints: [
      {
        method: 'GET', path: '/v1/heritage', tier: 'explorador',
        desc: 'Lista paginada de POIs publicados.',
        params: 'category, region, municipality, bbox=minLng,minLat,maxLng,maxLat, page, page_size (≤ 100)',
      },
      { method: 'GET', path: '/v1/heritage/{poi_id}', tier: 'explorador', desc: 'Detalhe de um POI (descrição, história local, acessibilidade, horários).' },
    ],
  },
  {
    group: 'Rotas',
    color: palette.forest[500],
    icon: 'alt-route',
    endpoints: [
      { method: 'GET', path: '/v1/routes', tier: 'explorador', desc: 'Lista paginada de rotas temáticas.', params: 'category, region, page, page_size (≤ 100)' },
      { method: 'GET', path: '/v1/routes/{route_id}', tier: 'explorador', desc: 'Detalhe de uma rota com os POIs (pois) pela ordem do percurso.' },
    ],
  },
  {
    group: 'Mapa',
    color: palette.ocean[500],
    icon: 'map',
    endpoints: [
      { method: 'GET', path: '/v1/map/items', tier: 'explorador', desc: 'Pontos leves para desenhar mapas (id, nome, categoria, coordenadas).', params: 'bbox, categories, limit (≤ 5000)' },
    ],
  },
  {
    group: 'Conteúdo editorial',
    color: '#8B5CF6',
    icon: 'auto-stories',
    endpoints: [
      { method: 'GET', path: '/v1/narratives/{poi_id}', tier: 'parceiro', desc: 'Narrativa de um POI. Nos planos Pro+ inclui audio_endpoint.' },
      { method: 'GET', path: '/v1/events', tier: 'parceiro', desc: 'Agenda de eventos e festividades.', params: 'region, municipality, month, page, page_size (≤ 100)' },
      { method: 'GET', path: '/v1/weather/{location}', tier: 'parceiro', desc: 'Previsão IPMA para capitais de distrito (ex.: braga, faro).' },
      { method: 'GET', path: '/v1/audio/{poi_id}', tier: 'pro', desc: 'Áudio-guia do POI em MP3 (base64).' },
    ],
  },
  {
    group: 'Conta e acesso',
    color: palette.gray[600],
    icon: 'manage-accounts',
    endpoints: [
      { method: 'GET', path: '/v1/usage', tier: 'chave', desc: 'Plano e consumo do mês corrente da chave enviada. Não conta para a quota.' },
      { method: 'GET', path: '/v1/plans', tier: 'publico', desc: 'Catálogo de planos (sem chave).' },
      { method: 'POST', path: '/v1/access-requests', tier: 'publico', desc: 'Pedido de acesso à API (sem chave). Ver formulário abaixo.' },
    ],
  },
];

const ERROR_CODES: { code: string; title: string; desc: string; color: string }[] = [
  { code: '401', title: 'Não autenticado', desc: 'Cabeçalho X-API-Key em falta, chave inválida, suspensa ou revogada.', color: '#EF4444' },
  { code: '403', title: 'Fora do plano', desc: 'A funcionalidade não está incluída no plano da chave (a resposta indica o plano necessário).', color: '#F59E0B' },
  { code: '404', title: 'Não encontrado', desc: 'POI, rota ou localidade inexistente.', color: palette.gray[500] },
  { code: '422', title: 'Parâmetros inválidos', desc: 'Ex.: bbox mal formada ou page_size acima do limite.', color: palette.gray[500] },
  { code: '429', title: 'Quota esgotada', desc: 'Quota mensal do plano atingida. Repõe no início de cada mês (UTC) ou com upgrade de plano.', color: '#DC2626' },
];

const CURL_EXAMPLE = `curl -H "X-API-Key: pv_live_…" \\\n  "${V1_BASE}/heritage?region=norte&page_size=20"`;

const ENVELOPE_EXAMPLE = `{
  "data": [ { "id": "…", "name": "…", "category": "…", "location": { "lat": 41.5, "lng": -8.4 } } ],
  "meta": { "page": 1, "page_size": 20, "total": 1234 },
  "attribution": "Conteúdo Portugal Vivo — portugalvivo.pt"
}`;

const RATE_HEADERS_EXAMPLE = `X-RateLimit-Limit: 10000        # quota mensal do plano ("unlimited" no Enterprise)
X-RateLimit-Remaining: 9873`;

const FEATURE_LABELS: Record<string, string> = {
  heritage: 'Património',
  routes: 'Rotas',
  map: 'Mapa',
  narratives: 'Narrativas',
  events: 'Eventos',
  weather: 'Meteorologia',
  audio: 'Áudio',
};

const FALLBACK_PLAN_OPTIONS: { id: ApiPlanId; name: string }[] = [
  { id: 'explorador', name: 'Explorador' },
  { id: 'parceiro', name: 'Parceiro' },
  { id: 'pro', name: 'Pro' },
  { id: 'enterprise', name: 'Enterprise' },
];

// ─── App (unversioned) endpoints — not licensed to third parties ─────────────

const APP_GROUPS = [
  {
    group: 'Património',
    endpoints: [
      { method: 'GET', path: '/api/heritage', desc: 'Listar POIs com filtros (região, categoria, limite)', auth: false },
      { method: 'GET', path: '/api/heritage/{id}', desc: 'Detalhe de um POI com narrativa e localização', auth: false },
      { method: 'GET', path: '/api/heritage/search', desc: 'Pesquisa full-text com filtros avançados', auth: false },
    ],
  },
  {
    group: 'Descoberta',
    endpoints: [
      { method: 'POST', path: '/api/discover/feed', desc: 'Feed personalizado (por perfil e localização)', auth: false },
      { method: 'GET', path: '/api/discover/trending', desc: 'POIs em tendência (últimos 7 dias)', auth: false },
      { method: 'GET', path: '/api/discover/surprise', desc: 'POI aleatório oculto (Surpreende-me)', auth: false },
    ],
  },
  {
    group: 'Eventos e Agenda',
    endpoints: [
      { method: 'GET', path: '/api/calendar/events', desc: 'Eventos culturais e festivais', auth: false },
      { method: 'GET', path: '/api/calendar/events/{id}', desc: 'Detalhe de um evento', auth: false },
    ],
  },
  {
    group: 'Gamificação',
    endpoints: [
      { method: 'GET', path: '/api/leaderboard/top', desc: 'Ranking de exploradores (por período e região)', auth: false },
      { method: 'GET', path: '/api/gamification/profile', desc: 'Perfil do utilizador autenticado', auth: true },
      { method: 'POST', path: '/api/gamification/checkin', desc: 'Check-in num POI (requer localização)', auth: true },
    ],
  },
  {
    group: 'Portal de parceiros (câmaras e museus)',
    endpoints: [
      { method: 'POST', path: '/api/partner/register', desc: 'Registar câmara ou museu', auth: false },
      { method: 'GET', path: '/api/partner/pois', desc: 'POIs do território do parceiro (com health scores)', auth: true },
      { method: 'POST', path: '/api/partner/drafts', desc: 'Submeter draft de conteúdo para aprovação', auth: true },
    ],
  },
  {
    group: 'Comunidade',
    endpoints: [
      { method: 'POST', path: '/api/contributions', desc: 'Submeter micro-contribuição (horários, fotos, curiosidades)', auth: false },
      { method: 'GET', path: '/api/encounters', desc: 'Listar encontros com comunidades (artesãos, músicos…)', auth: false },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: palette.mint[500],
  POST: palette.ocean[400],
  PATCH: palette.terracotta[400],
  DELETE: '#EF4444',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USE_CASE_MIN = 10;
const USE_CASE_MAX = 2000;

const formatEur = (v: number) => (v === 0
  ? 'Grátis'
  : `${v.toLocaleString('pt-PT', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })} €`);

interface AccessForm {
  org_name: string;
  contact_name: string;
  contact_email: string;
  website: string;
  use_case: string;
  desired_plan: ApiPlanId;
}

const EMPTY_ACCESS_FORM: AccessForm = {
  org_name: '', contact_name: '', contact_email: '', website: '', use_case: '', desired_plan: 'explorador',
};

function makeStyles(C: Record<string, string>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bodyBg },
    header: {
      backgroundColor: C.headerBg, flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 14, gap: 12,
    },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: withOpacity(palette.white, 0.1), alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: palette.white },
    headerSub: { fontSize: 11, color: withOpacity(palette.white, 0.5), marginTop: 1 },
    docsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.docsBtnBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    docsBtnText: { fontSize: 12, fontWeight: '700', color: C.docsBtnText },

    baseUrlCard: { margin: 16, marginBottom: 12, backgroundColor: C.headerBg, borderRadius: 12, padding: 14 },
    baseUrlLabel: { fontSize: 9, fontWeight: '800', color: C.textSub, letterSpacing: 1.5, marginBottom: 6 },
    baseUrl: { fontSize: 14, fontFamily: MONO, color: C.baseUrlColor, fontWeight: '600', marginBottom: 10 },
    baseUrlNote: { fontSize: 11, color: C.textSub, lineHeight: 16 },
    headerKey: { fontSize: 13, fontFamily: MONO, color: '#FDE68A', fontWeight: '600', marginBottom: 6 },

    notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginBottom: 12, borderRadius: 10, padding: 12 },
    noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },

    sectionTitle: { fontSize: 15, fontWeight: '800', color: C.groupTitle, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
    sectionSub: { fontSize: 12, color: C.textMuted, marginHorizontal: 16, marginTop: -4, marginBottom: 10, lineHeight: 17 },

    card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, shadowColor: palette.black, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    cardTitle: { fontSize: 13, fontWeight: '700', color: C.groupTitle, marginBottom: 8 },
    code: { backgroundColor: C.codeBg, borderRadius: 10, padding: 12 },
    codeText: { fontFamily: MONO, fontSize: 11.5, color: C.codeText, lineHeight: 17 },
    body: { fontSize: 12, color: C.textMuted, lineHeight: 18, marginTop: 8 },
    bold: { fontWeight: '700', color: C.groupTitle },

    group: { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', shadowColor: palette.black, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    groupIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    groupTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: C.groupTitle },
    groupCount: { fontSize: 11, color: C.textSub, marginRight: 4 },

    endpoints: { borderTopWidth: 1, borderTopColor: C.borderLight },
    endpoint: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.bodyBg },
    endpointTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    methodBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
    methodText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    epPath: { flex: 1, fontSize: 12, fontFamily: MONO, color: C.epPath },
    tierBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    tierText: { fontSize: 10, fontWeight: '800' },
    authBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.authBadgeBg, alignItems: 'center', justifyContent: 'center' },
    epDesc: { fontSize: 12, color: C.textMuted, lineHeight: 17 },
    epParams: { fontSize: 11, color: C.epPath, fontFamily: MONO, marginTop: 4, lineHeight: 16 },

    errorRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.bodyBg },
    errorCode: { width: 44, fontSize: 14, fontWeight: '800', fontFamily: MONO },
    errorTitle: { fontSize: 13, fontWeight: '700', color: C.groupTitle },

    table: { borderWidth: 1, borderColor: C.borderLight, borderRadius: 10, overflow: 'hidden' },
    tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderLight },
    th: { fontSize: 11, fontWeight: '800', color: C.textSub, letterSpacing: 0.5, padding: 10, backgroundColor: C.bodyBg },
    td: { fontSize: 12, color: C.groupTitle, padding: 10 },
    tableNote: { fontSize: 11, color: C.textMuted, marginTop: 8, lineHeight: 16 },

    fieldLabel: { fontSize: 12, fontWeight: '600', color: C.epPath, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: C.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.groupTitle, backgroundColor: C.card },
    counter: { fontSize: 11, color: C.textSub, textAlign: 'right', marginTop: 4 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    chipText: { fontSize: 12, fontWeight: '600' },
    formError: { fontSize: 13, color: C.error },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.submitBg, borderRadius: 12, paddingVertical: 13 },
    submitText: { color: palette.white, fontWeight: '700', fontSize: 15 },
    success: { alignItems: 'center', gap: 8, paddingVertical: 8 },
    successTitle: { fontSize: 16, fontWeight: '800', color: C.groupTitle },
    successText: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
    linkBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    linkBtnText: { fontSize: 13, fontWeight: '700', color: C.submitBg },

    fullDocsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, backgroundColor: C.headerBg, borderRadius: 14, paddingVertical: 14 },
    fullDocsBtnText: { color: palette.white, fontWeight: '700', fontSize: 15 },
  });
}

export default function ApiDocsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(V1_GROUPS[0].group);
  const [appExpanded, setAppExpanded] = useState(false);
  const [form, setForm] = useState<AccessForm>(EMPTY_ACCESS_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<AccessRequestCreated | null>(null);

  const C = {
    bodyBg:       palette.gray[50],
    headerBg:     palette.gray[800],
    card:         palette.white,
    docsBtnBg:    palette.forest[50],
    docsBtnText:  palette.forest[500],
    baseUrlColor: '#38BDF8',
    textSub:      palette.gray[400],
    textMuted:    palette.gray[500],
    groupTitle:   palette.gray[800],
    borderLight:  palette.gray[100],
    inputBorder:  palette.gray[200],
    epPath:       palette.gray[700],
    authBadgeBg:  palette.terracotta[100],
    codeBg:       palette.gray[800],
    codeText:     '#E5E7EB',
    submitBg:     palette.forest[500],
    success:      colors.success,
    error:        colors.error,
    warning:      colors.warning,
    info:         colors.info,
  };

  const s = makeStyles(C);

  const { data: plansData, isLoading: plansLoading, error: plansError, refetch: refetchPlans } = useQuery({
    queryKey: ['partner-api-plans'],
    queryFn: getApiPlans,
    staleTime: 10 * 60_000,
  });

  const planOptions = useMemo(
    () => (plansData?.plans?.length ? plansData.plans.map((p) => ({ id: p.id, name: p.name })) : FALLBACK_PLAN_OPTIONS),
    [plansData],
  );

  const accessMutation = useMutation({
    mutationFn: createAccessRequest,
    onSuccess: (result: AccessRequestCreated) => {
      setSubmitted(result);
      setForm(EMPTY_ACCESS_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(partnerApiErrorMessage(err, 'Não foi possível enviar o pedido. Tente novamente.')),
  });
  const sending = accessMutation.isPending;

  const openDocs = () => {
    const url = `${API_URL}/redoc`;
    if (Platform.OS === 'web') { window.open(url, '_blank'); }
    else { Linking.openURL(url); }
  };

  const handleSubmit = () => {
    const org = form.org_name.trim();
    const name = form.contact_name.trim();
    const email = form.contact_email.trim();
    const website = form.website.trim();
    const useCase = form.use_case.trim();
    if (org.length < 2) { setFormError('Indique o nome da organização.'); return; }
    if (name.length < 2) { setFormError('Indique o nome do contacto.'); return; }
    if (!EMAIL_RE.test(email)) { setFormError('Indique um email válido.'); return; }
    if (useCase.length < USE_CASE_MIN) { setFormError(`Descreva o caso de uso (mín. ${USE_CASE_MIN} caracteres).`); return; }
    if (useCase.length > USE_CASE_MAX) { setFormError(`O caso de uso tem um máximo de ${USE_CASE_MAX} caracteres.`); return; }
    setFormError(null);
    accessMutation.mutate({
      org_name: org,
      contact_name: name,
      contact_email: email,
      use_case: useCase,
      desired_plan: form.desired_plan,
      website: website || undefined,
    });
  };

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={HIT_SLOP} accessibilityLabel="Voltar">
          <MaterialIcons name="arrow-back" size={22} color={palette.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>API para parceiros</Text>
          <Text style={s.headerSub}>Portugal Vivo · API v1 para agências, hotéis e plataformas</Text>
        </View>
        <TouchableOpacity style={s.docsBtn} onPress={openDocs}>
          <MaterialIcons name="open-in-new" size={16} color={C.docsBtnText} />
          <Text style={s.docsBtnText}>Redoc</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        {/* Base URL + auth */}
        <View style={s.baseUrlCard}>
          <Text style={s.baseUrlLabel}>BASE URL</Text>
          <Text style={s.baseUrl} selectable>{V1_BASE}</Text>
          <Text style={s.baseUrlLabel}>AUTENTICAÇÃO</Text>
          <Text style={s.headerKey} selectable>X-API-Key: pv_live_…</Text>
          <Text style={s.baseUrlNote}>
            JSON · Uma chave por integração · Quota mensal por plano · Chaves emitidas pela equipa Portugal Vivo após pedido de acesso.
          </Text>
        </View>

        <View style={[s.notice, { backgroundColor: '#EFF6FF' }]}>
          <MaterialIcons name="info" size={14} color={C.info} />
          <Text style={[s.noticeText, { color: '#1E40AF' }]}>
            Envie a chave apenas a partir do seu servidor — nunca em código cliente público. Cada pedido aos endpoints de dados conta para a quota mensal.
          </Text>
        </View>

        {/* Quick start */}
        <Text style={s.sectionTitle}>Primeiro pedido</Text>
        <View style={s.card}>
          <View style={s.code}>
            <Text style={s.codeText} selectable>{CURL_EXAMPLE}</Text>
          </View>
        </View>

        {/* Endpoints */}
        <Text style={s.sectionTitle}>Endpoints v1</Text>
        <Text style={s.sectionSub}>O selo indica o plano mínimo. Pedidos acima do plano devolvem 403.</Text>
        {V1_GROUPS.map((group) => (
          <View key={group.group} style={s.group}>
            <TouchableOpacity
              style={s.groupHeader}
              onPress={() => setExpanded(expanded === group.group ? null : group.group)}
              accessibilityRole="button"
              accessibilityState={{ expanded: expanded === group.group }}
            >
              <View style={[s.groupIcon, { backgroundColor: withOpacity(group.color, 0.12) }]}>
                <MaterialIcons name={group.icon} size={18} color={group.color} />
              </View>
              <Text style={s.groupTitle}>{group.group}</Text>
              <Text style={s.groupCount}>{group.endpoints.length} endpoint{group.endpoints.length === 1 ? '' : 's'}</Text>
              <MaterialIcons name={expanded === group.group ? 'expand-less' : 'expand-more'} size={20} color={C.textSub} />
            </TouchableOpacity>

            {expanded === group.group && (
              <View style={s.endpoints}>
                {group.endpoints.map((ep) => {
                  const tier = TIER_META[ep.tier];
                  return (
                    <View key={`${ep.method} ${ep.path}`} style={s.endpoint}>
                      <View style={s.endpointTop}>
                        <View style={[s.methodBadge, { backgroundColor: withOpacity(METHOD_COLORS[ep.method], 0.12) }]}>
                          <Text style={[s.methodText, { color: METHOD_COLORS[ep.method] }]}>{ep.method}</Text>
                        </View>
                        <Text style={s.epPath} selectable numberOfLines={1}>{ep.path}</Text>
                        <View style={[s.tierBadge, { backgroundColor: withOpacity(tier.color, 0.14) }]}>
                          <Text style={[s.tierText, { color: tier.color }]}>{tier.label}</Text>
                        </View>
                      </View>
                      <Text style={s.epDesc}>{ep.desc}</Text>
                      {ep.params ? <Text style={s.epParams} selectable>{ep.params}</Text> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        {/* Envelope + headers */}
        <Text style={s.sectionTitle}>Formato das respostas</Text>
        <View style={s.card}>
          <View style={s.code}>
            <Text style={s.codeText} selectable>{ENVELOPE_EXAMPLE}</Text>
          </View>
          <Text style={s.body}>
            <Text style={s.bold}>data</Text> traz o recurso ou a lista; <Text style={s.bold}>meta</Text> traz a paginação (page, page_size, total).
            A <Text style={s.bold}>attribution</Text> deve ser mostrada junto ao conteúdo — é omitida nos planos com white-label (Pro e Enterprise).
          </Text>
        </View>

        <Text style={s.sectionTitle}>Limites</Text>
        <View style={s.card}>
          <View style={s.code}>
            <Text style={s.codeText} selectable>{RATE_HEADERS_EXAMPLE}</Text>
          </View>
          <Text style={s.body}>
            Todas as respostas dos endpoints de dados incluem estes cabeçalhos. Consulte o consumo detalhado por funcionalidade em <Text style={s.bold}>GET /v1/usage</Text>.
          </Text>
        </View>

        <Text style={s.sectionTitle}>Códigos de erro</Text>
        <View style={s.card}>
          {ERROR_CODES.map((e) => (
            <View key={e.code} style={s.errorRow}>
              <Text style={[s.errorCode, { color: e.color }]}>{e.code}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.errorTitle}>{e.title}</Text>
                <Text style={s.epDesc}>{e.desc}</Text>
              </View>
            </View>
          ))}
          <Text style={s.body}>Os erros seguem o formato FastAPI: <Text style={s.bold}>{'{ "detail": "…" }'}</Text>.</Text>
        </View>

        {/* Plans */}
        <Text style={s.sectionTitle}>Planos</Text>
        <View style={s.card}>
          {plansLoading ? (
            <ActivityIndicator size="small" color={C.submitBg} style={{ marginVertical: 16 }} />
          ) : plansError || !plansData?.plans?.length ? (
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
              <Text style={s.epDesc}>Não foi possível carregar os planos.</Text>
              <TouchableOpacity style={s.linkBtn} onPress={() => refetchPlans()}>
                <Text style={s.linkBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <PlansTable plans={plansData.plans} s={s} />
              </ScrollView>
              <Text style={s.tableNote}>
                Preços em {plansData.currency || 'EUR'}{plansData.vat_included ? ', IVA incluído' : ', acrescem de IVA'}.
                {' '}Faturação anual com {Math.round((plansData.annual_discount || 0) * 100)}% de desconto (valor mensal equivalente).
                {' '}Enterprise: valor mínimo, contrato anual sob consulta.
              </Text>
            </>
          )}
        </View>

        {/* Access request form */}
        <Text style={s.sectionTitle}>Pedir acesso</Text>
        <Text style={s.sectionSub}>Analisamos cada pedido e enviamos a chave por email. O plano Explorador é gratuito.</Text>
        <View style={s.card}>
          {submitted ? (
            <View style={s.success}>
              <MaterialIcons name="mark-email-read" size={40} color={C.success} />
              <Text style={s.successTitle}>Pedido recebido</Text>
              <Text style={s.successText}>
                Referência <Text style={s.bold} selectable>{submitted.request_id.slice(0, 8)}</Text>. Entraremos em contacto pelo email indicado assim que a chave for emitida.
              </Text>
              <TouchableOpacity style={s.linkBtn} onPress={() => setSubmitted(null)}>
                <Text style={s.linkBtnText}>Enviar outro pedido</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <FormField label="Organização" value={form.org_name} onChangeText={(v) => setForm({ ...form, org_name: v })} placeholder="Ex.: Agência Lusa Tours" s={s} C={C} />
              <FormField label="Nome do contacto" value={form.contact_name} onChangeText={(v) => setForm({ ...form, contact_name: v })} placeholder="Nome e apelido" s={s} C={C} />
              <FormField
                label="Email"
                value={form.contact_email}
                onChangeText={(v) => setForm({ ...form, contact_email: v })}
                placeholder="nome@empresa.pt"
                keyboardType="email-address"
                autoCapitalize="none"
                s={s}
                C={C}
              />
              <FormField
                label="Website (opcional)"
                value={form.website}
                onChangeText={(v) => setForm({ ...form, website: v })}
                placeholder="https://"
                keyboardType="url"
                autoCapitalize="none"
                s={s}
                C={C}
              />
              <View>
                <Text style={s.fieldLabel}>Plano pretendido</Text>
                <View style={s.chipsRow}>
                  {planOptions.map((p) => {
                    const selected = form.desired_plan === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setForm({ ...form, desired_plan: p.id })}
                        style={[s.chip, {
                          backgroundColor: selected ? C.submitBg : 'transparent',
                          borderColor: selected ? C.submitBg : C.inputBorder,
                        }]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[s.chipText, { color: selected ? palette.white : C.epPath }]}>{p.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View>
                <FormField
                  label="Caso de uso"
                  value={form.use_case}
                  onChangeText={(v) => setForm({ ...form, use_case: v })}
                  placeholder="O que vai construir, para que público e volume de pedidos estimado."
                  multiline
                  maxLength={USE_CASE_MAX}
                  s={s}
                  C={C}
                />
                <Text style={s.counter}>{form.use_case.trim().length}/{USE_CASE_MAX}</Text>
              </View>
              {formError && <Text style={s.formError}>{formError}</Text>}
              <TouchableOpacity
                style={[s.submitBtn, { opacity: sending ? 0.6 : 1 }]}
                onPress={handleSubmit}
                disabled={sending}
                accessibilityRole="button"
              >
                {sending
                  ? <ActivityIndicator size="small" color={palette.white} />
                  : <MaterialIcons name="send" size={18} color={palette.white} />}
                <Text style={s.submitText}>Enviar pedido</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* App endpoints — internal */}
        <Text style={s.sectionTitle}>Endpoints da app (uso interno)</Text>
        <View style={[s.notice, { backgroundColor: '#FEF3C7' }]}>
          <MaterialIcons name="block" size={14} color="#B45309" />
          <Text style={[s.noticeText, { color: '#78350F' }]}>
            Os endpoints não versionados (/api/…) servem exclusivamente a app Portugal Vivo. Não estão licenciados a terceiros, não têm SLA e podem mudar sem aviso. Integrações externas devem usar a API v1.
          </Text>
        </View>
        <View style={s.group}>
          <TouchableOpacity
            style={s.groupHeader}
            onPress={() => setAppExpanded(!appExpanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: appExpanded }}
          >
            <View style={[s.groupIcon, { backgroundColor: withOpacity(palette.gray[500], 0.12) }]}>
              <MaterialIcons name="phone-iphone" size={18} color={palette.gray[500]} />
            </View>
            <Text style={s.groupTitle}>Referência interna</Text>
            <Text style={s.groupCount}>{APP_GROUPS.reduce((n, g) => n + g.endpoints.length, 0)} endpoints</Text>
            <MaterialIcons name={appExpanded ? 'expand-less' : 'expand-more'} size={20} color={C.textSub} />
          </TouchableOpacity>
          {appExpanded && (
            <View style={s.endpoints}>
              {APP_GROUPS.map((group) => (
                <View key={group.group}>
                  <Text style={[s.cardTitle, { marginHorizontal: 14, marginTop: 10, marginBottom: 2 }]}>{group.group}</Text>
                  {group.endpoints.map((ep) => (
                    <View key={`${ep.method} ${ep.path}`} style={s.endpoint}>
                      <View style={s.endpointTop}>
                        <View style={[s.methodBadge, { backgroundColor: withOpacity(METHOD_COLORS[ep.method], 0.12) }]}>
                          <Text style={[s.methodText, { color: METHOD_COLORS[ep.method] }]}>{ep.method}</Text>
                        </View>
                        <Text style={s.epPath} selectable numberOfLines={1}>{ep.path}</Text>
                        {ep.auth && (
                          <View style={s.authBadge}>
                            <MaterialIcons name="lock" size={10} color={C.warning} />
                          </View>
                        )}
                      </View>
                      <Text style={s.epDesc}>{ep.desc}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <Text style={[s.epDesc, { padding: 14 }]}>
                O cadeado indica sessão de utilizador da app (Bearer token obtido no login).
              </Text>
            </View>
          )}
        </View>

        {/* Full docs link */}
        <TouchableOpacity style={s.fullDocsBtn} onPress={openDocs}>
          <MaterialIcons name="description" size={20} color={palette.white} />
          <Text style={s.fullDocsBtnText}>Documentação Completa (Redoc)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

type Styles = ReturnType<typeof makeStyles>;

const COLUMNS: { title: string; width: number }[] = [
  { title: 'PLANO', width: 110 },
  { title: 'PREÇO/MÊS', width: 90 },
  { title: 'FATURAÇÃO ANUAL', width: 120 },
  { title: 'QUOTA MENSAL', width: 110 },
  { title: 'FUNCIONALIDADES', width: 220 },
  { title: 'SLA', width: 110 },
];

function PlansTable({ plans, s }: { plans: ApiPlan[]; s: Styles }) {
  return (
    <View style={s.table}>
      <View style={s.tr}>
        {COLUMNS.map((c) => (
          <Text key={c.title} style={[s.th, { width: c.width }]}>{c.title}</Text>
        ))}
      </View>
      {plans.map((p, i) => (
        <View key={p.id} style={[s.tr, i === plans.length - 1 ? { borderBottomWidth: 0 } : null]}>
          <Text style={[s.td, { width: COLUMNS[0].width, fontWeight: '800' }]}>
            {p.name}{p.white_label ? '\nwhite-label' : ''}
          </Text>
          <Text style={[s.td, { width: COLUMNS[1].width }]}>
            {p.id === 'enterprise' && p.price_eur_month > 0 ? `desde ${formatEur(p.price_eur_month)}` : formatEur(p.price_eur_month)}
          </Text>
          <Text style={[s.td, { width: COLUMNS[2].width }]}>
            {p.price_eur_month === 0 ? '—' : `${formatEur(p.price_eur_month_billed_annually)}/mês`}
          </Text>
          <Text style={[s.td, { width: COLUMNS[3].width }]}>
            {p.monthly_quota == null ? 'Ilimitada' : `${p.monthly_quota.toLocaleString('pt-PT')} pedidos`}
          </Text>
          <Text style={[s.td, { width: COLUMNS[4].width }]}>
            {p.features.map((f) => FEATURE_LABELS[f] ?? f).join(', ')}
          </Text>
          <Text style={[s.td, { width: COLUMNS[5].width }]}>{p.sla ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function FormField({ label, s, C, ...input }: {
  label: string; s: Styles; C: Record<string, string>;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={C.textSub}
        style={[s.input, input.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null]}
      />
    </View>
  );
}
