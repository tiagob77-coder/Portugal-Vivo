/**
 * IQ Engine Dashboard
 * 
 * Painel de controlo do motor IQ para visualização de scores,
 * processamento de POIs e gestão da qualidade dos dados.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getIQHealth,
  processPoiIQ,
  IQProcessResult,
  IQModuleResult,
} from '../src/services/api';
import { colors, typography, spacing, borders, shadows } from '../src/theme';

const { width } = Dimensions.get('window');
const TENANT_ID = 'braga'; // Default tenant for demo

// Module display names and icons
const MODULE_INFO: Record<string, { name: string; icon: string; color: string; category: string }> = {
  semantic_validation: { name: 'Validação Semântica', icon: 'spellcheck', color: '#3B82F6', category: 'Validação' },
  cognitive_inference: { name: 'Inferência Cognitiva', icon: 'psychology', color: '#8B5CF6', category: 'Validação' },
  image_quality: { name: 'Qualidade de Imagem', icon: 'image-search', color: '#EC4899', category: 'Validação' },
  slug_generator: { name: 'Gerador de Slug', icon: 'link', color: '#14B8A6', category: 'Normalização' },
  address_norm: { name: 'Normalização de Morada', icon: 'place', color: '#C49A6C', category: 'Normalização' },
  deduplication: { name: 'Deduplicação', icon: 'content-copy', color: '#EF4444', category: 'Normalização' },
  poi_scoring: { name: 'Score do POI', icon: 'star', color: '#22C55E', category: 'Scoring' },
  route_scoring: { name: 'Score de Rota', icon: 'route', color: '#06B6D4', category: 'Scoring' },
  data_enrichment: { name: 'Enriquecimento', icon: 'auto-fix-high', color: '#E67A4A', category: 'Enriquecimento' },
  description_gen: { name: 'Geração de Texto', icon: 'auto-stories', color: '#A855F7', category: 'Enriquecimento' },
  thematic_routing: { name: 'Afinidade Temática', icon: 'palette', color: '#D946EF', category: 'Rotas' },
  time_routing: { name: 'Estimativa Temporal', icon: 'schedule', color: '#0EA5E9', category: 'Rotas' },
  difficulty_routing: { name: 'Dificuldade', icon: 'terrain', color: '#84CC16', category: 'Rotas' },
  profile_routing: { name: 'Perfil Visitante', icon: 'groups', color: '#F472B6', category: 'Rotas' },
  weather_routing: { name: 'Meteorologia', icon: 'wb-sunny', color: '#FBBF24', category: 'Rotas' },
  time_of_day_routing: { name: 'Hora do Dia', icon: 'nightlight', color: '#6366F1', category: 'Rotas' },
  multi_day_routing: { name: 'Multi-dia', icon: 'date-range', color: '#10B981', category: 'Rotas' },
  route_optimizer: { name: 'Conectividade', icon: 'hub', color: '#F97316', category: 'Rotas' },
};

// Score color helper
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#84CC16';
  if (score >= 40) return '#C49A6C';
  if (score >= 20) return '#F97316';
  return '#EF4444';
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bom';
  if (score >= 40) return 'Médio';
  if (score >= 20) return 'Baixo';
  return 'Crítico';
};

// Circular Progress Component
function CircularScore({ score, size = 80, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const _strokeDashoffset = circumference - (score / 100) * circumference;
  const scoreColor = getScoreColor(score);

  if (Platform.OS === 'web') {
    // Web SVG approach
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: colors.gray[100],
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}>
          <View style={{
            position: 'absolute',
            top: -strokeWidth,
            left: -strokeWidth,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: scoreColor,
            borderRightColor: score > 25 ? scoreColor : 'transparent',
            borderBottomColor: score > 50 ? scoreColor : 'transparent',
            borderLeftColor: score > 75 ? scoreColor : 'transparent',
            transform: [{ rotate: '-90deg' }],
          }} />
          <Text style={{ fontSize: size * 0.28, fontWeight: '700', color: scoreColor }}>
            {Math.round(score)}
          </Text>
          <Text style={{ fontSize: size * 0.12, color: colors.gray[400], marginTop: -2 }}>
            /100
          </Text>
        </View>
      </View>
    );
  }

  // Native SVG approach would go here, using same View approach for simplicity
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: size - strokeWidth * 2,
        height: size - strokeWidth * 2,
        borderRadius: (size - strokeWidth * 2) / 2,
        borderWidth: strokeWidth,
        borderColor: `${scoreColor}30`,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: size * 0.28, fontWeight: '700', color: scoreColor }}>
          {Math.round(score)}
        </Text>
        <Text style={{ fontSize: size * 0.12, color: colors.gray[400], marginTop: -2 }}>
          /100
        </Text>
      </View>
    </View>
  );
}

// Score Bar Component
function ScoreBar({ score, height = 8 }: { score: number; height?: number }) {
  const scoreColor = getScoreColor(score);
  return (
    <View style={{ height, backgroundColor: colors.gray[100], borderRadius: height / 2, overflow: 'hidden', flex: 1 }}>
      <View style={{
        height: '100%',
        width: `${Math.min(score, 100)}%`,
        backgroundColor: scoreColor,
        borderRadius: height / 2,
      }} />
    </View>
  );
}

// Module Result Card
function ModuleResultCard({ result }: { result: IQModuleResult }) {
  const [expanded, setExpanded] = useState(false);
  const info = MODULE_INFO[result.module] || { name: result.module, icon: 'extension', color: '#6B7280', category: '?' };
  const scoreColor = getScoreColor(result.score);

  return (
    <TouchableOpacity
      style={styles.moduleCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.moduleHeader}>
        <View style={[styles.moduleIconBg, { backgroundColor: `${info.color}15` }]}>
          <MaterialIcons name={info.icon as any} size={20} color={info.color} />
        </View>
        <View style={styles.moduleInfo}>
          <Text style={styles.moduleName}>{info.name}</Text>
          <Text style={styles.moduleCategory}>{info.category} · {(result.processing_time_ms || 0).toFixed(0)}ms</Text>
        </View>
        <View style={styles.moduleScoreContainer}>
          <Text style={[styles.moduleScore, { color: scoreColor }]}>{Math.round(result.score)}</Text>
          <ScoreBar score={result.score} height={4} />
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={colors.gray[400]}
        />
      </View>

      {expanded && (
        <View style={styles.moduleDetails}>
          {/* Status */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado</Text>
            <View style={[styles.statusBadge, { backgroundColor: result.status === 'success' ? '#DCFCE7' : '#FEE2E2' }]}>
              <Text style={[styles.statusText, { color: result.status === 'success' ? '#166534' : '#991B1B' }]}>
                {result.status === 'success' ? '✓ Sucesso' : '✗ Erro'}
              </Text>
            </View>
          </View>

          {/* Key data highlights */}
          {result.data && Object.keys(result.data).length > 0 && (
            <View style={styles.dataSection}>
              <Text style={styles.dataSectionTitle}>Dados Obtidos</Text>
              {Object.entries(result.data).slice(0, 6).map(([key, value]) => {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  return null; // Skip nested objects for cleanliness
                }
                const displayValue = typeof value === 'boolean' ? (value ? 'Sim ✓' : 'Não ✗') :
                  typeof value === 'number' ? value.toFixed(1) :
                  Array.isArray(value) ? `${value.length} items` :
                  String(value || '-').substring(0, 80);
                return (
                  <View key={key} style={styles.dataRow}>
                    <Text style={styles.dataKey}>{key.replace(/_/g, ' ')}</Text>
                    <Text style={styles.dataValue} numberOfLines={2}>{displayValue}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Suggestions */}
          {result.suggestions && result.suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <Text style={styles.dataSectionTitle}>Sugestões</Text>
              {result.suggestions.map((suggestion, idx) => (
                <View key={idx} style={styles.suggestionRow}>
                  <MaterialIcons name="lightbulb-outline" size={14} color={colors.terracotta[500]} />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// Main Dashboard Component
export default function IQDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const _queryClient = useQueryClient();
  const [selectedPOI, setSelectedPOI] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<IQProcessResult | null>(null);

  // Fetch IQ Engine health
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['iq-health'],
    queryFn: getIQHealth,
    staleTime: 30000,
  });

  // Process POI mutation
  const processMutation = useMutation({
    mutationFn: (poiId: string) => processPoiIQ(poiId, TENANT_ID),
    onSuccess: (data) => {
      setProcessResult(data);
    },
  });

  // Demo POIs for Braga tenant
  const demoPOIs = [
    { id: '7671c867-53e1-4699-aa29-ecc0c5334f35', name: 'Santuário do Bom Jesus do Monte', category: 'religioso' },
    { id: 'd1ed88db-6188-4d06-bdb3-f7a6cb955991', name: 'Santuário do Bom Jesus do Monte (Dup)', category: 'religioso' },
  ];

  const handleProcessPOI = (poiId: string) => {
    setSelectedPOI(poiId);
    processMutation.mutate(poiId);
  };

  // Group modules by category
  const groupedResults = processResult?.results.reduce((acc, result) => {
    const info = MODULE_INFO[result.module];
    const category = info?.category || 'Outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(result);
    return acc;
  }, {} as Record<string, IQModuleResult[]>);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.forest[500]} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>IQ Engine</Text>
          <Text style={styles.headerSubtitle}>Motor de Inteligência</Text>
        </View>
        <View style={[styles.engineBadge, { backgroundColor: health?.status === 'healthy' ? '#DCFCE7' : '#FEF3C7' }]}>
          <View style={[styles.statusDot, { backgroundColor: health?.status === 'healthy' ? '#22C55E' : '#C49A6C' }]} />
          <Text style={[styles.engineBadgeText, { color: health?.status === 'healthy' ? '#166534' : '#92400E' }]}>
            {healthLoading ? '...' : health?.status === 'healthy' ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Engine Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="memory" size={24} color={colors.ocean[500]} />
            <Text style={styles.statNumber}>{health?.total_modules || 0}</Text>
            <Text style={styles.statLabel}>Módulos</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={24} color={colors.success} />
            <Text style={styles.statNumber}>{processResult ? processResult.modules_run.length : '-'}</Text>
            <Text style={styles.statLabel}>Executados</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="speed" size={24} color={colors.terracotta[500]} />
            <Text style={styles.statNumber}>
              {processResult ? `${processResult.processing_time_ms.toFixed(0)}` : '-'}
            </Text>
            <Text style={styles.statLabel}>ms Tempo</Text>
          </View>
        </View>

        {/* Module Grid */}
        {health?.modules_registered && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Módulos Registados</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modulesGrid}>
              {health.modules_registered.map((mod) => {
                const info = MODULE_INFO[mod] || { name: mod, icon: 'extension', color: '#6B7280', category: '?' };
                return (
                  <View key={mod} style={styles.moduleChip}>
                    <MaterialIcons name={info.icon as any} size={16} color={info.color} />
                    <Text style={styles.moduleChipText}>{info.name}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* POI Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Processar POI</Text>
          <Text style={styles.sectionSubtitle}>Selecione um POI para analisar com o IQ Engine</Text>
          
          {demoPOIs.map((poi) => (
            <TouchableOpacity
              key={poi.id}
              style={[
                styles.poiCard,
                selectedPOI === poi.id && styles.poiCardSelected,
              ]}
              onPress={() => handleProcessPOI(poi.id)}
              disabled={processMutation.isPending}
              activeOpacity={0.7}
            >
              <View style={styles.poiCardLeft}>
                <View style={[styles.categoryDot, { backgroundColor: colors.categories.patrimonio }]} />
                <View>
                  <Text style={styles.poiName} numberOfLines={1}>{poi.name}</Text>
                  <Text style={styles.poiCategory}>{poi.category} · Braga</Text>
                </View>
              </View>
              {processMutation.isPending && selectedPOI === poi.id ? (
                <ActivityIndicator size="small" color={colors.terracotta[500]} />
              ) : selectedPOI === poi.id && processResult ? (
                <View style={styles.poiScoreBadge}>
                  <Text style={[styles.poiScoreText, { color: getScoreColor(processResult.overall_score) }]}>
                    {Math.round(processResult.overall_score)}
                  </Text>
                </View>
              ) : (
                <MaterialIcons name="play-circle-outline" size={28} color={colors.terracotta[500]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Results Section */}
        {processResult && (
          <View style={styles.section}>
            {/* Overall Score */}
            <View style={styles.overallScoreCard}>
              <CircularScore score={processResult.overall_score} size={100} strokeWidth={10} />
              <View style={styles.overallScoreInfo}>
                <Text style={styles.overallScoreTitle}>Score Global</Text>
                <Text style={[styles.overallScoreLabel, { color: getScoreColor(processResult.overall_score) }]}>
                  {getScoreLabel(processResult.overall_score)}
                </Text>
                <Text style={styles.overallScorePOI}>{processResult.poi_name}</Text>
                <Text style={styles.overallScoreTime}>
                  {processResult.modules_run.length} módulos · {processResult.processing_time_ms.toFixed(0)}ms
                </Text>
              </View>
            </View>

            {/* Score Distribution */}
            <View style={styles.scoreDistribution}>
              {processResult.results.map((r) => {
                const info = MODULE_INFO[r.module] || { name: r.module, icon: 'extension', color: '#6B7280' };
                return (
                  <View key={r.module} style={styles.miniScoreItem}>
                    <View style={[styles.miniScoreDot, { backgroundColor: info.color }]} />
                    <Text style={styles.miniScoreValue}>{Math.round(r.score)}</Text>
                  </View>
                );
              })}
            </View>

            {/* Grouped Module Results */}
            {groupedResults && Object.entries(groupedResults).map(([category, results]) => (
              <View key={category} style={styles.categoryGroup}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {results.map((result) => (
                  <ModuleResultCard key={result.module} result={result} />
                ))}
              </View>
            ))}

            {/* Recommendations */}
            {processResult.recommendations && processResult.recommendations.length > 0 && (
              <View style={styles.recommendationsCard}>
                <View style={styles.recommendationsHeader}>
                  <MaterialIcons name="tips-and-updates" size={20} color={colors.terracotta[500]} />
                  <Text style={styles.recommendationsTitle}>Recomendações</Text>
                </View>
                {processResult.recommendations.map((rec, idx) => (
                  <View key={idx} style={styles.recommendationItem}>
                    <Text style={styles.recommendationNumber}>{idx + 1}</Text>
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Empty State */}
        {!processResult && !processMutation.isPending && (
          <View style={styles.emptyState}>
            <MaterialIcons name="analytics" size={48} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>Selecione um POI</Text>
            <Text style={styles.emptySubtitle}>
              Clique em &quot;Play&quot; num POI acima para ver a análise completa do IQ Engine
            </Text>
          </View>
        )}

        {/* Loading State */}
        {processMutation.isPending && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.terracotta[500]} />
            <Text style={styles.loadingText}>A processar 10 módulos...</Text>
            <Text style={styles.loadingSubtext}>Validação · Normalização · Scoring · Enriquecimento</Text>
          </View>
        )}

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
  backButton: {
    padding: spacing[2],
    marginRight: spacing[2],
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700' as const,
    color: colors.forest[500],
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginTop: 1,
  },
  engineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borders.radius.full,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  engineBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borders.radius.xl,
    padding: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
    ...shadows.sm,
  },
  statNumber: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700' as const,
    color: colors.gray[800],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    fontWeight: '500' as const,
  },

  // Sections
  section: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700' as const,
    color: colors.gray[800],
    marginBottom: spacing[1],
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginBottom: spacing[3],
  },

  // Module Grid
  modulesGrid: {
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  moduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borders.radius.full,
    gap: 6,
    ...shadows.sm,
  },
  moduleChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[700],
    fontWeight: '500' as const,
  },

  // POI Cards
  poiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    padding: spacing[4],
    borderRadius: borders.radius.xl,
    marginBottom: spacing[2],
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  poiCardSelected: {
    borderColor: colors.terracotta[500],
    backgroundColor: '#FEF7F4',
  },
  poiCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing[3],
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  poiName: {
    fontSize: typography.fontSize.base,
    fontWeight: '600' as const,
    color: colors.gray[800],
    maxWidth: width - 140,
  },
  poiCategory: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginTop: 2,
  },
  poiScoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  poiScoreText: {
    fontSize: typography.fontSize.md,
    fontWeight: '700' as const,
  },

  // Overall Score
  overallScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: spacing[5],
    borderRadius: borders.radius['2xl'],
    marginBottom: spacing[4],
    gap: spacing[5],
    ...shadows.md,
  },
  overallScoreInfo: {
    flex: 1,
  },
  overallScoreTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    fontWeight: '500' as const,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  overallScoreLabel: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700' as const,
    marginTop: spacing[1],
  },
  overallScorePOI: {
    fontSize: typography.fontSize.base,
    color: colors.gray[700],
    marginTop: spacing[1],
    fontWeight: '500' as const,
  },
  overallScoreTime: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
    marginTop: spacing[1],
  },

  // Score Distribution
  scoreDistribution: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.background.secondary,
    padding: spacing[3],
    borderRadius: borders.radius.xl,
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  miniScoreItem: {
    alignItems: 'center',
    gap: 4,
  },
  miniScoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniScoreValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600' as const,
    color: colors.gray[700],
  },

  // Category Groups
  categoryGroup: {
    marginBottom: spacing[4],
  },
  categoryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600' as const,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[2],
    paddingLeft: spacing[1],
  },

  // Module Card
  moduleCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borders.radius.xl,
    marginBottom: spacing[2],
    overflow: 'hidden',
    ...shadows.sm,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    gap: spacing[3],
  },
  moduleIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleInfo: {
    flex: 1,
  },
  moduleName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600' as const,
    color: colors.gray[800],
  },
  moduleCategory: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
  },
  moduleScoreContainer: {
    width: 60,
    alignItems: 'flex-end',
    gap: 4,
  },
  moduleScore: {
    fontSize: typography.fontSize.md,
    fontWeight: '700' as const,
  },

  // Module Details
  moduleDetails: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    paddingTop: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borders.radius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600' as const,
  },
  dataSection: {
    marginTop: spacing[2],
  },
  dataSectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600' as const,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
  },
  dataKey: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    flex: 1,
    textTransform: 'capitalize',
  },
  dataValue: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[800],
    fontWeight: '500' as const,
    flex: 1.5,
    textAlign: 'right',
  },
  suggestionsSection: {
    marginTop: spacing[3],
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  suggestionText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
    flex: 1,
    lineHeight: 18,
  },

  // Recommendations
  recommendationsCard: {
    backgroundColor: '#FFFBF5',
    borderRadius: borders.radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: '#FDE8D3',
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  recommendationsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600' as const,
    color: colors.terracotta[600],
  },
  recommendationItem: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  recommendationNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.terracotta[100],
    color: colors.terracotta[600],
    fontSize: typography.fontSize.xs,
    fontWeight: '600' as const,
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  recommendationText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
    flex: 1,
    lineHeight: 20,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[10],
    gap: spacing[3],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600' as const,
    color: colors.gray[600],
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },

  // Loading State
  loadingState: {
    alignItems: 'center',
    paddingVertical: spacing[10],
    gap: spacing[3],
  },
  loadingText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600' as const,
    color: colors.gray[700],
  },
  loadingSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
  },
});
