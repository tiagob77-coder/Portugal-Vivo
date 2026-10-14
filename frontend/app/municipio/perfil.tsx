/**
 * Painel Municipal — Página pública
 *
 * Edição do perfil público do município (GET/PUT /municipal/me/profile):
 * identidade, cor da marca, POIs e rotas em destaque. Só o papel
 * 'municipio' pode guardar (403 para editor/viewer).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shadows } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { getRoutes } from '../../src/services/api';
import {
  getMyProfile,
  getMySubscription,
  getPartnerPois,
  updateMyProfile,
  getApiErrorStatus,
  getApiErrorMessage,
  prettifyMunicipalitySlug,
  type MunicipalProfile,
  type PartnerPoi,
} from '../../src/services/api/municipal';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#2E5E4E';
const BG = '#F8FAFC';
const isWeb = Platform.OS === 'web';
const MAX_POIS = 12;
const MAX_ROUTES = 6;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRESET_COLORS = ['#2E5E4E', '#0F766E', '#1D4ED8', '#7C3AED', '#B91C1C', '#C2410C', '#A16207', '#1E293B'];

type TextField =
  | 'display_name'
  | 'tagline'
  | 'description'
  | 'hero_image_url'
  | 'logo_url'
  | 'brand_color'
  | 'website'
  | 'contact_email';

type FormState = Record<TextField, string> & {
  featured_poi_ids: string[];
  featured_route_ids: string[];
};

type FieldErrors = Partial<Record<TextField | 'featured_poi_ids' | 'featured_route_ids', string>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toForm(profile: MunicipalProfile | null, municipalityId: string): FormState {
  return {
    display_name: profile?.display_name ?? prettifyMunicipalitySlug(municipalityId),
    tagline: profile?.tagline ?? '',
    description: profile?.description ?? '',
    hero_image_url: profile?.hero_image_url ?? '',
    logo_url: profile?.logo_url ?? '',
    brand_color: profile?.brand_color ?? '',
    website: profile?.website ?? '',
    contact_email: profile?.contact_email ?? '',
    featured_poi_ids: profile?.featured_poi_ids ?? [],
    featured_route_ids: profile?.featured_route_ids ?? [],
  };
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.display_name.trim();
  if (name.length < 2 || name.length > 80) errors.display_name = 'O nome tem de ter entre 2 e 80 caracteres.';
  if (form.tagline.trim().length > 140) errors.tagline = 'Máximo de 140 caracteres.';
  if (form.description.trim().length > 3000) errors.description = 'Máximo de 3000 caracteres.';
  const color = form.brand_color.trim();
  if (color && !HEX_RE.test(color)) errors.brand_color = 'Use o formato #RRGGBB (ex.: #2E5E4E).';
  (['hero_image_url', 'logo_url', 'website'] as const).forEach((f) => {
    const v = form[f].trim();
    if (v && !v.startsWith('https://')) errors[f] = 'O endereço tem de começar por https://';
  });
  const email = form.contact_email.trim();
  if (email && !EMAIL_RE.test(email)) errors.contact_email = 'Email inválido.';
  if (form.featured_poi_ids.length > MAX_POIS) errors.featured_poi_ids = `Máximo de ${MAX_POIS} POIs.`;
  if (form.featured_route_ids.length > MAX_ROUTES) errors.featured_route_ids = `Máximo de ${MAX_ROUTES} rotas.`;
  return errors;
}

function toPayload(form: FormState): MunicipalProfile {
  const opt = (v: string) => (v.trim() ? v.trim() : null);
  return {
    display_name: form.display_name.trim(),
    tagline: opt(form.tagline),
    description: opt(form.description),
    hero_image_url: opt(form.hero_image_url),
    logo_url: opt(form.logo_url),
    brand_color: opt(form.brand_color)?.toUpperCase() ?? null,
    website: opt(form.website),
    contact_email: opt(form.contact_email),
    featured_poi_ids: form.featured_poi_ids,
    featured_route_ids: form.featured_route_ids,
  };
}

/** Field-level errors from a FastAPI 422 `detail` array (loc = ['body', field]). */
function serverFieldErrors(error: unknown): FieldErrors {
  const detail = (error as any)?.response?.data?.detail;
  const out: FieldErrors = {};
  if (!Array.isArray(detail)) return out;
  detail.forEach((d: any) => {
    const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : null;
    if (typeof field === 'string' && typeof d?.msg === 'string') {
      (out as any)[field] = d.msg.replace(/^Value error, /, '');
    }
  });
  return out;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label, value, onChange, error, placeholder, hint, multiline, maxLength, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'email-address' | 'url';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {maxLength ? <Text style={s.counter}>{value.length}/{maxLength}</Text> : null}
      </View>
      <TextInput
        style={[s.input, multiline && s.inputMultiline, !!error && s.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={!keyboardType || keyboardType === 'default'}
        accessibilityLabel={label}
      />
      {error ? <Text style={s.errorSmall}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

function Section({ title, icon, children, right }: {
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

function SelectedChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={s.selChip}>
      <Text style={s.selChipText} numberOfLines={1}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel={`Remover ${label}`}>
        <MaterialIcons name="close" size={14} color={ACCENT} />
      </TouchableOpacity>
    </View>
  );
}

function PickRow({ title, subtitle, selected, disabled, onPress }: {
  title: string; subtitle?: string; selected: boolean; disabled: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.pickRow, disabled && { opacity: 0.45 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
    >
      <MaterialIcons name={selected ? 'check-box' : 'check-box-outline-blank'} size={20} color={selected ? ACCENT : '#94A3B8'} />
      <View style={{ flex: 1 }}>
        <Text style={s.pickTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.pickSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MunicipioPerfil() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.user_id ?? null;

  const profileQuery = useQuery({
    queryKey: ['municipal-profile', userId],
    queryFn: getMyProfile,
    retry: false,
  });
  const subQuery = useQuery({
    queryKey: ['municipal-subscription', userId],
    queryFn: getMySubscription,
    retry: false,
  });
  const poisQuery = useQuery({
    queryKey: ['partner-pois-picker', userId],
    queryFn: () => getPartnerPois({ page_size: 100, order: 'desc' }),
    retry: false,
  });
  const routesQuery = useQuery({
    queryKey: ['routes-picker'],
    queryFn: () => getRoutes(),
    staleTime: 1000 * 60 * 30,
  });

  const municipalityId = profileQuery.data?.municipality_id ?? subQuery.data?.municipality_id ?? '';

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<{ message: string; status?: number } | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [poiSearch, setPoiSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');

  // Initialise the form once the profile arrives
  useEffect(() => {
    if (!form && profileQuery.data) {
      setForm(toForm(profileQuery.data.profile, profileQuery.data.municipality_id));
    }
  }, [form, profileQuery.data]);

  const save = useMutation({
    mutationFn: (payload: MunicipalProfile) => updateMyProfile(payload),
    onMutate: () => {
      setSaveError(null);
      setSavedAt(null);
    },
    onSuccess: () => {
      setSavedAt(Date.now());
      queryClient.invalidateQueries({ queryKey: ['municipal-profile'] });
    },
    onError: (err) => {
      const status = getApiErrorStatus(err);
      if (status === 422) setErrors((prev) => ({ ...prev, ...serverFieldErrors(err) }));
      const message =
        status === 403
          ? getApiErrorMessage(err, "Só o perfil 'municipio' pode editar a página pública.")
          : status === 402
            ? 'A página pública faz parte dos planos municipais. Ative um plano para a publicar.'
            : status === 422
              ? getApiErrorMessage(err, 'Há campos inválidos. Reveja o formulário.')
              : getApiErrorMessage(err, 'Não foi possível guardar. Tente novamente.');
      setSaveError({ message, status });
    },
  });

  const allPois: PartnerPoi[] = useMemo(() => poisQuery.data?.pois ?? [], [poisQuery.data]);
  const poiNames = useMemo(() => new Map(allPois.map((p) => [p.id, p.name])), [allPois]);
  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);
  const routeNames = useMemo(() => new Map(routes.map((r) => [r.id, r.name])), [routes]);

  const filteredPois = useMemo(() => {
    const q = poiSearch.trim().toLowerCase();
    const list = q
      ? allPois.filter((p) => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
      : allPois;
    return list.slice(0, 30);
  }, [allPois, poiSearch]);

  const filteredRoutes = useMemo(() => {
    const q = routeSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return routes.filter((r) => r.name?.toLowerCase().includes(q)).slice(0, 20);
  }, [routes, routeSearch]);

  // ── Loading / error ─────────────────────────────────────────────────────────

  if (profileQuery.isLoading || (!form && !profileQuery.error)) {
    return (
      <View style={[s.root, s.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (profileQuery.error || !form) {
    return (
      <View style={[s.root, s.center, { padding: 24 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <MaterialIcons name="error-outline" size={40} color="#EF4444" />
        <Text style={s.errorText}>{getApiErrorMessage(profileQuery.error, 'Erro ao carregar a página pública.')}</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => profileQuery.refetch()}>
          <Text style={s.primaryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const set = (field: TextField) => (value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSavedAt(null);
  };

  const togglePoi = (id: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.featured_poi_ids.includes(id);
      if (!has && prev.featured_poi_ids.length >= MAX_POIS) return prev;
      return {
        ...prev,
        featured_poi_ids: has ? prev.featured_poi_ids.filter((x) => x !== id) : [...prev.featured_poi_ids, id],
      };
    });
    setSavedAt(null);
  };

  const toggleRoute = (id: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.featured_route_ids.includes(id);
      if (!has && prev.featured_route_ids.length >= MAX_ROUTES) return prev;
      return {
        ...prev,
        featured_route_ids: has ? prev.featured_route_ids.filter((x) => x !== id) : [...prev.featured_route_ids, id],
      };
    });
    setSavedAt(null);
  };

  const handleSave = () => {
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      setSaveError({ message: 'Há campos inválidos. Reveja o formulário.' });
      return;
    }
    save.mutate(toPayload(form));
  };

  const colorValid = HEX_RE.test(form.brand_color.trim());
  const brand = colorValid ? form.brand_color.trim() : ACCENT;
  const planInactive = subQuery.data ? !subQuery.data.active : false;
  const heroOk = form.hero_image_url.trim().startsWith('https://');
  const logoOk = form.logo_url.trim().startsWith('https://');

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, isWeb && s.contentWeb]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.pageHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Página pública</Text>
            <Text style={s.pageSubtitle}>Como o município aparece aos visitantes no Portugal Vivo</Text>
          </View>
          {!!municipalityId && (
            <TouchableOpacity
              style={s.outlineBtn}
              onPress={() => router.push(`/destino/${municipalityId}`)}
              accessibilityRole="link"
            >
              <MaterialIcons name="open-in-new" size={16} color={ACCENT} />
              <Text style={s.outlineBtnText}>Ver página pública</Text>
            </TouchableOpacity>
          )}
        </View>

        {planInactive && (
          <TouchableOpacity style={s.warnBanner} onPress={() => router.push('/municipio/plano')}>
            <MaterialIcons name="info-outline" size={16} color="#B45309" />
            <Text style={s.warnBannerText}>
              Sem plano ativo: a página pública só fica visível (e editável) com um plano municipal. Ver planos.
            </Text>
          </TouchableOpacity>
        )}

        {/* Preview */}
        <View style={[s.preview, { backgroundColor: brand }]}>
          {heroOk && <Image source={{ uri: form.hero_image_url.trim() }} style={s.previewHero} resizeMode="cover" />}
          <View style={[s.previewOverlay, { backgroundColor: brand + 'B3' }]} />
          <View style={s.previewContent}>
            {logoOk ? (
              <Image source={{ uri: form.logo_url.trim() }} style={s.previewLogo} resizeMode="contain" />
            ) : (
              <View style={[s.previewLogo, s.previewLogoFallback]}>
                <MaterialIcons name="location-city" size={22} color={brand} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.previewName} numberOfLines={1}>{form.display_name || 'Nome do município'}</Text>
              {!!form.tagline && <Text style={s.previewTagline} numberOfLines={2}>{form.tagline}</Text>}
            </View>
          </View>
        </View>

        {/* Identity */}
        <Section title="Identidade" icon="badge">
          <Field label="Nome público *" value={form.display_name} onChange={set('display_name')} error={errors.display_name} maxLength={80} />
          <Field label="Slogan" value={form.tagline} onChange={set('tagline')} error={errors.tagline} maxLength={140} placeholder="Ex.: Onde o Minho começa" />
          <Field
            label="Descrição"
            value={form.description}
            onChange={set('description')}
            error={errors.description}
            maxLength={3000}
            multiline
            placeholder="Apresente o território aos visitantes…"
          />
        </Section>

        {/* Brand */}
        <Section title="Imagem e marca" icon="palette">
          <View style={s.field}>
            <Text style={s.fieldLabel}>Cor da marca</Text>
            <View style={s.colorRow}>
              <View style={[s.swatch, { backgroundColor: colorValid ? form.brand_color.trim() : '#E2E8F0' }]}>
                {!colorValid && <MaterialIcons name="format-paint" size={16} color="#94A3B8" />}
              </View>
              <TextInput
                style={[s.input, s.colorInput, !!errors.brand_color && s.inputError]}
                value={form.brand_color}
                onChangeText={set('brand_color')}
                placeholder="#2E5E4E"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                accessibilityLabel="Cor da marca"
              />
            </View>
            <View style={s.presetRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[s.preset, { backgroundColor: c }, form.brand_color.toUpperCase() === c && s.presetActive]}
                  onPress={() => set('brand_color')(c)}
                  accessibilityLabel={`Usar a cor ${c}`}
                />
              ))}
            </View>
            {errors.brand_color ? <Text style={s.errorSmall}>{errors.brand_color}</Text> : null}
          </View>
          <Field
            label="Imagem de capa (URL)"
            value={form.hero_image_url}
            onChange={set('hero_image_url')}
            error={errors.hero_image_url}
            placeholder="https://…"
            keyboardType="url"
            autoCapitalize="none"
            hint="Imagem horizontal, idealmente 1600×900 px."
          />
          <Field
            label="Logótipo (URL)"
            value={form.logo_url}
            onChange={set('logo_url')}
            error={errors.logo_url}
            placeholder="https://…"
            keyboardType="url"
            autoCapitalize="none"
          />
        </Section>

        {/* Contacts */}
        <Section title="Contactos" icon="contact-mail">
          <Field
            label="Website"
            value={form.website}
            onChange={set('website')}
            error={errors.website}
            placeholder="https://www.cm-…pt"
            keyboardType="url"
            autoCapitalize="none"
          />
          <Field
            label="Email de contacto"
            value={form.contact_email}
            onChange={set('contact_email')}
            error={errors.contact_email}
            placeholder="turismo@cm-…pt"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Section>

        {/* Featured POIs */}
        <Section
          title="POIs em destaque"
          icon="star"
          right={<Text style={s.countText}>{form.featured_poi_ids.length}/{MAX_POIS}</Text>}
        >
          <Text style={s.hint}>
            Escolha até {MAX_POIS} POIs do território. Sem escolha, a página mostra POIs com imagem automaticamente.
          </Text>
          {form.featured_poi_ids.length > 0 && (
            <View style={s.selWrap}>
              {form.featured_poi_ids.map((id) => (
                <SelectedChip key={id} label={poiNames.get(id) ?? id} onRemove={() => togglePoi(id)} />
              ))}
            </View>
          )}
          {errors.featured_poi_ids ? <Text style={s.errorSmall}>{errors.featured_poi_ids}</Text> : null}
          <View style={s.searchWrap}>
            <MaterialIcons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              value={poiSearch}
              onChangeText={setPoiSearch}
              placeholder="Pesquisar POIs do território…"
              placeholderTextColor="#94A3B8"
              accessibilityLabel="Pesquisar POIs"
            />
          </View>
          {poisQuery.isLoading ? (
            <ActivityIndicator size="small" color={ACCENT} style={{ marginVertical: 12 }} />
          ) : poisQuery.error ? (
            <Text style={s.errorSmall}>{getApiErrorMessage(poisQuery.error, 'Não foi possível carregar os POIs.')}</Text>
          ) : filteredPois.length === 0 ? (
            <Text style={s.hint}>Nenhum POI encontrado.</Text>
          ) : (
            <View style={s.pickList}>
              {filteredPois.map((p) => {
                const selected = form.featured_poi_ids.includes(p.id);
                return (
                  <PickRow
                    key={p.id}
                    title={p.name}
                    subtitle={[p.category, p.concelho].filter(Boolean).join(' · ')}
                    selected={selected}
                    disabled={!selected && form.featured_poi_ids.length >= MAX_POIS}
                    onPress={() => togglePoi(p.id)}
                  />
                );
              })}
            </View>
          )}
        </Section>

        {/* Featured routes */}
        <Section
          title="Rotas em destaque"
          icon="route"
          right={<Text style={s.countText}>{form.featured_route_ids.length}/{MAX_ROUTES}</Text>}
        >
          {form.featured_route_ids.length > 0 && (
            <View style={s.selWrap}>
              {form.featured_route_ids.map((id) => (
                <SelectedChip key={id} label={routeNames.get(id) ?? id} onRemove={() => toggleRoute(id)} />
              ))}
            </View>
          )}
          {errors.featured_route_ids ? <Text style={s.errorSmall}>{errors.featured_route_ids}</Text> : null}
          <View style={s.searchWrap}>
            <MaterialIcons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={s.searchInput}
              value={routeSearch}
              onChangeText={setRouteSearch}
              placeholder="Pesquisar rotas (mín. 2 letras)…"
              placeholderTextColor="#94A3B8"
              accessibilityLabel="Pesquisar rotas"
            />
          </View>
          {routesQuery.isLoading && routeSearch.trim().length >= 2 ? (
            <ActivityIndicator size="small" color={ACCENT} style={{ marginVertical: 12 }} />
          ) : routeSearch.trim().length >= 2 && filteredRoutes.length === 0 ? (
            <Text style={s.hint}>Nenhuma rota encontrada.</Text>
          ) : (
            <View style={s.pickList}>
              {filteredRoutes.map((r) => {
                const selected = form.featured_route_ids.includes(r.id);
                return (
                  <PickRow
                    key={r.id}
                    title={r.name}
                    subtitle={r.region}
                    selected={selected}
                    disabled={!selected && form.featured_route_ids.length >= MAX_ROUTES}
                    onPress={() => toggleRoute(r.id)}
                  />
                );
              })}
            </View>
          )}
        </Section>

        {/* Save */}
        {saveError && (
          <View style={s.errorBanner}>
            <MaterialIcons name={saveError.status === 403 ? 'lock' : 'error-outline'} size={18} color="#B91C1C" />
            <View style={{ flex: 1 }}>
              <Text style={s.errorBannerText}>{saveError.message}</Text>
              {saveError.status === 402 && (
                <TouchableOpacity onPress={() => router.push('/municipio/plano')}>
                  <Text style={s.link}>Ver planos</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        {savedAt && !saveError && (
          <View style={s.successBanner}>
            <MaterialIcons name="check-circle" size={18} color="#15803D" />
            <Text style={s.successBannerText}>Página pública guardada.</Text>
          </View>
        )}
        <TouchableOpacity
          style={[s.primaryBtn, s.saveBtn, save.isPending && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={save.isPending}
          accessibilityRole="button"
        >
          {save.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="save" size={18} color="#fff" />
          )}
          <Text style={s.primaryBtnText}>Guardar alterações</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { padding: 16, paddingBottom: 40 },
  contentWeb: { maxWidth: 860, alignSelf: 'center', width: '100%', paddingTop: 24, paddingHorizontal: 24 },
  pageHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: ACCENT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  outlineBtnText: { fontSize: 13, fontWeight: '700', color: ACCENT },
  warnBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 14,
    backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12,
  },
  warnBannerText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  preview: { height: 140, borderRadius: 14, overflow: 'hidden', marginBottom: 14, justifyContent: 'flex-end' },
  previewHero: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  previewOverlay: { ...StyleSheet.absoluteFillObject },
  previewContent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  previewLogo: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#FFFFFF' },
  previewLogoFallback: { alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  previewTagline: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#F1F5F9', ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  countText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  field: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  counter: { fontSize: 11, color: '#94A3B8' },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'web' ? 10 : 8, fontSize: 14, color: '#1E293B',
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  inputError: { borderColor: '#EF4444' },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 4, marginBottom: 6 },
  errorSmall: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  colorInput: { flex: 1, maxWidth: 160 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  preset: { width: 26, height: 26, borderRadius: 13 },
  presetActive: { borderWidth: 3, borderColor: '#FFFFFF', ...shadows.md },
  selWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  selChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 260,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
  },
  selChipText: { fontSize: 12, fontWeight: '600', color: ACCENT, flexShrink: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 40,
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', height: '100%' },
  pickList: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  pickTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  pickSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  errorBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 12,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  errorBannerText: { fontSize: 13, color: '#991B1B', lineHeight: 18 },
  successBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12,
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#BBF7D0',
  },
  successBannerText: { fontSize: 13, color: '#166534', fontWeight: '600' },
  link: { fontSize: 13, fontWeight: '700', color: ACCENT, marginTop: 4 },
  errorText: { fontSize: 14, color: '#EF4444', fontWeight: '600', textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11,
  },
  saveBtn: { alignSelf: isWeb ? 'flex-start' : 'stretch' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
