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
import Constants from 'expo-constants';
import { colors, typography, spacing, borders, shadows } from '../src/theme';

const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL
  || process.env.EXPO_PUBLIC_BACKEND_URL
  || '';

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
  if (score >= 70) return '#22C55E';
  if (score >= 50) return '#C49A6C';
  if (score >= 30) return '#F97316';
  return '#EF4444';
};

// ============================================
// Main Component
// ============================================
export default function ImporterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);

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
      // Web file picker
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
      // Native - would use expo-document-picker
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
          <MaterialIcons name="arrow-back" size={24} color={colors.forest[500]} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Importador</Text>
          <Text style={styles.headerSubtitle}>Excel & IQ Batch</Text>
        </View>
        <TouchableOpacity onPress={() => refetchStats()} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={22} color={colors.gray[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Stats Overview */}
        {statsLoading ? (
          <ActivityIndicator size="large" color={colors.terracotta[500]} style={{ marginTop: 40 }} />
        ) : stats ? (
          <>
            {/* Main Stats Cards */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardPrimary]}>
                <MaterialIcons name="place" size={28} color="#FFFFFF" />
                <Text style={styles.statNumberWhite}>{stats.total_pois}</Text>
                <Text style={styles.statLabelWhite}>Total POIs</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialIcons name="cloud-upload" size={24} color={colors.ocean[500]} />
                <Text style={styles.statNumber}>{stats.imported_from_excel}</Text>
                <Text style={styles.statLabel}>Importados</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                <Text style={styles.statNumber}>{stats.iq_processed}</Text>
                <Text style={styles.statLabel}>IQ Processados</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialIcons name="pending" size={24} color="#C49A6C" />
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
                <View style={[styles.actionIconBg, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialIcons name="upload-file" size={28} color={colors.ocean[500]} />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Importar Excel/CSV</Text>
                  <Text style={styles.actionDesc}>Upload de ficheiro com POIs para importar</Text>
                </View>
                {uploadMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.ocean[500]} />
                ) : (
                  <MaterialIcons name="chevron-right" size={24} color={colors.gray[400]} />
                )}
              </TouchableOpacity>

              {/* Batch Process 50 */}
              <TouchableOpacity
                style={[styles.actionCard, pending === 0 && styles.actionCardDisabled]}
                onPress={() => handleBatchProcess(50)}
                disabled={batchMutation.isPending || pollingActive || pending === 0}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialIcons name="bolt" size={28} color="#C49A6C" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Processar 50 POIs</Text>
                  <Text style={styles.actionDesc}>Executar IQ Engine em 50 POIs pendentes</Text>
                </View>
                {(batchMutation.isPending || pollingActive) ? (
                  <ActivityIndicator size="small" color="#C49A6C" />
                ) : (
                  <MaterialIcons name="play-arrow" size={24} color={pending > 0 ? '#C49A6C' : colors.gray[300]} />
                )}
              </TouchableOpacity>

              {/* Batch Process 200 */}
              <TouchableOpacity
                style={[styles.actionCard, pending === 0 && styles.actionCardDisabled]}
                onPress={() => handleBatchProcess(200)}
                disabled={batchMutation.isPending || pollingActive || pending === 0}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBg, { backgroundColor: '#FEE2E2' }]}>
                  <MaterialIcons name="local-fire-department" size={28} color="#EF4444" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Processar 200 POIs</Text>
                  <Text style={styles.actionDesc}>Processamento intensivo de 200 POIs</Text>
                </View>
                {(batchMutation.isPending || pollingActive) ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <MaterialIcons name="play-arrow" size={24} color={pending > 0 ? '#EF4444' : colors.gray[300]} />
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
                    color={progress.status === 'completed' ? '#22C55E' : colors.terracotta[500]}
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
                    <Text style={[styles.batchStatNum, { color: colors.terracotta[500] }]}>
                      {progress.percentage.toFixed(0)}%
                    </Text>
                    <Text style={styles.batchStatLabel}>Progresso</Text>
                  </View>
                </View>
                <View style={styles.batchBar}>
                  <View style={[styles.batchBarFill, {
                    width: `${progress.percentage}%`,
                    backgroundColor: progress.status === 'completed' ? '#22C55E' : colors.terracotta[500],
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  backButton: { padding: spacing[2], marginRight: spacing[2] },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: typography.fontSize.xl, fontWeight: '700' as const, color: colors.forest[500] },
  headerSubtitle: { fontSize: typography.fontSize.sm, color: colors.gray[500], marginTop: 1 },
  refreshButton: { padding: spacing[2] },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing[4] },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  statCard: {
    flex: 1, backgroundColor: colors.background.secondary,
    borderRadius: borders.radius.xl, padding: spacing[4],
    alignItems: 'center', gap: spacing[2], ...shadows.sm,
  },
  statCardPrimary: { backgroundColor: colors.terracotta[500] },
  statNumber: { fontSize: 24, fontWeight: '700' as const, color: colors.gray[800] },
  statNumberWhite: { fontSize: 24, fontWeight: '700' as const, color: '#FFFFFF' },
  statLabel: { fontSize: typography.fontSize.xs, color: colors.gray[500], fontWeight: '500' as const },
  statLabelWhite: { fontSize: typography.fontSize.xs, color: '#FFFFFFCC', fontWeight: '500' as const },

  // Progress Section
  progressSection: {
    backgroundColor: colors.background.secondary, borderRadius: borders.radius.xl,
    padding: spacing[4], marginBottom: spacing[5], ...shadows.sm,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  progressTitle: { fontSize: typography.fontSize.sm, fontWeight: '600' as const, color: colors.gray[700] },
  progressPct: { fontSize: typography.fontSize.sm, fontWeight: '700' as const, color: colors.terracotta[500] },
  progressBar: { height: 8, backgroundColor: colors.gray[100], borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.terracotta[500], borderRadius: 4 },
  avgScoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[2] },
  avgScoreText: { fontSize: typography.fontSize.sm, color: colors.gray[600] },

  // Section
  section: { marginBottom: spacing[5] },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: '700' as const, color: colors.gray[800], marginBottom: spacing[3] },

  // Action Cards
  actionCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.secondary,
    padding: spacing[4], borderRadius: borders.radius.xl, marginBottom: spacing[2],
    gap: spacing[3], ...shadows.sm,
  },
  actionCardDisabled: { opacity: 0.5 },
  actionIconBg: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: typography.fontSize.base, fontWeight: '600' as const, color: colors.gray[800] },
  actionDesc: { fontSize: typography.fontSize.xs, color: colors.gray[500], marginTop: 2 },

  // Batch Progress
  batchProgressCard: {
    backgroundColor: '#FFFBF5', borderRadius: borders.radius.xl,
    padding: spacing[4], marginBottom: spacing[5],
    borderWidth: 1, borderColor: '#FDE8D3',
  },
  batchProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  batchProgressTitle: { fontSize: typography.fontSize.base, fontWeight: '600' as const, color: colors.gray[800] },
  batchStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing[3] },
  batchStat: { alignItems: 'center' },
  batchStatNum: { fontSize: 20, fontWeight: '700' as const, color: colors.gray[800] },
  batchStatLabel: { fontSize: typography.fontSize.xs, color: colors.gray[500] },
  batchBar: { height: 6, backgroundColor: colors.gray[100], borderRadius: 3, overflow: 'hidden' },
  batchBarFill: { height: '100%', borderRadius: 3 },

  // Categories
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: borders.radius.full, gap: 6, ...shadows.sm,
  },
  categoryCount: { fontSize: typography.fontSize.xs, fontWeight: '700' as const, color: colors.terracotta[500] },
  categoryName: { fontSize: typography.fontSize.xs, color: colors.gray[700], textTransform: 'capitalize' as const },

  // Regions
  regionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2], gap: spacing[2] },
  regionName: { width: 70, fontSize: typography.fontSize.xs, color: colors.gray[600], textTransform: 'capitalize' as const },
  regionBarContainer: { flex: 1, height: 8, backgroundColor: colors.gray[100], borderRadius: 4, overflow: 'hidden' },
  regionBar: { height: '100%', backgroundColor: colors.forest[400], borderRadius: 4 },
  regionCount: { width: 35, fontSize: typography.fontSize.xs, fontWeight: '600' as const, color: colors.gray[700], textAlign: 'right' as const },
});
