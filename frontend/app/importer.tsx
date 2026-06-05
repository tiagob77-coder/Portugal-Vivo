/**
 * Excel Importer Screen
 *
 * Interface para importar POIs de ficheiros Excel/CSV,
 * com preview, upload e processamento IQ em batch.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { typography, spacing, borders, shadows } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import { palette, withOpacity } from '../src/theme/colors';
import { API_URL as API_BASE } from '../src/config/api';

// ============================================
// API Functions
// ============================================
const getImporterStats = async () => {
  const res = await fetch(`${API_BASE}/api/importer/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
};

const batchProcessAll = async (limit: number = 100) => {
  const res = await fetch(`${API_BASE}/api/importer/batch-iq-all?limit=${limit}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to start batch');
  return res.json();
};

const getProgress = async (batchId: string) => {
  const res = await fetch(`${API_BASE}/api/importer/progress/${batchId}`);
  if (!res.ok) throw new Error('Failed to fetch progress');
  return res.json();
};

const uploadFile = async (formData: FormData) => {
  const res = await fetch(`${API_BASE}/api/importer/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

// Score color helper
const getScoreColor = (score: number): string => {
  if (score >= 70) return palette.mint[500];
  if (score >= 50) return palette.terracotta[500];
  if (score >= 30) return '#F97316';
  return '#EF4444';
};

// ============================================
// Styles factory
// ============================================
function makeStyles(C: Record<string, string>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    backButton: { padding: spacing[2], marginRight: spacing[2] },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: typography.fontSize.xl, fontWeight: '700' as const, color: C.headerTitle },
    headerSubtitle: { fontSize: typography.fontSize.sm, color: C.textMuted, marginTop: 1 },
    refreshButton: { padding: spacing[2] },
    scrollView: { flex: 1 },
    scrollContent: { padding: spacing[4] },

    statsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
    statCard: {
      flex: 1, backgroundColor: C.card,
      borderRadius: borders.radius.xl, padding: spacing[4],
      alignItems: 'center', gap: spacing[2], ...shadows.sm,
    },
    statCardPrimary: { backgroundColor: C.accent },
    statNumber: { fontSize: 24, fontWeight: '700' as const, color: C.statNumber },
    statNumberWhite: { fontSize: 24, fontWeight: '700' as const, color: palette.white },
    statLabel: { fontSize: typography.fontSize.xs, color: C.textMuted, fontWeight: '500' as const },
    statLabelWhite: { fontSize: typography.fontSize.xs, color: withOpacity(palette.white, 0.8), fontWeight: '500' as const },

    progressSection: {
      backgroundColor: C.card, borderRadius: borders.radius.xl,
      padding: spacing[4], marginBottom: spacing[5], ...shadows.sm,
    },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
    progressTitle: { fontSize: typography.fontSize.sm, fontWeight: '600' as const, color: C.progressTitle },
    progressPct: { fontSize: typography.fontSize.sm, fontWeight: '700' as const, color: C.accent },
    progressBar: { height: 8, backgroundColor: C.progressBarBg, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: C.accent, borderRadius: 4 },
    avgScoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[2] },
    avgScoreText: { fontSize: typography.fontSize.sm, color: C.avgScoreText },

    section: { marginBottom: spacing[5] },
    sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: '700' as const, color: C.sectionTitle, marginBottom: spacing[3] },

    actionCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
      padding: spacing[4], borderRadius: borders.radius.xl, marginBottom: spacing[2],
      gap: spacing[3], ...shadows.sm,
    },
    actionCardDisabled: { opacity: 0.5 },
    actionIconBg: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionInfo: { flex: 1 },
    actionTitle: { fontSize: typography.fontSize.base, fontWeight: '600' as const, color: C.actionTitle },
    actionDesc: { fontSize: typography.fontSize.xs, color: C.textMuted, marginTop: 2 },

    batchProgressCard: {
      backgroundColor: C.batchCardBg, borderRadius: borders.radius.xl,
      padding: spacing[4], marginBottom: spacing[5],
      borderWidth: 1, borderColor: C.batchCardBorder,
    },
    batchProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
    batchProgressTitle: { fontSize: typography.fontSize.base, fontWeight: '600' as const, color: C.actionTitle },
    batchStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing[3] },
    batchStat: { alignItems: 'center' },
    batchStatNum: { fontSize: 20, fontWeight: '700' as const, color: C.statNumber },
    batchStatLabel: { fontSize: typography.fontSize.xs, color: C.textMuted },
    batchBar: { height: 6, backgroundColor: C.progressBarBg, borderRadius: 3, overflow: 'hidden' },
    batchBarFill: { height: '100%', borderRadius: 3 },

    categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    categoryChip: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
      paddingHorizontal: spacing[3], paddingVertical: spacing[2],
      borderRadius: borders.radius.full, gap: 6, ...shadows.sm,
    },
    categoryCount: { fontSize: typography.fontSize.xs, fontWeight: '700' as const, color: C.accent },
    categoryName: { fontSize: typography.fontSize.xs, color: C.progressTitle, textTransform: 'capitalize' as const },

    regionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2], gap: spacing[2] },
    regionName: { width: 70, fontSize: typography.fontSize.xs, color: C.avgScoreText, textTransform: 'capitalize' as const },
    regionBarContainer: { flex: 1, height: 8, backgroundColor: C.progressBarBg, borderRadius: 4, overflow: 'hidden' },
    regionBar: { height: '100%', backgroundColor: palette.forest[400], borderRadius: 4 },
    regionCount: { width: 35, fontSize: typography.fontSize.xs, fontWeight: '600' as const, color: C.progressTitle, textAlign: 'right' as const },
  });
}

// ============================================
// Main Component
// ============================================
export default function ImporterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);

  const C = {
    bg:              colors.background,
    card:            colors.card,
    accent:          palette.terracotta[500],
    border:          colors.border,
    textMuted:       palette.gray[500],
    headerTitle:     palette.forest[500],
    statNumber:      palette.gray[800],
    progressTitle:   palette.gray[700],
    progressBarBg:   palette.gray[100],
    avgScoreText:    palette.gray[600],
    sectionTitle:    palette.gray[800],
    actionTitle:     palette.gray[800],
    batchCardBg:     palette.terracotta[50],
    batchCardBorder: palette.terracotta[100],
    ocean:           palette.ocean[500],
    success:         colors.success,
    error:           colors.error,
    warning:         colors.warning,
    info:            colors.info,
  };

  const styles = makeStyles(C);

  // Stats query
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['importer-stats'],
    queryFn: getImporterStats,
    refetchInterval: pollingActive ? 5000 : false,
  });

  // Progress query
  const { data: progress } = useQuery({
    queryKey: ['batch-progress', batchId],
    queryFn: () => batchId ? getProgress(batchId) : null,
    enabled: !!batchId && pollingActive,
    refetchInterval: 3000,
  });

  // Batch process mutation
  const batchMutation = useMutation({
    mutationFn: (limit: number) => batchProcessAll(limit),
    onSuccess: (data) => {
      setBatchId(data.batch_id);
      setPollingActive(true);
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['importer-stats'] });
      Alert.alert(
        'Importação Completa!',
        `${data.imported} POIs importados, ${data.duplicates} duplicados, ${data.errors} erros.`,
        [{ text: 'OK' }]
      );
    },
  });

  // Check if batch is completed
  React.useEffect(() => {
    if (progress?.status === 'completed') {
      setPollingActive(false);
      refetchStats();
    }
  }, [progress?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBatchProcess = (limit: number) => {
    batchMutation.mutate(limit);
  };

  const handleFileUpload = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.csv';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('tenant_id', 'default');
          formData.append('skip_duplicates', 'true');
          uploadMutation.mutate(formData);
        }
      };
      input.click();
    } else {
      Alert.alert('Upload', 'Para fazer upload no telemóvel, use a versão web ou expo-document-picker.');
    }
  };

  const pending = stats ? stats.total_pois - stats.iq_processed : 0;
  const processedPct = stats?.total_pois > 0
    ? ((stats.iq_processed / stats.total_pois) * 100).toFixed(1)
    : '0';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={C.headerTitle} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Importador</Text>
          <Text style={styles.headerSubtitle}>Excel &amp; IQ Batch</Text>
        </View>
        <TouchableOpacity onPress={() => refetchStats()} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={22} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Stats Overview */}
        {statsLoading ? (
          <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 40 }} />
        ) : stats ? (
          <>
            {/* Main Stats Cards */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardPrimary]}>
                <MaterialIcons name="place" size={28} color={palette.white} />
                <Text style={styles.statNumberWhite}>{stats.total_pois}</Text>
                <Text style={styles.statLabelWhite}>Total POIs</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialIcons name="cloud-upload" size={24} color={C.ocean} />
                <Text style={styles.statNumber}>{stats.imported_from_excel}</Text>
                <Text style={styles.statLabel}>Importados</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <MaterialIcons name="check-circle" size={24} color={C.success} />
                <Text style={styles.statNumber}>{stats.iq_processed}</Text>
                <Text style={styles.statLabel}>IQ Processados</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialIcons name="pending" size={24} color={C.accent} />
                <Text style={styles.statNumber}>{pending}</Text>
                <Text style={styles.statLabel}>Pendentes</Text>
              </View>
            </View>

            {/* IQ Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Progresso IQ Engine</Text>
                <Text style={styles.progressPct}>{processedPct}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[
                  styles.progressFill,
                  { width: `${Math.min(parseFloat(processedPct), 100)}%` }
                ]} />
              </View>
              {stats.avg_iq_score && (
                <View style={styles.avgScoreRow}>
                  <MaterialIcons name="insights" size={16} color={getScoreColor(stats.avg_iq_score)} />
                  <Text style={styles.avgScoreText}>
                    Score médio: <Text style={{ color: getScoreColor(stats.avg_iq_score), fontWeight: '700' }}>
                      {stats.avg_iq_score.toFixed(1)}/100
                    </Text>
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ações</Text>

              {/* Upload File */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={handleFileUpload}
                disabled={uploadMutation.isPending}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBg, { backgroundColor: withOpacity(palette.ocean[400], 0.12) }]}>
                  <MaterialIcons name="upload-file" size={28} color={C.ocean} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Importar Excel/CSV</Text>
                  <Text style={styles.actionDesc}>Upload de ficheiro com POIs para importar</Text>
                </View>
                {uploadMutation.isPending ? (
                  <ActivityIndicator size="small" color={C.ocean} />
                ) : (
                  <MaterialIcons name="chevron-right" size={24} color={palette.gray[400]} />
                )}
              </TouchableOpacity>

              {/* Batch Process 50 */}
              <TouchableOpacity
                style={[styles.actionCard, pending === 0 && styles.actionCardDisabled]}
                onPress={() => handleBatchProcess(50)}
                disabled={batchMutation.isPending || pollingActive || pending === 0}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBg, { backgroundColor: palette.terracotta[100] }]}>
                  <MaterialIcons name="bolt" size={28} color={C.accent} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Processar 50 POIs</Text>
                  <Text style={styles.actionDesc}>Executar IQ Engine em 50 POIs pendentes</Text>
                </View>
                {(batchMutation.isPending || pollingActive) ? (
                  <ActivityIndicator size="small" color={C.accent} />
                ) : (
                  <MaterialIcons name="play-arrow" size={24} color={pending > 0 ? C.accent : palette.gray[300]} />
                )}
              </TouchableOpacity>

              {/* Batch Process 200 */}
              <TouchableOpacity
                style={[styles.actionCard, pending === 0 && styles.actionCardDisabled]}
                onPress={() => handleBatchProcess(200)}
                disabled={batchMutation.isPending || pollingActive || pending === 0}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBg, { backgroundColor: withOpacity(C.error, 0.1) }]}>
                  <MaterialIcons name="local-fire-department" size={28} color={C.error} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Processar 200 POIs</Text>
                  <Text style={styles.actionDesc}>Processamento intensivo de 200 POIs</Text>
                </View>
                {(batchMutation.isPending || pollingActive) ? (
                  <ActivityIndicator size="small" color={C.error} />
                ) : (
                  <MaterialIcons name="play-arrow" size={24} color={pending > 0 ? C.error : palette.gray[300]} />
                )}
              </TouchableOpacity>
            </View>

            {/* Batch Progress */}
            {(pollingActive || progress) && progress && (
              <View style={styles.batchProgressCard}>
                <View style={styles.batchProgressHeader}>
                  <MaterialIcons
                    name={progress.status === 'completed' ? 'check-circle' : 'hourglass-top'}
                    size={24}
                    color={progress.status === 'completed' ? C.success : C.accent}
                  />
                  <Text style={styles.batchProgressTitle}>
                    {progress.status === 'completed' ? 'Processamento Completo!' : 'A processar...'}
                  </Text>
                </View>
                <View style={styles.batchStats}>
                  <View style={styles.batchStat}>
                    <Text style={styles.batchStatNum}>{progress.iq_processed}</Text>
                    <Text style={styles.batchStatLabel}>Processados</Text>
                  </View>
                  <View style={styles.batchStat}>
                    <Text style={styles.batchStatNum}>{progress.total}</Text>
                    <Text style={styles.batchStatLabel}>Total</Text>
                  </View>
                  <View style={styles.batchStat}>
                    <Text style={[styles.batchStatNum, { color: C.accent }]}>
                      {progress.percentage.toFixed(0)}%
                    </Text>
                    <Text style={styles.batchStatLabel}>Progresso</Text>
                  </View>
                </View>
                <View style={styles.batchBar}>
                  <View style={[styles.batchBarFill, {
                    width: `${progress.percentage}%`,
                    backgroundColor: progress.status === 'completed' ? C.success : C.accent,
                  }]} />
                </View>
              </View>
            )}

            {/* Category Breakdown */}
            {stats.categories && Object.keys(stats.categories).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Categorias</Text>
                <View style={styles.categoriesGrid}>
                  {Object.entries(stats.categories).slice(0, 12).map(([cat, count]: [string, any]) => (
                    <View key={cat} style={styles.categoryChip}>
                      <Text style={styles.categoryCount}>{count}</Text>
                      <Text style={styles.categoryName} numberOfLines={1}>{cat}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Region Breakdown */}
            {stats.regions && Object.keys(stats.regions).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Regiões</Text>
                {Object.entries(stats.regions).map(([region, count]: [string, any]) => {
                  const pct = stats.total_pois > 0 ? ((count as number) / stats.total_pois) * 100 : 0;
                  return (
                    <View key={region} style={styles.regionRow}>
                      <Text style={styles.regionName}>{region}</Text>
                      <View style={styles.regionBarContainer}>
                        <View style={[styles.regionBar, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.regionCount}>{count as number}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
