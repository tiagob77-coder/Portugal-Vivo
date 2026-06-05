/**
 * Partner Portal — Câmaras, Museus e Associações Culturais
 *
 * Vista exclusiva para organizações parceiras aprovadas.
 * Permite ver os POIs do seu território, o health score de cada um,
 * submeter actualizações como drafts e acompanhar o estado.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert, RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { shadows, palette } from '../src/theme';
import { API_BASE } from '../src/config/api';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartnerOrg {
  org_id: string;
  name: string;
  type: string;
  concelhos: string[];
  contact_email: string;
  approved: boolean;
}

interface PoiSummary {
  poi_id: string;
  name: string;
  category: string;
  concelho: string;
  score: number;
  tier: string;
  has_image: boolean;
  has_narrative: boolean;
  last_edited_at?: string;
}

interface PartnerMetrics {
  total_pois: number;
  pois_with_image: number;
  pois_with_narrative: number;
  image_coverage_pct: number;
  narrative_coverage_pct: number;
  drafts_pending: number;
  drafts_published: number;
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function fetchProfile(token?: string): Promise<PartnerOrg | null> {
  const r = await fetch(`${API_BASE}/partner/profile`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Erro ao carregar perfil');
  return r.json();
}

async function fetchPois(
  token?: string,
  tier?: string,
): Promise<{ items: PoiSummary[]; total: number; concelhos: string[] }> {
  const params = new URLSearchParams({ page_size: '50' });
  if (tier) params.set('tier', tier);
  const r = await fetch(`${API_BASE}/partner/pois?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error('Erro ao carregar POIs');
  return r.json();
}

async function fetchMetrics(token?: string): Promise<PartnerMetrics> {
  const r = await fetch(`${API_BASE}/partner/metrics`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error('Erro ao carregar métricas');
  return r.json();
}

async function submitDraft(
  poiId: string,
  field: string,
  body: string,
  notes: string,
  token?: string,
): Promise<{ draft_id: string; message: string }> {
  const r = await fetch(`${API_BASE}/partner/pois/${poiId}/draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ field, body, notes_for_editor: notes }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || 'Erro ao submeter draft');
  }
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

const FIELD_OPTIONS = [
  { value: 'description', label: 'Descrição principal', hint: '300–500 palavras' },
  { value: 'micro_pitch', label: 'Resumo (micro pitch)', hint: 'até 160 caracteres' },
  { value: 'descricao_curta', label: 'Descrição curta', hint: 'até 300 caracteres' },
  { value: 'local_story', label: 'História local', hint: '40–250 palavras sobre este lugar' },
];

// ─── Componente: Métrica ──────────────────────────────────────────────────────

function MetricCard({ label, value, unit, icon, color }: {
  label: string; value: number | string; unit?: string; icon: string; color: string;
}) {
  const { colors: tc } = useTheme();
  return (
    <View style={[metricStyles.card, { backgroundColor: tc.surface }]}>
      <MaterialIcons name={icon as any} size={20} color={color} />
      <Text style={[metricStyles.value, { color: tc.textPrimary }]}>
        {value}
        {unit && <Text style={[metricStyles.unit, { color: tc.textMuted }]}>{unit}</Text>}
      </Text>
      <Text style={[metricStyles.label, { color: tc.textMuted }]}>{label}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, ...shadows.sm },
  value: { fontSize: 22, fontWeight: '800' },
  unit: { fontSize: 13 },
  label: { fontSize: 10, textAlign: 'center', fontWeight: '600' },
});

// ─── Modal: Submeter draft ────────────────────────────────────────────────────

function DraftModal({ poi, onClose, onSuccess, token }: {
  poi: PoiSummary;
  onClose: () => void;
  onSuccess: () => void;
  token?: string;
}) {
  const { colors: tc } = useTheme();
  const [field, setField] = useState('description');
  const [body, setBody] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (body.trim().length < 20) {
      Alert.alert('Texto demasiado curto', 'Escreva pelo menos 20 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitDraft(poi.poi_id, field, body.trim(), notes.trim(), token);
      Alert.alert('Submetido!', res.message || 'Draft submetido com sucesso.');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Erro ao submeter. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedField = FIELD_OPTIONS.find(f => f.value === field);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={draftStyles.backdrop}>
        <View style={[draftStyles.sheet, { backgroundColor: tc.surface }]}>
          <View style={draftStyles.handle} />
          <View style={draftStyles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[draftStyles.sheetTitle, { color: tc.textPrimary }]}>
                Actualizar Conteúdo
              </Text>
              <Text style={[draftStyles.sheetPoi, { color: tc.textMuted }]} numberOfLines={1}>
                {poi.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color={tc.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Selector de campo */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FIELD_OPTIONS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[
                    draftStyles.fieldTab,
                    { borderColor: tc.borderLight },
                    field === f.value && { borderColor: palette.terracotta[500], backgroundColor: palette.terracotta[50] },
                  ]}
                  onPress={() => setField(f.value)}
                >
                  <Text style={[draftStyles.fieldTabText, {
                    color: field === f.value ? palette.terracotta[500] : tc.textMuted,
                  }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {selectedField && (
            <Text style={[draftStyles.fieldHint, { color: tc.textMuted }]}>
              {selectedField.hint}
            </Text>
          )}

          {/* Área de texto */}
          <TextInput
            style={[draftStyles.textArea, { color: tc.textPrimary, borderColor: tc.borderLight, backgroundColor: tc.background }]}
            placeholder="Escreva o conteúdo aqui…"
            placeholderTextColor={tc.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />

          {/* Notas */}
          <TextInput
            style={[draftStyles.notesInput, { color: tc.textPrimary, borderColor: tc.borderLight, backgroundColor: tc.background }]}
            placeholder="Notas para o editor (fontes, contexto…) — opcional"
            placeholderTextColor={tc.textMuted}
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            style={[draftStyles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="send" size={16} color="#fff" />
                <Text style={draftStyles.submitText}>Submeter para revisão</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const draftStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, ...shadows.xl },
  handle: { width: 40, height: 4, backgroundColor: '#CBD5E1', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetPoi: { fontSize: 12, marginTop: 2 },
  fieldTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  fieldTabText: { fontSize: 12, fontWeight: '600' },
  fieldHint: { fontSize: 11, marginBottom: 8 },
  textArea: {
    borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 160,
    fontSize: 14, lineHeight: 21, marginBottom: 10,
  },
  notesInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 16 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.terracotta[500], paddingVertical: 14,
    borderRadius: 12, gap: 8,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Ecrã principal ──────────────────────────────────────────────────────────

export default function PartnerPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const token = (user as any)?.access_token;

  const [activeTier, setActiveTier] = useState<string | undefined>(undefined);
  const [selectedPoi, setSelectedPoi] = useState<PoiSummary | null>(null);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['partner-profile'],
    queryFn: () => fetchProfile(token),
  });

  const { data: poisData, isLoading: loadingPois, refetch: refetchPois } = useQuery({
    queryKey: ['partner-pois', activeTier],
    queryFn: () => fetchPois(token, activeTier),
    enabled: !!profile,
  });

  const { data: metrics } = useQuery({
    queryKey: ['partner-metrics'],
    queryFn: () => fetchMetrics(token),
    enabled: !!profile,
  });

  if (loadingProfile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  // Sem org aprovada → mostrar ecrã de registo
  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={tc.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: tc.textPrimary }]}>Portal Parceiro</Text>
        </View>
        <View style={styles.emptyState}>
          <MaterialIcons name="business" size={48} color={tc.textMuted} />
          <Text style={[styles.emptyTitle, { color: tc.textPrimary }]}>
            Torne-se Parceiro
          </Text>
          <Text style={[styles.emptyDesc, { color: tc.textMuted }]}>
            Câmaras, museus e associações culturais podem gerir o conteúdo do seu território directamente.
          </Text>
          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: palette.terracotta[500] }]}
            onPress={() => router.push('/partner-register')}
          >
            <Text style={styles.registerBtnText}>Registar Organização</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetchPois} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={tc.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: tc.textPrimary }]}>{profile.name}</Text>
            <Text style={[styles.headerSub, { color: tc.textMuted }]}>
              {profile.concelhos.join(', ')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.draftsBtn, { borderColor: tc.borderLight }]}
            onPress={() => router.push('/content-toolkit')}
          >
            <MaterialIcons name="edit-note" size={16} color={tc.textMuted} />
            <Text style={[styles.draftsBtnText, { color: tc.textMuted }]}>Drafts</Text>
          </TouchableOpacity>
        </View>

        {/* Métricas */}
        {metrics && (
          <View style={styles.metricsRow}>
            <MetricCard
              label="POIs" value={metrics.total_pois}
              icon="place" color={palette.terracotta[500]}
            />
            <MetricCard
              label="Com imagem" value={metrics.image_coverage_pct} unit="%"
              icon="image" color="#3B82F6"
            />
            <MetricCard
              label="Com narrativa" value={metrics.narrative_coverage_pct} unit="%"
              icon="auto-stories" color="#22C55E"
            />
            <MetricCard
              label="Drafts" value={metrics.drafts_pending}
              icon="pending" color="#F59E0B"
            />
          </View>
        )}

        {/* Filtros de tier */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tierFilters}
        >
          {[undefined, 'critical', 'stale', 'attention', 'healthy'].map((t) => (
            <TouchableOpacity
              key={t || 'all'}
              style={[
                styles.tierFilter,
                { borderColor: t ? TIER_COLORS[t] : tc.borderLight },
                activeTier === t && { backgroundColor: t ? TIER_COLORS[t] : tc.surface },
              ]}
              onPress={() => setActiveTier(t)}
            >
              <Text style={[styles.tierFilterText, {
                color: activeTier === t && t ? '#fff' : t ? TIER_COLORS[t] : tc.textMuted,
              }]}>
                {t ? TIER_LABELS[t] : 'Todos'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista de POIs */}
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: tc.textPrimary }]}>Os vossos POIs</Text>
          {poisData && (
            <Text style={[styles.listCount, { color: tc.textMuted }]}>{poisData.total}</Text>
          )}
        </View>

        {loadingPois ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : poisData?.items.map((poi) => (
          <View key={poi.poi_id} style={[styles.poiCard, { backgroundColor: tc.surface }]}>
            {/* Score */}
            <View style={[styles.scoreDot, { borderColor: TIER_COLORS[poi.tier] }]}>
              <Text style={[styles.scoreDotText, { color: TIER_COLORS[poi.tier] }]}>{poi.score}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.poiName, { color: tc.textPrimary }]} numberOfLines={1}>
                {poi.name}
              </Text>
              <Text style={[styles.poiMeta, { color: tc.textMuted }]}>
                {poi.category} · {poi.concelho}
              </Text>
              {/* Indicadores rápidos */}
              <View style={styles.poiIndicators}>
                <View style={[styles.indicator, poi.has_image ? styles.indOk : styles.indMissing]}>
                  <MaterialIcons name="image" size={10} color={poi.has_image ? '#22C55E' : '#EF4444'} />
                  <Text style={[styles.indText, { color: poi.has_image ? '#22C55E' : '#EF4444' }]}>
                    {poi.has_image ? 'Imagem' : 'Sem imagem'}
                  </Text>
                </View>
                <View style={[styles.indicator, poi.has_narrative ? styles.indOk : styles.indMissing]}>
                  <MaterialIcons name="auto-stories" size={10} color={poi.has_narrative ? '#22C55E' : '#EF4444'} />
                  <Text style={[styles.indText, { color: poi.has_narrative ? '#22C55E' : '#EF4444' }]}>
                    {poi.has_narrative ? 'Narrativa' : 'Sem narrativa'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Acção */}
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: palette.terracotta[500] }]}
              onPress={() => setSelectedPoi(poi)}
            >
              <MaterialIcons name="edit" size={14} color={palette.terracotta[500]} />
              <Text style={[styles.editBtnText, { color: palette.terracotta[500] }]}>Actualizar</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Modal de draft */}
      {selectedPoi && (
        <DraftModal
          poi={selectedPoi}
          onClose={() => setSelectedPoi(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['partner-pois'] })}
          token={token}
        />
      )}
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', fontFamily: serif },
  headerSub: { fontSize: 11, marginTop: 1 },
  draftsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  draftsBtnText: { fontSize: 11 },

  metricsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16,
  },

  tierFilters: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  tierFilter: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5,
  },
  tierFilterText: { fontSize: 12, fontWeight: '600' },

  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  listTitle: { fontSize: 16, fontWeight: '700' },
  listCount: { fontSize: 12 },

  poiCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12,
    gap: 10, ...shadows.sm,
  },
  scoreDot: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreDotText: { fontSize: 13, fontWeight: '800' },
  poiName: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  poiMeta: { fontSize: 11, marginBottom: 4 },
  poiIndicators: { flexDirection: 'row', gap: 6 },
  indicator: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  indOk: { backgroundColor: 'rgba(34,197,94,0.1)' },
  indMissing: { backgroundColor: 'rgba(239,68,68,0.1)' },
  indText: { fontSize: 9, fontWeight: '600' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5,
  },
  editBtnText: { fontSize: 11, fontWeight: '600' },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', fontFamily: serif, textAlign: 'center' },
  emptyDesc: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  registerBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  registerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
