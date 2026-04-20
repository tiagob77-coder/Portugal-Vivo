/**
 * Smart Routes - Geração de Rotas Inteligentes
 * Usa os scores do IQ Engine (M12-M19) para criar rotas otimizadas
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform, Linking,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getSmartRouteThemes, getSmartRouteProfiles, getSmartRouteRegions,
  generateSmartRoute, SmartRouteRequest, SmartRouteResponse, SmartRoutePOI,
} from '../src/services/api';
import { colors, shadows } from '../src/theme';

const { width } = Dimensions.get('window');

const DIFFICULTIES = [
  { id: 'facil', label: 'Fácil', icon: 'child-care', color: '#22C55E' },
  { id: 'moderado', label: 'Moderado', icon: 'directions-walk', color: '#C49A6C' },
  { id: 'dificil', label: 'Difícil', icon: 'hiking', color: '#EF4444' },
];

const DURATIONS = [
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 240, label: '4h' },
  { value: 480, label: 'Dia' },
];

const THEME_ICONS: Record<string, string> = {
  natureza: 'terrain',
  gastronomico: 'restaurant',
  cultural: 'museum',
  historico: 'account-balance',
  religioso: 'church',
  aventura: 'hiking',
  arquitetura: 'domain',
  romantico: 'favorite',
};

const THEME_COLORS: Record<string, string> = {
  natureza: '#22C55E',
  gastronomico: '#EF4444',
  cultural: '#8B5CF6',
  historico: '#C49A6C',
  religioso: '#6366F1',
  aventura: '#84CC16',
  arquitetura: '#06B6D4',
  romantico: '#EC4899',
};

const REGION_EMOJI: Record<string, string> = {
  norte: '🏔️',
  centro: '🏛️',
  lisboa: '🌆',
  alentejo: '🌾',
  algarve: '🏖️',
  acores: '🌋',
  madeira: '🌺',
};

export default function SmartRoutesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Filter state
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [rainFriendly, setRainFriendly] = useState<boolean | null>(null);

  // Fetch data
  const { data: themesData } = useQuery({
    queryKey: ['smart-route-themes'],
    queryFn: getSmartRouteThemes,
  });

  const { data: profilesData } = useQuery({
    queryKey: ['smart-route-profiles'],
    queryFn: getSmartRouteProfiles,
  });

  const { data: regionsData } = useQuery({
    queryKey: ['smart-route-regions'],
    queryFn: getSmartRouteRegions,
  });

  // Generate route mutation
  const generateMutation = useMutation({
    mutationFn: (params: SmartRouteRequest) => generateSmartRoute(params),
  });

  const handleGenerate = useCallback(() => {
    const params: SmartRouteRequest = {};
    if (selectedTheme) params.theme = selectedTheme;
    if (selectedRegion) params.region = selectedRegion;
    if (selectedDifficulty) params.difficulty = selectedDifficulty;
    if (selectedProfile) params.profile = selectedProfile;
    if (selectedDuration) params.max_duration = selectedDuration;
    if (rainFriendly !== null) params.rain_friendly = rainFriendly;
    params.max_pois = 8;
    generateMutation.mutate(params);
  }, [selectedTheme, selectedRegion, selectedDifficulty, selectedProfile, selectedDuration, rainFriendly]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    setSelectedTheme(null);
    setSelectedProfile(null);
    setSelectedRegion(null);
    setSelectedDifficulty(null);
    setSelectedDuration(null);
    setRainFriendly(null);
    generateMutation.reset();
  };

  const openPOIInMaps = (poi: SmartRoutePOI) => {
    if (!poi.location) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${poi.location.lat},${poi.location.lng}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const themes = themesData?.themes || [];
  const profiles = profilesData?.profiles || [];
  const regions = regionsData?.regions || [];
  const routeResult = generateMutation.data;

  // Count active filters
  const activeFilters = [selectedTheme, selectedProfile, selectedRegion, selectedDifficulty, selectedDuration, rainFriendly].filter(v => v !== null).length;

  return (
    <View style={styles.container} data-testid="smart-routes-screen">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} data-testid="smart-routes-back-btn">
            <MaterialIcons name="arrow-back" size={22} color={colors.gray[800]} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Rotas Inteligentes</Text>
            <Text style={styles.headerSub}>Powered by IQ Engine</Text>
          </View>
          {routeResult && (
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} data-testid="smart-routes-reset-btn">
              <MaterialIcons name="refresh" size={20} color={colors.terracotta[500]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!routeResult ? (
          <>
            {/* Theme Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <MaterialIcons name="palette" size={18} color={colors.terracotta[500]} />
                <Text style={styles.sectionTitle}>Tema da Rota</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {themes.map((t) => {
                  const active = selectedTheme === t.id;
                  const tColor = THEME_COLORS[t.id] || '#C49A6C';
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.themeCard, active && { borderColor: tColor, borderWidth: 2 }]}
                      onPress={() => setSelectedTheme(active ? null : t.id)}
                      data-testid={`theme-${t.id}`}
                    >
                      <View style={[styles.themeIcon, { backgroundColor: tColor + '20' }]}>
                        <MaterialIcons name={(THEME_ICONS[t.id] || 'route') as any} size={24} color={tColor} />
                      </View>
                      <Text style={[styles.themeLabel, active && { color: tColor }]} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.themePOIs}>{t.poi_count} POIs</Text>
                      {active && (
                        <View style={[styles.activeIndicator, { backgroundColor: tColor }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Profile Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <MaterialIcons name="person" size={18} color={colors.ocean[500]} />
                <Text style={styles.sectionTitle}>Perfil do Viajante</Text>
              </View>
              <View style={styles.profilesGrid}>
                {profiles.map((p) => {
                  const active = selectedProfile === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.profileCard, active && styles.profileCardActive]}
                      onPress={() => setSelectedProfile(active ? null : p.id)}
                      data-testid={`profile-${p.id}`}
                    >
                      <MaterialIcons name={p.icon as any} size={22} color={active ? '#FFF' : colors.gray[600]} />
                      <Text style={[styles.profileName, active && styles.profileNameActive]} numberOfLines={1}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Region Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <MaterialIcons name="map" size={18} color={colors.forest[500]} />
                <Text style={styles.sectionTitle}>Região</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {regions.map((r) => {
                  const active = selectedRegion === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.regionChip, active && styles.regionChipActive]}
                      onPress={() => setSelectedRegion(active ? null : r.id)}
                      data-testid={`region-${r.id}`}
                    >
                      <Text style={styles.regionEmoji}>{REGION_EMOJI[r.id] || '📍'}</Text>
                      <View>
                        <Text style={[styles.regionName, active && styles.regionNameActive]}>{r.name}</Text>
                        <Text style={[styles.regionMeta, active && { color: 'rgba(255,255,255,0.7)' }]}>{r.poi_count} POIs</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Difficulty */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <MaterialIcons name="fitness-center" size={18} color={colors.gray[600]} />
                <Text style={styles.sectionTitle}>Dificuldade</Text>
              </View>
              <View style={styles.diffRow}>
                {DIFFICULTIES.map((d) => {
                  const active = selectedDifficulty === d.id;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.diffChip, active && { backgroundColor: d.color, borderColor: d.color }]}
                      onPress={() => setSelectedDifficulty(active ? null : d.id)}
                      data-testid={`difficulty-${d.id}`}
                    >
                      <MaterialIcons name={d.icon as any} size={18} color={active ? '#FFF' : d.color} />
                      <Text style={[styles.diffLabel, active && { color: '#FFF' }]}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <MaterialIcons name="schedule" size={18} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Duração Máxima</Text>
              </View>
              <View style={styles.durRow}>
                {DURATIONS.map((d) => {
                  const active = selectedDuration === d.value;
                  return (
                    <TouchableOpacity
                      key={d.value}
                      style={[styles.durChip, active && styles.durChipActive]}
                      onPress={() => setSelectedDuration(active ? null : d.value)}
                      data-testid={`duration-${d.value}`}
                    >
                      <Text style={[styles.durLabel, active && styles.durLabelActive]}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Rain Friendly Toggle */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.rainToggle, rainFriendly && styles.rainToggleActive]}
                onPress={() => setRainFriendly(rainFriendly ? null : true)}
                data-testid="rain-friendly-toggle"
              >
                <MaterialIcons name="umbrella" size={20} color={rainFriendly ? '#FFF' : colors.ocean[500]} />
                <Text style={[styles.rainLabel, rainFriendly && { color: '#FFF' }]}>
                  Amigo da chuva (indoor/coberto)
                </Text>
                <View style={[styles.toggleDot, rainFriendly && styles.toggleDotActive]}>
                  {rainFriendly && <MaterialIcons name="check" size={14} color={colors.ocean[500]} />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerate}
              disabled={generateMutation.isPending}
              data-testid="generate-route-btn"
            >
              <LinearGradient
                colors={[colors.terracotta[500], colors.terracotta[600]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateGrad}
              >
                {generateMutation.isPending ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="auto-awesome" size={22} color="#FFF" />
                    <Text style={styles.generateText}>Gerar Rota Inteligente</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {activeFilters > 0 && (
              <Text style={styles.filterCount}>{activeFilters} filtro{activeFilters > 1 ? 's' : ''} activo{activeFilters > 1 ? 's' : ''}</Text>
            )}

            {generateMutation.isError && (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={20} color={colors.error} />
                <Text style={styles.errorText}>Erro ao gerar rota. Tente diferentes filtros.</Text>
              </View>
            )}

            <View style={{ height: 100 }} />
          </>
        ) : (
          /* RESULTS VIEW */
          <RouteResultsView
            data={routeResult}
            onReset={handleReset}
            onOpenPOI={(id: string) => router.push(`/heritage/${id}`)}
            onOpenMap={openPOIInMaps}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// RESULTS COMPONENT
// ============================================================

function RouteResultsView({
  data, onReset, onOpenPOI, onOpenMap,
}: {
  data: SmartRouteResponse;
  onReset: () => void;
  onOpenPOI: (id: string) => void;
  onOpenMap: (poi: SmartRoutePOI) => void;
}) {
  const getCategoryColor = (cat: string) => THEME_COLORS[cat] || colors.terracotta[500];

  return (
    <View data-testid="route-results">
      {/* Route Header Card */}
      <View style={rs.headerCard}>
        <LinearGradient
          colors={[colors.forest[500], colors.forest[700]]}
          style={rs.headerGrad}
        >
          <Text style={rs.routeName}>{data.route_name}</Text>
          <View style={rs.metricsRow}>
            <View style={rs.metric}>
              <MaterialIcons name="place" size={16} color={colors.terracotta[300]} />
              <Text style={rs.metricVal}>{data.metrics.poi_count}</Text>
              <Text style={rs.metricLabel}>Paragens</Text>
            </View>
            <View style={rs.metricDivider} />
            <View style={rs.metric}>
              <MaterialIcons name="straighten" size={16} color={colors.terracotta[300]} />
              <Text style={rs.metricVal}>{data.metrics.total_distance_km} km</Text>
              <Text style={rs.metricLabel}>Distância</Text>
            </View>
            <View style={rs.metricDivider} />
            <View style={rs.metric}>
              <MaterialIcons name="schedule" size={16} color={colors.terracotta[300]} />
              <Text style={rs.metricVal}>{data.metrics.total_duration_label}</Text>
              <Text style={rs.metricLabel}>Duração</Text>
            </View>
          </View>
          <View style={rs.scoreRow}>
            <View style={rs.scoreBadge}>
              <MaterialIcons name="insights" size={14} color={colors.terracotta[500]} />
              <Text style={rs.scoreText}>IQ Score: {data.avg_iq_score}</Text>
            </View>
            <Text style={rs.candidatesText}>{data.candidates_evaluated} POIs avaliados</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Time Breakdown */}
      <View style={rs.breakdownCard}>
        <Text style={rs.breakdownTitle}>Detalhe do Tempo</Text>
        <View style={rs.breakdownRow}>
          <View style={rs.breakdownItem}>
            <MaterialIcons name="visibility" size={18} color="#22C55E" />
            <Text style={rs.breakdownVal}>{data.metrics.total_visit_minutes} min</Text>
            <Text style={rs.breakdownLabel}>Visitas</Text>
          </View>
          <View style={rs.breakdownItem}>
            <MaterialIcons name="directions-car" size={18} color="#3B82F6" />
            <Text style={rs.breakdownVal}>{data.metrics.total_travel_minutes} min</Text>
            <Text style={rs.breakdownLabel}>Viagem</Text>
          </View>
          <View style={rs.breakdownItem}>
            <MaterialIcons name="timer" size={18} color={colors.terracotta[500]} />
            <Text style={rs.breakdownVal}>{data.metrics.total_duration_label}</Text>
            <Text style={rs.breakdownLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Active Filters */}
      {Object.values(data.filters).some(v => v !== null) && (
        <View style={rs.filtersCard}>
          <Text style={rs.filtersTitle}>Filtros Aplicados</Text>
          <View style={rs.filtersRow}>
            {data.filters.theme && (
              <View style={[rs.filterTag, { backgroundColor: (THEME_COLORS[data.filters.theme] || '#666') + '20' }]}>
                <Text style={[rs.filterTagText, { color: THEME_COLORS[data.filters.theme] || '#666' }]}>{data.filters.theme}</Text>
              </View>
            )}
            {data.filters.region && (
              <View style={[rs.filterTag, { backgroundColor: colors.forest[50] }]}>
                <Text style={[rs.filterTagText, { color: colors.forest[500] }]}>{data.filters.region}</Text>
              </View>
            )}
            {data.filters.difficulty && (
              <View style={[rs.filterTag, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[rs.filterTagText, { color: '#92400E' }]}>{data.filters.difficulty}</Text>
              </View>
            )}
            {data.filters.profile && (
              <View style={[rs.filterTag, { backgroundColor: colors.ocean[50] }]}>
                <Text style={[rs.filterTagText, { color: colors.ocean[500] }]}>{data.filters.profile}</Text>
              </View>
            )}
            {data.filters.rain_friendly && (
              <View style={[rs.filterTag, { backgroundColor: '#DBEAFE' }]}>
                <Text style={[rs.filterTagText, { color: '#1E40AF' }]}>Indoor</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* POI List */}
      <View style={rs.poisSection}>
        <Text style={rs.poisTitle}>Itinerário ({data.pois.length} paragens)</Text>

        {data.pois.map((poi, index) => (
          <View key={poi.id} data-testid={`poi-card-${poi.id}`}>
            {/* Connector line */}
            {index > 0 && (
              <View style={rs.connector}>
                <View style={rs.connectorLine} />
                {poi.location && data.pois[index - 1]?.location && (
                  <Text style={rs.connectorDistance}>
                    <MaterialIcons name="directions-car" size={10} color={colors.gray[400]} />
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={rs.poiCard}
              onPress={() => onOpenPOI(poi.id)}
              activeOpacity={0.85}
            >
              {/* Order badge */}
              <View style={rs.orderBadge}>
                <Text style={rs.orderText}>{poi.order}</Text>
              </View>

              <View style={rs.poiContent}>
                <Text style={rs.poiName} numberOfLines={1}>{poi.name}</Text>

                <View style={rs.poiMetaRow}>
                  <View style={[rs.poiCatBadge, { backgroundColor: getCategoryColor(poi.category) + '20' }]}>
                    <Text style={[rs.poiCatText, { color: getCategoryColor(poi.category) }]}>{poi.category}</Text>
                  </View>
                  <Text style={rs.poiRegion}>{poi.region}</Text>
                </View>

                <Text style={rs.poiDesc} numberOfLines={2}>{poi.description}</Text>

                <View style={rs.poiInfoRow}>
                  <View style={rs.poiInfo}>
                    <MaterialIcons name="schedule" size={12} color={colors.gray[400]} />
                    <Text style={rs.poiInfoText}>{poi.visit_minutes} min</Text>
                  </View>
                  <View style={rs.poiInfo}>
                    <MaterialIcons name="trending-up" size={12} color={colors.gray[400]} />
                    <Text style={rs.poiInfoText}>{poi.difficulty}</Text>
                  </View>
                  <View style={rs.poiInfo}>
                    <MaterialIcons name="wb-sunny" size={12} color={colors.gray[400]} />
                    <Text style={rs.poiInfoText}>{poi.best_time}</Text>
                  </View>
                  <View style={rs.poiInfo}>
                    <MaterialIcons name="insights" size={12} color={colors.terracotta[400]} />
                    <Text style={[rs.poiInfoText, { color: colors.terracotta[500] }]}>IQ {poi.iq_score}</Text>
                  </View>
                </View>

                {/* Themes */}
                {poi.primary_themes.length > 0 && (
                  <View style={rs.themesRow}>
                    {poi.primary_themes.slice(0, 3).map((theme) => (
                      <View key={theme} style={rs.themeTag}>
                        <Text style={rs.themeTagText}>{theme}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Map button */}
              {poi.location && (
                <TouchableOpacity
                  style={rs.mapBtn}
                  onPress={(e) => { e.stopPropagation(); onOpenMap(poi); }}
                  data-testid={`poi-map-btn-${poi.id}`}
                >
                  <MaterialIcons name="map" size={18} color={colors.ocean[500]} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={rs.actionsRow}>
        <TouchableOpacity style={rs.newRouteBtn} onPress={onReset} data-testid="new-route-btn">
          <MaterialIcons name="refresh" size={18} color={colors.terracotta[500]} />
          <Text style={rs.newRouteBtnText}>Nova Rota</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />
    </View>
  );
}

// ============================================================
// STYLES - MAIN SCREEN
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray[800],
  },
  headerSub: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 1,
  },
  resetBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.terracotta[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  section: { marginTop: 20 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
  },
  hScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  // Theme cards
  themeCard: {
    width: 120,
    backgroundColor: colors.background.secondary,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    ...shadows.sm,
  },
  themeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[700],
    textAlign: 'center',
  },
  themePOIs: {
    fontSize: 10,
    color: colors.gray[400],
    marginTop: 2,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 3,
    borderRadius: 2,
  },
  // Profiles
  profilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  profileCard: {
    width: (width - 48) / 3,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    gap: 4,
    ...shadows.sm,
  },
  profileCardActive: {
    backgroundColor: colors.forest[500],
    borderColor: colors.forest[500],
  },
  profileName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray[700],
    textAlign: 'center',
  },
  profileNameActive: {
    color: '#FFF',
  },
  // Regions
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    ...shadows.sm,
  },
  regionChipActive: {
    backgroundColor: colors.forest[500],
    borderColor: colors.forest[500],
  },
  regionEmoji: { fontSize: 18 },
  regionName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[700],
  },
  regionNameActive: { color: '#FFF' },
  regionMeta: {
    fontSize: 10,
    color: colors.gray[400],
  },
  // Difficulty
  diffRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  diffChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    gap: 6,
    ...shadows.sm,
  },
  diffLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[600],
  },
  // Duration
  durRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  durChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    ...shadows.sm,
  },
  durChipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  durLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray[600],
  },
  durLabelActive: {
    color: '#FFF',
  },
  // Rain toggle
  rainToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
    gap: 10,
    ...shadows.sm,
  },
  rainToggleActive: {
    backgroundColor: colors.ocean[500],
    borderColor: colors.ocean[500],
  },
  rainLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray[600],
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleDotActive: {
    backgroundColor: '#FFF',
  },
  // Generate button
  generateBtn: {
    marginHorizontal: 20,
    marginTop: 28,
    borderRadius: 16,
    overflow: 'hidden',
  },
  generateGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  generateText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  filterCount: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    color: colors.gray[400],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    flex: 1,
  },
});

// ============================================================
// STYLES - RESULTS VIEW
// ============================================================

const rs = StyleSheet.create({
  headerCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    ...shadows.lg,
  },
  headerGrad: {
    padding: 20,
  },
  routeName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
    gap: 2,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.terracotta[300],
  },
  candidatesText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  // Breakdown
  breakdownCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 14,
    padding: 16,
    ...shadows.sm,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[700],
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  breakdownItem: {
    alignItems: 'center',
    gap: 4,
  },
  breakdownVal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray[800],
  },
  breakdownLabel: {
    fontSize: 10,
    color: colors.gray[400],
  },
  // Filters
  filtersCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 14,
    padding: 14,
    ...shadows.sm,
  },
  filtersTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[500],
    marginBottom: 8,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterTagText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  // POI list
  poisSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  poisTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[800],
    marginBottom: 14,
  },
  connector: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
  },
  connectorLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.gray[300],
    borderRadius: 1,
  },
  connectorDistance: {
    position: 'absolute',
    right: 20,
    fontSize: 10,
    color: colors.gray[400],
  },
  poiCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 14,
    ...shadows.md,
  },
  orderBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.terracotta[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  orderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  poiContent: {
    flex: 1,
  },
  poiName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray[800],
    marginBottom: 4,
  },
  poiMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  poiCatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  poiCatText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  poiRegion: {
    fontSize: 11,
    color: colors.gray[400],
    textTransform: 'capitalize',
  },
  poiDesc: {
    fontSize: 12,
    color: colors.gray[500],
    lineHeight: 18,
    marginBottom: 8,
  },
  poiInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  poiInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  poiInfoText: {
    fontSize: 11,
    color: colors.gray[500],
  },
  themesRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  themeTag: {
    backgroundColor: colors.mint[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  themeTagText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.forest[500],
    textTransform: 'capitalize',
  },
  mapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ocean[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
  // Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  newRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.terracotta[50],
    borderWidth: 1.5,
    borderColor: colors.terracotta[500],
    gap: 8,
  },
  newRouteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.terracotta[500],
  },
});
