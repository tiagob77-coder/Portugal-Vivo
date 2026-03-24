/**
 * Importar — Upload de Excel/CSV com drag-and-drop (web) ou file picker (mobile)
 * Suporta dry_run para validar sem gravar.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/services/api';
import { colors, shadows } from '../../src/theme';

const ACCENT = '#2E5E4E';

interface ImportResult {
  total_rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  error_details: { row: number; reason: string }[];
  dry_run: boolean;
  municipality_id?: string;
  duration_seconds: number;
}

export default function ImportarScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const fileRef  = useRef<any>(null);

  const [file, setFile]           = useState<File | null>(null);
  const [dryRun, setDryRun]       = useState(true);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<ImportResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [dragging, setDragging]   = useState(false);

  // ── Drag & Drop (web) ────────────────────────────────────────────────────────
  const onDrop = (e: any) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const acceptFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError('Formato inválido. Use .xlsx, .xls ou .csv');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  };

  // ── Import ────────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('dry_run', String(dryRun));

      const resp = await api.post('/admin/import/excel', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(resp.data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Erro desconhecido';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  // ── Score de cor ──────────────────────────────────────────────────────────────
  const healthColor = (score: number) =>
    score >= 75 ? '#22C55E' : score >= 50 ? '#EAB308' : score >= 25 ? '#F97316' : '#EF4444';

  return (
    <View style={[s.container, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        {Platform.OS !== 'web' && (
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#1E293B" />
          </TouchableOpacity>
        )}
        <View>
          <Text style={s.pageTitle}>Importar POIs</Text>
          <Text style={s.pageSubtitle}>Excel (.xlsx) ou CSV</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Template info */}
        <View style={s.infoCard}>
          <MaterialIcons name="info-outline" size={18} color="#3B82F6" />
          <Text style={s.infoText}>
            Colunas obrigatórias: <Text style={s.bold}>nome, categoria, latitude, longitude</Text>
            {'\n'}Opcionais: descrição, município, morada, website, tags, horário, imagem
          </Text>
        </View>

        {/* Drop zone (web) / File picker button */}
        {Platform.OS === 'web' ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? ACCENT : '#CBD5E1'}`,
              borderRadius: 14,
              padding: 40,
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              backgroundColor: dragging ? '#F0FDF4' : '#F8FAFC',
              transition: 'all 0.15s',
              marginBottom: 20,
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
            />
            <MaterialIcons name="cloud-upload" size={40} color={file ? ACCENT : '#94A3B8'} />
            {file ? (
              <>
                <Text style={s.dropFileName}>{file.name}</Text>
                <Text style={s.dropSub}>{(file.size / 1024).toFixed(0)} KB · clica para mudar</Text>
              </>
            ) : (
              <>
                <Text style={s.dropTitle}>Arrasta o ficheiro aqui</Text>
                <Text style={s.dropSub}>ou clica para seleccionar</Text>
              </>
            )}
          </div>
        ) : (
          <TouchableOpacity
            style={[s.pickBtn, file && s.pickBtnActive]}
            onPress={() => setError('Upload de ficheiro disponível na versão web')}
          >
            <MaterialIcons name="attach-file" size={22} color={file ? ACCENT : '#64748B'} />
            <Text style={[s.pickBtnText, file && { color: ACCENT }]}>
              {file ? file.name : 'Seleccionar ficheiro Excel'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Options */}
        <View style={s.optionsCard}>
          <View style={s.optionRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>Modo de teste (dry run)</Text>
              <Text style={s.optionDesc}>Valida sem gravar na base de dados</Text>
            </View>
            <Switch
              value={dryRun}
              onValueChange={setDryRun}
              trackColor={{ true: ACCENT, false: '#CBD5E1' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={s.errorCard}>
            <MaterialIcons name="error-outline" size={18} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Import button */}
        <TouchableOpacity
          style={[s.importBtn, (!file || loading) && s.importBtnDisabled]}
          onPress={handleImport}
          disabled={!file || loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <MaterialIcons name={dryRun ? 'search' : 'cloud-upload'} size={20} color="#fff" />
          }
          <Text style={s.importBtnText}>
            {loading ? 'A processar...' : dryRun ? 'Validar (sem gravar)' : 'Importar para a BD'}
          </Text>
        </TouchableOpacity>

        {/* Results */}
        {result && (
          <View style={s.resultsCard}>
            <View style={s.resultsHeader}>
              <MaterialIcons
                name={result.errors === 0 ? 'check-circle' : 'warning'}
                size={22}
                color={result.errors === 0 ? '#22C55E' : '#F97316'}
              />
              <Text style={s.resultsTitle}>
                {result.dry_run ? 'Resultado da validação' : 'Importação concluída'}
              </Text>
              <Text style={s.resultsDuration}>{result.duration_seconds}s</Text>
            </View>

            <View style={s.statsGrid}>
              {[
                { label: 'Total', value: result.total_rows, color: '#3B82F6' },
                { label: result.dry_run ? 'Válidos' : 'Criados', value: result.created, color: '#22C55E' },
                { label: 'Actualizados', value: result.updated, color: '#8B5CF6' },
                { label: 'Erros', value: result.errors, color: '#EF4444' },
              ].map(s => (
                <View key={s.label} style={st.statCell}>
                  <Text style={[st.statNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={st.statLbl}>{s.label}</Text>
                </View>
              ))}
            </View>

            {result.error_details.length > 0 && (
              <View style={s.errorsSection}>
                <Text style={s.errorsSectionTitle}>Erros de validação</Text>
                {result.error_details.slice(0, 20).map((e, i) => (
                  <View key={i} style={s.errorRow}>
                    <Text style={s.errorRowLine}>Linha {e.row}</Text>
                    <Text style={s.errorRowReason} numberOfLines={2}>{e.reason}</Text>
                  </View>
                ))}
                {result.error_details.length > 20 && (
                  <Text style={s.moreErrors}>+ {result.error_details.length - 20} erros adicionais</Text>
                )}
              </View>
            )}

            {result.dry_run && result.errors === 0 && (
              <TouchableOpacity
                style={s.confirmImportBtn}
                onPress={() => { setDryRun(false); handleImport(); }}
              >
                <MaterialIcons name="cloud-upload" size={18} color="#fff" />
                <Text style={s.confirmImportText}>Confirmar e Importar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Template download hint */}
        <View style={s.templateHint}>
          <MaterialIcons name="download" size={16} color="#64748B" />
          <Text style={s.templateHintText}>
            Não tens template? Usa{' '}
            <Text
              style={{ color: ACCENT, fontWeight: '600' }}
              onPress={() => Platform.OS === 'web' && window.open('/api/admin/import/template', '_blank')}
            >
              GET /admin/import/template
            </Text>
            {' '}para ver os campos e exemplos.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 24, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  pageSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  content: { padding: 24, paddingBottom: 60 },

  infoCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
  bold: { fontWeight: '700' },

  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 2, borderColor: '#CBD5E1', borderStyle: 'dashed',
    borderRadius: 12, padding: 20, marginBottom: 20, backgroundColor: '#F8FAFC',
  },
  pickBtnActive: { borderColor: ACCENT, backgroundColor: '#F0FDF4' },
  pickBtnText: { fontSize: 14, color: '#64748B', fontWeight: '600' },

  dropTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' } as any,
  dropSub: { fontSize: 12, color: '#94A3B8' } as any,
  dropFileName: { fontSize: 14, fontWeight: '700', color: ACCENT } as any,

  optionsCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 20, ...shadows.sm,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  optionDesc: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  errorCard: {
    flexDirection: 'row', gap: 8, backgroundColor: '#FEF2F2',
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626' },

  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 15,
    marginBottom: 24,
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  resultsCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20,
    marginBottom: 24, ...shadows.md,
  },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  resultsTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  resultsDuration: { fontSize: 11, color: '#94A3B8' },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  errorsSection: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  errorsSectionTitle: { fontSize: 13, fontWeight: '700', color: '#EF4444', marginBottom: 8 },
  errorRow: { flexDirection: 'row', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  errorRowLine: { fontSize: 11, fontWeight: '700', color: '#64748B', width: 50 },
  errorRowReason: { flex: 1, fontSize: 11, color: '#DC2626' },
  moreErrors: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
  confirmImportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 12, marginTop: 16,
  },
  confirmImportText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  templateHint: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 8 },
  templateHintText: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 18 },
});

const st = StyleSheet.create({
  statCell: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 10, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
});
