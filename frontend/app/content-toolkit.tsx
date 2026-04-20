/**
 * Content Toolkit — AI-assisted content creation for cultural agents.
 * Flow: Rascunho humano → Enriquecimento IA → Revisão → Publicação
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { API_BASE } from '../src/config/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type DepthLevel = 'snackable' | 'historia' | 'enciclopedico' | 'micro_story';
type WorkflowStep = 'draft' | 'enrich' | 'review' | 'publish';

interface ReviewResult {
  total_score: number;
  max_score: number;
  grade: 'A' | 'B' | 'C';
  warnings: string[];
  ready_to_publish: boolean;
  word_count: number;
}

const DEPTH_OPTIONS: { id: DepthLevel; label: string; icon: string; hint: string }[] = [
  { id: 'snackable', label: 'Snackable', icon: '⚡', hint: '80-120 palavras — cards e redes sociais' },
  { id: 'historia', label: 'História', icon: '📖', hint: '300-500 palavras — página de detalhe' },
  { id: 'enciclopedico', label: 'Enciclopédico', icon: '🎓', hint: '800-1200 palavras — Enciclopédia Viva' },
  { id: 'micro_story', label: 'Micro-história', icon: '✨', hint: '40-60 palavras — card de descoberta' },
];

const GRADE_COLORS: Record<string, string> = {
  A: '#2E7D32',
  B: '#E65100',
  C: '#C62828',
};

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiPost(path: string, body: object, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erro ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Step indicators ─────────────────────────────────────────────────────────
const STEPS: { id: WorkflowStep; label: string }[] = [
  { id: 'draft', label: 'Rascunho' },
  { id: 'enrich', label: 'IA' },
  { id: 'review', label: 'Revisão' },
  { id: 'publish', label: 'Publicar' },
];

function StepBar({ current }: { current: WorkflowStep }) {
  const { colors } = useTheme();
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <View style={stepStyles.bar}>
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const color = done || active ? (colors.primary || '#4A6741') : (colors.textSecondary || '#aaa');
        return (
          <React.Fragment key={step.id}>
            <View style={stepStyles.stepItem}>
              <View style={[stepStyles.dot, { backgroundColor: color }]}>
                {done ? (
                  <MaterialIcons name="check" size={12} color="#fff" />
                ) : (
                  <Text style={stepStyles.dotNum}>{idx + 1}</Text>
                )}
              </View>
              <Text style={[stepStyles.label, { color }]}>{step.label}</Text>
            </View>
            {idx < STEPS.length - 1 && (
              <View style={[stepStyles.line, { backgroundColor: done ? color : (colors.border || '#ddd') }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  stepItem: { alignItems: 'center', gap: 4 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  label: { fontSize: 10, fontWeight: '600' },
  line: { flex: 1, height: 2, marginHorizontal: 4, marginBottom: 14 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ContentToolkitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { sessionToken } = useAuth();

  const [step, setStep] = useState<WorkflowStep>('draft');
  const [draftId, setDraftId] = useState<string | null>(null);

  // Draft form
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [depth, setDepth] = useState<DepthLevel>('historia');
  const [targetType, setTargetType] = useState<'poi' | 'event' | 'local_story'>('poi');
  const [notes, setNotes] = useState('');

  // Enrich result
  const [enrichedBody, setEnrichedBody] = useState('');
  const [originalBody, setOriginalBody] = useState('');
  const [preserveVoice, setPreserveVoice] = useState(true);
  const [showComparison, setShowComparison] = useState(false);

  // Review result
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accentColor = colors.primary || '#4A6741';
  const token = sessionToken || '';

  // ── Step 1: Create draft ────────────────────────────────────────────────
  const handleCreateDraft = useCallback(async () => {
    if (!title.trim() || !body.trim()) {
      setError('Título e texto são obrigatórios.');
      return;
    }
    if (!token) {
      setError('Precisas de sessão iniciada para usar o toolkit.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost('/toolkit/draft', {
        target_type: targetType,
        target_depth: depth,
        title: title.trim(),
        body: body.trim(),
        notes_for_editor: notes.trim() || undefined,
      }, token);
      setDraftId(res.draft_id);
      setOriginalBody(body.trim());
      setStep('enrich');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [title, body, depth, targetType, notes, token]);

  // ── Step 2: Enrich ──────────────────────────────────────────────────────
  const handleEnrich = useCallback(async () => {
    if (!draftId || !token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost(`/toolkit/enrich/${draftId}`, {
        preserve_author_voice: preserveVoice,
      }, token);
      setEnrichedBody(res.body_enriched);
      setStep('review');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [draftId, preserveVoice, token]);

  // ── Step 3: Review ──────────────────────────────────────────────────────
  const handleReview = useCallback(async () => {
    if (!draftId || !token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost(`/toolkit/review/${draftId}`, {}, token);
      setReviewResult(res.review);
      setStep('publish');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [draftId, token]);

  // ── Step 4: Publish ─────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!draftId || !token) return;
    setError(null);
    setLoading(true);
    try {
      await apiPost(`/toolkit/publish/${draftId}`, {
        field_to_update: 'description',
        notify_review: true,
      }, token);
      Alert.alert(
        'Publicado!',
        'O teu conteúdo foi publicado com sucesso e sinalizado para revisão editorial.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [draftId, token, router]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Voltar">
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Toolkit de Conteúdo</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Para agentes culturais</Text>
        </View>
        <MaterialIcons name="auto-awesome" size={24} color={accentColor} />
      </View>

      {/* Step indicator */}
      <StepBar current={step} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error banner */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: '#FFEBEE' }]}>
            <MaterialIcons name="error-outline" size={18} color="#C62828" />
            <Text style={[styles.errorText, { color: '#C62828' }]}>{error}</Text>
          </View>
        )}

        {/* ── STEP 1: Draft ── */}
        {step === 'draft' && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              ✍️ O teu rascunho
            </Text>
            <Text style={[styles.stepHint, { color: colors.textSecondary }]}>
              Escreve livremente — a IA vai ajudar depois. Mantém os detalhes locais e a tua voz.
            </Text>

            {/* Target type */}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Tipo de conteúdo</Text>
            <View style={styles.chipRow}>
              {(['poi', 'event', 'local_story'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTargetType(t)}
                  style={[
                    styles.chip,
                    { backgroundColor: targetType === t ? accentColor : (colors.surface) },
                    targetType !== t && { borderWidth: 1, borderColor: colors.border || '#ddd' },
                  ]}
                >
                  <Text style={{ color: targetType === t ? '#fff' : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                    {t === 'poi' ? 'Local / POI' : t === 'event' ? 'Evento' : 'História Local'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Depth */}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Profundidade</Text>
            {DEPTH_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => setDepth(opt.id)}
                style={[
                  styles.depthOption,
                  { backgroundColor: colors.surface },
                  depth === opt.id && { borderColor: accentColor, borderWidth: 2 },
                ]}
              >
                <Text style={styles.depthIcon}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.depthLabel, { color: colors.text }]}>{opt.label}</Text>
                  <Text style={[styles.depthHint, { color: colors.textSecondary }]}>{opt.hint}</Text>
                </View>
                {depth === opt.id && <MaterialIcons name="check-circle" size={20} color={accentColor} />}
              </TouchableOpacity>
            ))}

            {/* Title */}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Título *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border || '#ddd' }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Nome do local ou evento…"
              placeholderTextColor={colors.textSecondary}
              maxLength={200}
            />

            {/* Body */}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Rascunho *</Text>
            <TextInput
              style={[styles.textarea, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border || '#ddd' }]}
              value={body}
              onChangeText={setBody}
              placeholder="Conta a tua história. Usa detalhes locais, datas, cheiros, sons — tudo conta."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={8}
              maxLength={8000}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>{body.length} / 8000</Text>

            {/* Notes */}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Nota para a IA (opcional)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border || '#ddd' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: «Este local é pouco conhecido — não generalizes»"
              placeholderTextColor={colors.textSecondary}
              maxLength={500}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: accentColor, opacity: loading ? 0.7 : 1 }]}
              onPress={handleCreateDraft}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Text style={styles.primaryBtnText}>Guardar rascunho</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Enrich ── */}
        {step === 'enrich' && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              🤖 Enriquecimento com IA
            </Text>
            <Text style={[styles.stepHint, { color: colors.textSecondary }]}>
              A IA vai melhorar a estrutura, clareza e contexto cultural — mantendo a tua voz.
            </Text>

            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>O teu rascunho</Text>
              <Text style={[styles.infoCardBody, { color: colors.textSecondary }]} numberOfLines={6}>
                {originalBody}
              </Text>
            </View>

            <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Preservar a minha voz</Text>
                <Text style={[styles.switchHint, { color: colors.textSecondary }]}>
                  A IA só corrige estrutura e factos, não o estilo.
                </Text>
              </View>
              <Switch
                value={preserveVoice}
                onValueChange={setPreserveVoice}
                trackColor={{ true: accentColor }}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: accentColor, opacity: loading ? 0.7 : 1 }]}
              onPress={handleEnrich}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryBtnText}>A enriquecer…</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="auto-awesome" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Enriquecer com IA</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: Review ── */}
        {step === 'review' && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              🔍 Revisão de qualidade
            </Text>

            {/* Show both versions */}
            <TouchableOpacity
              style={[styles.compareToggle, { borderColor: accentColor }]}
              onPress={() => setShowComparison(!showComparison)}
            >
              <MaterialIcons name={showComparison ? 'visibility-off' : 'compare'} size={16} color={accentColor} />
              <Text style={[styles.compareToggleText, { color: accentColor }]}>
                {showComparison ? 'Ocultar comparação' : 'Comparar com original'}
              </Text>
            </TouchableOpacity>

            {showComparison && (
              <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.infoCardTitle, { color: colors.textSecondary }]}>Original</Text>
                <Text style={[styles.infoCardBody, { color: colors.textSecondary }]} numberOfLines={5}>
                  {originalBody}
                </Text>
              </View>
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.infoCardTitle, { color: colors.text }]}>Versão enriquecida</Text>
              <Text style={[styles.infoCardBody, { color: colors.text }]}>
                {enrichedBody}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: accentColor, opacity: loading ? 0.7 : 1 }]}
              onPress={handleReview}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <MaterialIcons name="fact-check" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Analisar qualidade</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 4: Publish ── */}
        {step === 'publish' && reviewResult && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              📊 Resultado da revisão
            </Text>

            {/* Score card */}
            <View style={[styles.scoreCard, { backgroundColor: colors.surface }]}>
              <View style={styles.scoreHeader}>
                <Text style={[styles.scoreGrade, { color: GRADE_COLORS[reviewResult.grade] }]}>
                  {reviewResult.grade}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scoreValue, { color: colors.text }]}>
                    {reviewResult.total_score} / {reviewResult.max_score} pontos
                  </Text>
                  <Text style={[styles.scoreWords, { color: colors.textSecondary }]}>
                    {reviewResult.word_count} palavras
                  </Text>
                </View>
                {reviewResult.ready_to_publish ? (
                  <MaterialIcons name="check-circle" size={28} color="#2E7D32" />
                ) : (
                  <MaterialIcons name="warning" size={28} color="#E65100" />
                )}
              </View>

              {reviewResult.warnings.length > 0 && (
                <View style={styles.warningsList}>
                  {reviewResult.warnings.map((w, i) => (
                    <View key={i} style={styles.warningRow}>
                      <MaterialIcons name="info-outline" size={14} color="#E65100" />
                      <Text style={[styles.warningText, { color: colors.textSecondary }]}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {reviewResult.ready_to_publish ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#2E7D32', opacity: loading ? 0.7 : 1 }]}
                onPress={handlePublish}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <MaterialIcons name="publish" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Publicar conteúdo</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.notReadyBlock}>
                <Text style={[styles.notReadyText, { color: colors.textSecondary }]}>
                  Corrige os avisos acima antes de publicar para garantir melhor qualidade.
                </Text>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: accentColor }]}
                  onPress={() => setStep('draft')}
                >
                  <Text style={[styles.secondaryBtnText, { color: accentColor }]}>
                    Editar rascunho
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#E65100', opacity: loading ? 0.7 : 1 }]}
                  onPress={handlePublish}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.primaryBtnText}>Publicar mesmo assim</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  scrollContent: { padding: 16 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, flex: 1 },
  stepContent: { gap: 14 },
  stepTitle: { fontSize: 20, fontWeight: '700' },
  stepHint: { fontSize: 14, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  depthOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  depthIcon: { fontSize: 20 },
  depthLabel: { fontSize: 14, fontWeight: '600' },
  depthHint: { fontSize: 12, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 140,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: -10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  infoCard: { borderRadius: 12, padding: 14, gap: 8 },
  infoCardTitle: { fontSize: 13, fontWeight: '700' },
  infoCardBody: { fontSize: 14, lineHeight: 20 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  switchHint: { fontSize: 12, marginTop: 2 },
  compareToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  compareToggleText: { fontSize: 13, fontWeight: '600' },
  scoreCard: { borderRadius: 12, padding: 16, gap: 12 },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreGrade: { fontSize: 42, fontWeight: '800', width: 52 },
  scoreValue: { fontSize: 16, fontWeight: '700' },
  scoreWords: { fontSize: 12, marginTop: 2 },
  warningsList: { gap: 8, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)' },
  warningRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  warningText: { fontSize: 13, flex: 1, lineHeight: 18 },
  notReadyBlock: { gap: 10 },
  notReadyText: { fontSize: 14, lineHeight: 20 },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700' },
});
