/**
 * Planeador Automático - Tab
 * AI-powered trip planner with optimized itineraries
 * Smart Route Engine: locality-based, time-period-aware, category-diverse
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import api, {
  getLocalities,
  generateSmartItinerary,
  generateAiItinerary,
  saveItinerary,
  listItineraries,
  deleteItinerary,
  SmartItineraryResponse,
  AiItineraryResponse,
  SavedItinerary,
} from '../../src/services/api';
import { colors, shadows, fontFamilies } from '../../src/theme';
import { palette, withOpacity } from '../../src/theme/colors';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

const serif = fontFamilies.serif;

// Planning tools based on strategic report
const PLANNING_TOOLS = [
  {
    id: 'quick',
    titleKey: 'plannerEvents.planner.tools.quickTitle',
    descriptionKey: 'plannerEvents.planner.tools.quickDesc',
    icon: 'flash-on',
    color: palette.terracotta[500],
    gradient: ['#B08556', palette.terracotta[500]],
  },
  {
    id: 'weekend',
    titleKey: 'plannerEvents.planner.tools.weekendTitle',
    descriptionKey: 'plannerEvents.planner.tools.weekendDesc',
    icon: 'weekend',
    color: '#8B5CF6',
    gradient: ['#7C3AED', '#8B5CF6'],
  },
  {
    id: 'roadtrip',
    titleKey: 'plannerEvents.planner.tools.roadtripTitle',
    descriptionKey: 'plannerEvents.planner.tools.roadtripDesc',
    icon: 'directions-car',
    color: '#22C55E',
    gradient: ['#16A34A', '#22C55E'],
  },
  {
    id: 'thematic',
    titleKey: 'plannerEvents.planner.tools.thematicTitle',
    descriptionKey: 'plannerEvents.planner.tools.thematicDesc',
    icon: 'category',
    color: '#06B6D4',
    gradient: ['#0891B2', '#06B6D4'],
  },
];

// All interest categories (covering all 44 subcategories)
const INTERESTS = [
  { id: 'natureza', labelKey: 'plannerEvents.planner.interests.natureza', icon: 'terrain', color: '#22C55E' },
  { id: 'patrimonio', labelKey: 'plannerEvents.planner.interests.patrimonio', icon: 'account-balance', color: palette.terracotta[500] },
  { id: 'gastronomia', labelKey: 'plannerEvents.planner.interests.gastronomia', icon: 'restaurant', color: '#EF4444' },
  { id: 'historia', labelKey: 'plannerEvents.planner.interests.historia', icon: 'history-edu', color: '#92400E' },
  { id: 'cultura', labelKey: 'plannerEvents.planner.interests.cultura', icon: 'celebration', color: '#8B5CF6' },
  { id: 'praias', labelKey: 'plannerEvents.planner.interests.praias', icon: 'beach-access', color: '#06B6D4' },
  { id: 'vinhos', labelKey: 'plannerEvents.planner.interests.vinhos', icon: 'local-bar', color: '#7C3AED' },
  { id: 'aventura', labelKey: 'plannerEvents.planner.interests.aventura', icon: 'hiking', color: '#84CC16' },
  { id: 'festas', labelKey: 'plannerEvents.planner.interests.festas', icon: 'music-note', color: '#EC4899' },
];

// Portuguese regions
const REGIONS = [
  { id: 'norte', labelKey: 'plannerEvents.regions.norte', emoji: '🏔️' },
  { id: 'centro', labelKey: 'plannerEvents.regions.centro', emoji: '🏛️' },
  { id: 'lisboa', labelKey: 'plannerEvents.regions.lisboa', emoji: '🌆' },
  { id: 'alentejo', labelKey: 'plannerEvents.regions.alentejo', emoji: '🌾' },
  { id: 'algarve', labelKey: 'plannerEvents.regions.algarve', emoji: '🏖️' },
  { id: 'acores', labelKey: 'plannerEvents.regions.acores', emoji: '🌋' },
  { id: 'madeira', labelKey: 'plannerEvents.regions.madeira', emoji: '🌺' },
];

const PERIOD_ICONS: Record<string, string> = {
  manha: 'wb-sunny',
  almoco: 'restaurant',
  tarde: 'wb-twilight',
  fim_tarde: 'nightlight',
  noite: 'nightlife',
};

const PERIOD_COLORS: Record<string, string> = {
  manha: '#F59E0B',
  almoco: '#EF4444',
  tarde: '#F97316',
  fim_tarde: '#8B5CF6',
  noite: '#6366F1',
};

interface Route {
  id: string;
  name: string;
  description: string;
  category: string;
  region?: string;
  duration_hours?: number;
  distance_km?: number;
  difficulty?: string;
}

const getRoutes = async (category?: string, region?: string): Promise<Route[]> => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (region) params.append('region', region);
  const response = await api.get(`/routes?${params.toString()}`);
  return response.data;
};

const REGION_MAP: Record<string, string> = {
  norte: 'Norte', centro: 'Centro', lisboa: 'Lisboa',
  alentejo: 'Alentejo', algarve: 'Algarve', acores: 'Açores', madeira: 'Madeira',
};

// Map/backend expect lowercase, accent-free region IDs (norte, acores…).
// Itinerary responses can carry the display value ("Norte", "Açores"), so
// normalize before handing the region to MapaTab.
const toRegionId = (region?: string | null): string | undefined => {
  if (!region) return undefined;
  return region.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

const PACE_OPTIONS = [
  { id: 'relaxado', labelKey: 'plannerEvents.planner.pace.relaxado', icon: 'spa' },
  { id: 'moderado', labelKey: 'plannerEvents.planner.pace.moderado', icon: 'directions-walk' },
  { id: 'intenso', labelKey: 'plannerEvents.planner.pace.intenso', icon: 'directions-run' },
];

const PROFILE_OPTIONS = [
  { id: 'familia', labelKey: 'plannerEvents.planner.profile.familia', icon: 'family-restroom' },
  { id: 'casal', labelKey: 'plannerEvents.planner.profile.casal', icon: 'favorite' },
  { id: 'solo', labelKey: 'plannerEvents.planner.profile.solo', icon: 'person' },
  { id: 'senior', labelKey: 'plannerEvents.planner.profile.senior', icon: 'elderly' },
  { id: 'aventureiro', labelKey: 'plannerEvents.planner.profile.aventureiro', icon: 'hiking' },
  { id: 'grupo', labelKey: 'plannerEvents.planner.profile.grupo', icon: 'groups' },
];

export default function PlaneadorTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const { isPremium } = useAuth();
  const { t } = useTranslation();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [tripDays, setTripDays] = useState('2');
  const [selectedPace, setSelectedPace] = useState('moderado');
  const [localitySearch, setLocalitySearch] = useState('');
  const [selectedLocality, setSelectedLocality] = useState<string | null>(null);

  const [selectedProfile, setSelectedProfile] = useState('casal');
  const [aiNarrativeEnabled, setAiNarrativeEnabled] = useState(false);

  const [aiResult, setAiResult] = useState<SmartItineraryResponse | null>(null);
  const [aiNarrative, setAiNarrative] = useState<AiItineraryResponse['narrative'] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [myPlansOpen, setMyPlansOpen] = useState(false);
  const [myPlans, setMyPlans] = useState<SavedItinerary[]>([]);
  const [myPlansLoading, setMyPlansLoading] = useState(false);

  // Pre-fill trip duration from onboarding time preference
  useEffect(() => {
    AsyncStorage.getItem('time_preference').then(tp => {
      if (!tp) return;
      const map: Record<string, string> = { '1h': '1', '3h': '1', 'dia': '1', 'fds': '2' };
      if (map[tp]) setTripDays(map[tp]);
    });
  }, []);

  // Fetch localities for the selected region
  const { data: localitiesData } = useQuery({
    queryKey: ['localities', selectedRegion, localitySearch],
    queryFn: () => getLocalities(
      selectedRegion ? REGION_MAP[selectedRegion] : undefined,
      localitySearch || undefined
    ),
    enabled: !!selectedRegion || localitySearch.length >= 2,
  });

  const { data: routesData, isLoading: routesLoading } = useQuery<Route[]>({
    queryKey: ['routes', selectedRegion],
    queryFn: () => getRoutes(undefined, selectedRegion || undefined),
  });

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleStartPlanning = async () => {
    if (!selectedRegion && !selectedLocality) {
      router.push('/smart-routes');
      return;
    }
    // Premium gate for AI itineraries
    if (!isPremium) {
      router.push('/premium');
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    setAiNarrative(null);
    try {
      const interests = selectedInterests.length > 0
        ? selectedInterests.join(',')
        : 'cultura,gastronomia';
      const region = selectedRegion ? REGION_MAP[selectedRegion] : undefined;
      const params = {
        locality: selectedLocality || undefined,
        region,
        days: parseInt(tripDays),
        interests,
        profile: selectedProfile,
        pace: selectedPace,
        max_radius_km: selectedLocality ? 15 : 50,
      };
      if (aiNarrativeEnabled) {
        const result = await generateAiItinerary(params);
        setAiResult(result);
        if (result.narrative) setAiNarrative(result.narrative);
      } else {
        const result = await generateSmartItinerary(params);
        setAiResult(result);
      }
    } catch {
      // Fallback to smart routes page
      router.push('/smart-routes');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveItinerary = async () => {
    if (!aiResult) return;
    setSaveLoading(true);
    try {
      const daysText = aiResult.days > 1
        ? t('plannerEvents.planner.manyDays', { n: aiResult.days })
        : t('plannerEvents.planner.oneDay', { n: aiResult.days });
      const title = aiResult.locality
        ? `${aiResult.locality} · ${daysText}`
        : `${aiResult.region} · ${daysText}`;
      await saveItinerary({
        title,
        itinerary_data: aiResult,
        locality: aiResult.locality || undefined,
        region: aiResult.region || undefined,
        days: aiResult.days,
        profile: aiResult.profile,
        pace: aiResult.pace,
        interests: aiResult.interests,
        is_public: false,
      });
      Alert.alert(t('plannerEvents.planner.saveAlert.successTitle'), t('plannerEvents.planner.saveAlert.successMessage'));
    } catch {
      Alert.alert(t('plannerEvents.planner.saveAlert.errorTitle'), t('plannerEvents.planner.saveAlert.errorMessage'));
    } finally {
      setSaveLoading(false);
    }
  };

  const loadMyPlans = async () => {
    setMyPlansLoading(true);
    try {
      const data = await listItineraries();
      setMyPlans(data.items || []);
    } catch {
      setMyPlans([]);
    } finally {
      setMyPlansLoading(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    Alert.alert(t('plannerEvents.planner.deleteAlert.title'), t('plannerEvents.planner.deleteAlert.message'), [
      { text: t('plannerEvents.planner.deleteAlert.cancel'), style: 'cancel' },
      {
        text: t('plannerEvents.planner.deleteAlert.confirm'), style: 'destructive',
        onPress: async () => {
          try {
            await deleteItinerary(id);
            setMyPlans(prev => prev.filter(p => p.id !== id));
          } catch { /* ignore */ }
        },
      },
    ]);
  };

  const renderToolCard = (tool: typeof PLANNING_TOOLS[0]) => (
    <TouchableOpacity
      key={tool.id}
      style={[
        styles.toolCard,
        selectedTool === tool.id && styles.toolCardSelected,
      ]}
      onPress={() => setSelectedTool(tool.id === selectedTool ? null : tool.id)}
      activeOpacity={0.8}
      data-testid={`tool-${tool.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: selectedTool === tool.id }}
      accessibilityLabel={t('plannerEvents.planner.tools.a11y', { name: t(tool.titleKey) })}
    >
      <LinearGradient
        colors={tool.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toolGradient}
      >
        <MaterialIcons name={tool.icon as any} size={28} color="#FFF" />
        <Text style={styles.toolTitle}>{t(tool.titleKey)}</Text>
        <Text style={styles.toolDescription}>{t(tool.descriptionKey)}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderRouteCard = (route: Route) => (
    <TouchableOpacity
      key={route.id}
      style={styles.routeCard}
      onPress={() => router.push(`/route/${route.id}`)}
      activeOpacity={0.8}
      data-testid={`route-card-${route.id}`}
      accessibilityRole="link"
      accessibilityLabel={t('plannerEvents.planner.routes.routeA11y', { name: route.name })}
    >
      <View style={styles.routeIcon}>
        <MaterialIcons name="route" size={24} color={palette.terracotta[500]} />
      </View>
      <View style={styles.routeInfo}>
        <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
        <View style={styles.routeMeta}>
          {route.duration_hours && (
            <>
              <MaterialIcons name="schedule" size={12} color={palette.gray[500]} />
              <Text style={styles.routeMetaText}>{route.duration_hours}h</Text>
            </>
          )}
          {route.distance_km && (
            <>
              <MaterialIcons name="straighten" size={12} color={palette.gray[500]} />
              <Text style={styles.routeMetaText}>{route.distance_km}km</Text>
            </>
          )}
          {route.difficulty && (
            <View style={[
              styles.difficultyBadge,
              { backgroundColor: route.difficulty === 'fácil' ? '#22C55E' : route.difficulty === 'moderado' ? palette.terracotta[500] : '#EF4444' }
            ]}>
              <Text style={styles.difficultyText}>{route.difficulty}</Text>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={palette.gray[500]} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]} data-testid="planeador-tab">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('plannerEvents.planner.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('plannerEvents.planner.subtitle')}</Text>
        </View>

        {/* Planning Tools */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-fix-high" size={20} color={palette.terracotta[500]} />
            <Text style={styles.sectionTitle}>{t('plannerEvents.planner.tools.sectionTitle')}</Text>
          </View>
          <View style={styles.toolsGrid}>
            {PLANNING_TOOLS.map(renderToolCard)}
          </View>
        </View>

        {/* Trip Duration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="schedule" size={20} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>{t('plannerEvents.planner.duration.title')}</Text>
          </View>
          <View style={styles.durationRow}>
            {['1', '2', '3', '5', '7'].map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.durationChip,
                  tripDays === days && styles.durationChipActive,
                ]}
                onPress={() => setTripDays(days)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tripDays === days }}
                accessibilityLabel={t('plannerEvents.planner.duration.a11y', {
                  label: parseInt(days) === 1
                    ? t('plannerEvents.planner.oneDay', { n: days })
                    : t('plannerEvents.planner.manyDays', { n: days }),
                })}
              >
                <Text style={[
                  styles.durationText,
                  tripDays === days && styles.durationTextActive,
                ]}>
                  {parseInt(days) === 1
                    ? t('plannerEvents.planner.oneDay', { n: days })
                    : t('plannerEvents.planner.manyDays', { n: days })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="favorite" size={20} color="#EF4444" />
            <Text style={styles.sectionTitle}>{t('plannerEvents.planner.interests.title')}</Text>
          </View>
          <View style={styles.interestsGrid}>
            {INTERESTS.map((interest) => (
              <TouchableOpacity
                key={interest.id}
                style={[
                  styles.interestChip,
                  selectedInterests.includes(interest.id) && {
                    backgroundColor: interest.color,
                    borderColor: interest.color,
                  },
                ]}
                onPress={() => toggleInterest(interest.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedInterests.includes(interest.id) }}
                accessibilityLabel={t('plannerEvents.planner.interests.a11y', { name: t(interest.labelKey) })}
              >
                <MaterialIcons
                  name={interest.icon as any}
                  size={18}
                  color={selectedInterests.includes(interest.id) ? '#FFF' : palette.gray[300]}
                />
                <Text style={[
                  styles.interestText,
                  selectedInterests.includes(interest.id) && styles.interestTextActive,
                ]}>
                  {t(interest.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Region Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="map" size={20} color="#06B6D4" />
            <Text style={styles.sectionTitle}>{t('plannerEvents.planner.region.title')}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.regionsRow}
          >
            <TouchableOpacity
              style={[
                styles.regionChip,
                !selectedRegion && styles.regionChipActive,
              ]}
              onPress={() => { setSelectedRegion(null); setSelectedLocality(null); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: !selectedRegion }}
              accessibilityLabel={t('plannerEvents.planner.region.a11y', { name: t('plannerEvents.regions.all') })}
            >
              <Text style={[
                styles.regionText,
                !selectedRegion && styles.regionTextActive,
              ]}>
                {`🇵🇹 ${t('plannerEvents.regions.all')}`}
              </Text>
            </TouchableOpacity>
            {REGIONS.map((region) => (
              <TouchableOpacity
                key={region.id}
                style={[
                  styles.regionChip,
                  selectedRegion === region.id && styles.regionChipActive,
                ]}
                onPress={() => {
                  setSelectedRegion(selectedRegion === region.id ? null : region.id);
                  setSelectedLocality(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedRegion === region.id }}
                accessibilityLabel={t('plannerEvents.planner.region.a11y', { name: t(region.labelKey) })}
              >
                <Text style={[
                  styles.regionText,
                  selectedRegion === region.id && styles.regionTextActive,
                ]}>
                  {region.emoji} {t(region.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Locality Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="place" size={20} color="#EF4444" />
            <Text style={styles.sectionTitle}>{t('plannerEvents.planner.locality.title')}</Text>
          </View>
          <View style={styles.localityInput}>
            <MaterialIcons name="search" size={18} color={palette.gray[300]} />
            <TextInput
              style={styles.localityTextInput}
              placeholder={t('plannerEvents.planner.locality.placeholder')}
              placeholderTextColor={palette.gray[500]}
              value={localitySearch}
              onChangeText={(text) => {
                setLocalitySearch(text);
                if (!text) setSelectedLocality(null);
              }}
            />
            {selectedLocality && (
              <TouchableOpacity
                onPress={() => { setSelectedLocality(null); setLocalitySearch(''); }}
                accessibilityRole="button"
                accessibilityLabel={t('plannerEvents.planner.locality.clearA11y')}
              >
                <MaterialIcons name="close" size={18} color={palette.gray[300]} />
              </TouchableOpacity>
            )}
          </View>
          {selectedLocality && (
            <View style={styles.selectedLocalityBadge}>
              <MaterialIcons name="place" size={14} color="#FFF" />
              <Text style={styles.selectedLocalityText}>{selectedLocality}</Text>
            </View>
          )}
          {!selectedLocality && localitiesData?.localities && localitiesData.localities.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginTop: 8 }}>
              {localitiesData.localities.slice(0, 15).map((loc) => (
                <TouchableOpacity
                  key={loc.name}
                  style={styles.localityChip}
                  onPress={() => {
                    setSelectedLocality(loc.name);
                    setLocalitySearch(loc.name);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedLocality === loc.name }}
                  accessibilityLabel={t('plannerEvents.planner.locality.selectA11y', { name: loc.name })}
                >
                  <Text style={styles.localityChipText}>{loc.name}</Text>
                  <Text style={styles.localityChipCount}>{t('plannerEvents.planner.poiCount', { n: loc.poi_count })}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Pace Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="speed" size={20} color="#F97316" />
            <Text style={styles.sectionTitle}>{t('plannerEvents.planner.pace.title')}</Text>
          </View>
          <View style={styles.paceRow}>
            {PACE_OPTIONS.map((pace) => (
              <TouchableOpacity
                key={pace.id}
                style={[
                  styles.paceChip,
                  selectedPace === pace.id && styles.paceChipActive,
                ]}
                onPress={() => setSelectedPace(pace.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedPace === pace.id }}
                accessibilityLabel={t('plannerEvents.planner.pace.a11y', { name: t(pace.labelKey) })}
              >
                <MaterialIcons
                  name={pace.icon as any}
                  size={18}
                  color={selectedPace === pace.id ? '#FFF' : palette.gray[300]}
                />
                <Text style={[
                  styles.paceText,
                  selectedPace === pace.id && styles.paceTextActive,
                ]}>
                  {t(pace.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Traveler Profile */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person" size={20} color="#3B82F6" />
            <Text style={styles.sectionTitle}>{t('plannerEvents.planner.profile.title')}</Text>
          </View>
          <View style={styles.profileGrid}>
            {PROFILE_OPTIONS.map((profile) => (
              <TouchableOpacity
                key={profile.id}
                style={[
                  styles.profileChip,
                  selectedProfile === profile.id && styles.profileChipActive,
                ]}
                onPress={() => setSelectedProfile(profile.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedProfile === profile.id }}
                accessibilityLabel={t('plannerEvents.planner.profile.a11y', { name: t(profile.labelKey) })}
              >
                <MaterialIcons
                  name={profile.icon as any}
                  size={18}
                  color={selectedProfile === profile.id ? '#FFF' : palette.gray[300]}
                />
                <Text style={[
                  styles.profileText,
                  selectedProfile === profile.id && styles.profileTextActive,
                ]}>
                  {t(profile.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI Narrative Toggle */}
        <View style={styles.aiToggleRow}>
          <View style={styles.aiToggleInfo}>
            <MaterialIcons name="auto-stories" size={20} color="#8B5CF6" />
            <View>
              <Text style={styles.aiToggleTitle}>{t('plannerEvents.planner.aiNarrative.title')}</Text>
              <Text style={styles.aiToggleSubtitle}>{t('plannerEvents.planner.aiNarrative.subtitle')}</Text>
            </View>
          </View>
          <Switch
            value={aiNarrativeEnabled}
            onValueChange={setAiNarrativeEnabled}
            trackColor={{ false: '#E2E8F0', true: '#C4B5FD' }}
            thumbColor={aiNarrativeEnabled ? '#8B5CF6' : palette.gray[300]}
          />
        </View>

        {/* Start Planning Button */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartPlanning}
          activeOpacity={0.8}
          disabled={aiLoading}
          data-testid="start-planning-btn"
          accessibilityRole="button"
          accessibilityState={{ disabled: aiLoading }}
          accessibilityLabel={t('plannerEvents.planner.generate.a11y')}
        >
          <LinearGradient
            colors={[palette.terracotta[500], '#B08556']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startGradient}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <MaterialIcons name="auto-awesome" size={22} color="#000" />
            )}
            <Text style={styles.startText}>
              {aiLoading
                ? t('plannerEvents.planner.generate.loading')
                : isPremium
                  ? t('plannerEvents.planner.generate.label')
                  : t('plannerEvents.planner.generate.labelPremium')}
            </Text>
            {!isPremium && <MaterialIcons name="lock" size={16} color="#000" />}
          </LinearGradient>
        </TouchableOpacity>

        {/* Smart Itinerary Result */}
        {aiResult && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="auto-awesome" size={20} color={palette.terracotta[500]} />
              <Text style={styles.sectionTitle}>
                {aiResult.locality
                  ? t('plannerEvents.planner.result.titleLocality', { place: aiResult.locality })
                  : t('plannerEvents.planner.result.titleRegion', { region: aiResult.region })} - {aiResult.days === 1
                  ? t('plannerEvents.planner.oneDay', { n: aiResult.days })
                  : t('plannerEvents.planner.manyDays', { n: aiResult.days })}
              </Text>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>{t('plannerEvents.planner.result.aiBadge')}</Text>
              </View>
            </View>

            {/* Summary */}
            <View style={styles.aiSummaryCard}>
              <View style={styles.aiSummaryRow}>
                <View style={styles.aiSummaryItem}>
                  <MaterialIcons name="place" size={16} color={palette.terracotta[500]} />
                  <Text style={styles.aiSummaryValue}>{aiResult.summary.total_pois}</Text>
                  <Text style={styles.aiSummaryLabel}>{t('plannerEvents.planner.result.pois')}</Text>
                </View>
                <View style={styles.aiSummaryItem}>
                  <MaterialIcons name="schedule" size={16} color="#22C55E" />
                  <Text style={styles.aiSummaryValue}>{aiResult.summary.total_visit_minutes} min</Text>
                  <Text style={styles.aiSummaryLabel}>{t('plannerEvents.planner.result.visits')}</Text>
                </View>
                <View style={styles.aiSummaryItem}>
                  <MaterialIcons name="directions-car" size={16} color="#3B82F6" />
                  <Text style={styles.aiSummaryValue}>{aiResult.summary.total_travel_minutes} min</Text>
                  <Text style={styles.aiSummaryLabel}>{t('plannerEvents.planner.result.travel')}</Text>
                </View>
                <View style={styles.aiSummaryItem}>
                  <MaterialIcons name="category" size={16} color="#8B5CF6" />
                  <Text style={styles.aiSummaryValue}>{aiResult.summary.category_count}</Text>
                  <Text style={styles.aiSummaryLabel}>{t('plannerEvents.planner.result.categories')}</Text>
                </View>
              </View>
            </View>

            {/* AI Narrative Introduction */}
            {aiNarrative && (
              <View style={styles.narrativeCard}>
                <Text style={styles.narrativeTitle}>{aiNarrative.title}</Text>
                <Text style={styles.narrativeIntro}>{aiNarrative.introduction}</Text>
              </View>
            )}

            {aiResult.itinerary?.map((day) => {
              const dayNarrative = aiNarrative?.daily_narratives?.find(n => n.day === day.day);
              return (
              <View key={day.day} style={styles.aiDayCard}>
                <View style={styles.aiDayHeader}>
                  <View style={styles.aiDayBadge}>
                    <Text style={styles.aiDayNumber}>{t('plannerEvents.planner.result.dayBadge', { day: day.day })}</Text>
                  </View>
                  <Text style={styles.aiDayTheme}>
                    {dayNarrative?.theme || t('plannerEvents.planner.result.dayFallbackTheme', {
                      pois: day.poi_count,
                      hours: Math.round(day.total_minutes / 60),
                    })}
                  </Text>
                </View>

                {dayNarrative?.morning_narrative && (
                  <Text style={styles.aiNarrative}>{dayNarrative.morning_narrative}</Text>
                )}

                {day.periods?.map((period) => (
                  <View key={period.period} style={styles.aiPeriod}>
                    <View style={styles.aiPeriodHeader}>
                      <MaterialIcons
                        name={(PERIOD_ICONS[period.period] || 'schedule') as any}
                        size={14}
                        color={PERIOD_COLORS[period.period] || palette.gray[300]}
                      />
                      <Text style={[styles.aiPeriodLabel, { color: PERIOD_COLORS[period.period] || palette.gray[300] }]}>
                        {period.label} ({period.start_time})
                      </Text>
                    </View>
                    {period.pois?.map((poi) => (
                      <TouchableOpacity
                        key={poi.id}
                        style={styles.aiPoiItem}
                        onPress={() => router.push(`/heritage/${poi.id}`)}
                        accessibilityRole="link"
                        accessibilityLabel={t('plannerEvents.planner.result.poiA11y', { name: poi.name })}
                      >
                        <MaterialIcons name="place" size={16} color={PERIOD_COLORS[period.period] || palette.terracotta[500]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.aiPoiName} numberOfLines={1}>{poi.name}</Text>
                          <View style={styles.aiPoiMeta}>
                            <Text style={styles.aiPoiMetaText}>{poi.category}</Text>
                            <Text style={styles.aiPoiMetaText}>{poi.visit_minutes} min</Text>
                            {poi.travel_from_previous_min > 0 && (
                              <Text style={styles.aiPoiTravel}>
                                {poi.distance_from_previous_km} km / {poi.travel_from_previous_min} min
                              </Text>
                            )}
                          </View>
                        </View>
                        {poi.iq_score ? (
                          <View style={styles.iqBadge}>
                            <Text style={styles.iqText}>{Math.round(poi.iq_score)}</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                {dayNarrative?.afternoon_narrative && (
                  <Text style={styles.aiNarrative}>{dayNarrative.afternoon_narrative}</Text>
                )}

                {dayNarrative?.evening_tip && (
                  <View style={styles.aiTip}>
                    <MaterialIcons name="lightbulb" size={14} color="#F59E0B" />
                    <Text style={styles.aiTipText}>{dayNarrative.evening_tip}</Text>
                  </View>
                )}
              </View>
              );
            })}

            {/* AI Narrative Closing */}
            {aiNarrative?.closing && (
              <Text style={styles.aiClosing}>{aiNarrative.closing}</Text>
            )}

            {/* Transport info */}
            {aiResult.transport?.recommended?.length > 0 && (
              <View style={styles.aiTransport}>
                <MaterialIcons name="directions-bus" size={16} color="#06B6D4" />
                <Text style={styles.aiTransportText}>
                  {t('plannerEvents.planner.result.transport', { list: aiResult.transport.recommended.join(' · ') })}
                </Text>
              </View>
            )}

            {/* Events */}
            {aiResult.events_nearby?.length > 0 && (
              <View style={styles.aiEventsCard}>
                <Text style={styles.aiEventsTitle}>{t('plannerEvents.planner.result.eventsTitle')}</Text>
                {aiResult.events_nearby.map((evt) => (
                  <View key={evt.id} style={styles.aiEventItem}>
                    <MaterialIcons name="event" size={14} color="#EC4899" />
                    <Text style={styles.aiEventText}>{evt.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Ver Roteiro no Mapa */}
            <TouchableOpacity
              style={styles.showOnMapBtn}
              onPress={() =>
                router.push({
                  pathname: '/mapa',
                  params: { region: toRegionId(aiResult.region), t: String(Date.now()) },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t('plannerEvents.planner.result.showOnMapA11y')}
            >
              <MaterialIcons name="map" size={18} color={palette.terracotta[500]} />
              <Text style={styles.showOnMapText}>{t('plannerEvents.planner.result.showOnMap')}</Text>
            </TouchableOpacity>

            {/* Save button */}
            {isPremium && (
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveItinerary}
                disabled={saveLoading}
                accessibilityRole="button"
                accessibilityState={{ disabled: saveLoading }}
                accessibilityLabel={t('plannerEvents.planner.result.saveA11y')}
              >
                {saveLoading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <MaterialIcons name="bookmark-add" size={18} color="#FFF" />
                }
                <Text style={styles.saveBtnText}>{t('plannerEvents.planner.result.save')}</Text>
              </TouchableOpacity>
            )}

            {/* Reset button */}
            <TouchableOpacity
              style={styles.resetResultBtn}
              onPress={() => { setAiResult(null); setAiNarrative(null); }}
              accessibilityRole="button"
              accessibilityLabel={t('plannerEvents.planner.result.resetA11y')}
            >
              <MaterialIcons name="refresh" size={18} color={colors.terracotta[500]} />
              <Text style={styles.resetResultText}>{t('plannerEvents.planner.result.reset')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* My Plans section */}
        {isPremium && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.myPlansHeader}
              onPress={() => {
                const next = !myPlansOpen;
                setMyPlansOpen(next);
                if (next && myPlans.length === 0) loadMyPlans();
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: myPlansOpen }}
              accessibilityLabel={myPlansOpen ? t('plannerEvents.planner.myPlans.closeA11y') : t('plannerEvents.planner.myPlans.openA11y')}
            >
              <MaterialIcons name="folder" size={20} color={palette.terracotta[500]} />
              <Text style={styles.sectionTitle}>{t('plannerEvents.planner.myPlans.title')}</Text>
              <MaterialIcons
                name={myPlansOpen ? 'expand-less' : 'expand-more'}
                size={22}
                color={palette.gray[300]}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>

            {myPlansOpen && (
              myPlansLoading ? (
                <ActivityIndicator size="small" color={palette.terracotta[500]} style={{ padding: 20 }} />
              ) : myPlans.length === 0 ? (
                <Text style={[styles.emptyText, { paddingHorizontal: 20 }]}>
                  {t('plannerEvents.planner.myPlans.empty')}
                </Text>
              ) : (
                <View style={{ paddingHorizontal: 20, gap: 8, marginTop: 8 }}>
                  {myPlans.map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.planCard}
                      onPress={() => router.push(`/itinerary/${plan.id}`)}
                      accessibilityRole="link"
                      accessibilityLabel={t('plannerEvents.planner.myPlans.openPlanA11y', { title: plan.title })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planTitle} numberOfLines={1}>{plan.title}</Text>
                        <Text style={styles.planMeta}>
                          {plan.days > 1
                            ? t('plannerEvents.planner.manyDays', { n: plan.days })
                            : t('plannerEvents.planner.oneDay', { n: plan.days })} · {t('plannerEvents.planner.poiCount', { n: plan.total_pois })}
                          {plan.collaborators_count > 0
                            ? ` · ${plan.collaborators_count > 1
                              ? t('plannerEvents.planner.myPlans.collaborators', { n: plan.collaborators_count })
                              : t('plannerEvents.planner.myPlans.oneCollaborator', { n: plan.collaborators_count })}`
                            : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeletePlan(plan.id)}
                        style={{ padding: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('plannerEvents.planner.myPlans.deletePlanA11y', { title: plan.title })}
                      >
                        <MaterialIcons name="delete-outline" size={18} color={palette.gray[300]} />
                      </TouchableOpacity>
                      <MaterialIcons name="chevron-right" size={20} color={palette.gray[300]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}
          </View>
        )}

        {/* Suggested Routes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="route" size={20} color="#22C55E" />
            <Text style={styles.sectionTitle}>{t('plannerEvents.planner.routes.title')}</Text>
          </View>
          {routesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={palette.terracotta[500]} />
            </View>
          ) : routesData && routesData.length > 0 ? (
            <View style={styles.routesList}>
              {routesData.slice(0, 5).map(renderRouteCard)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="explore" size={32} color={palette.gray[500]} />
              <Text style={styles.emptyText}>{t('plannerEvents.planner.routes.empty')}</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/smart-routes')}
            data-testid="quick-action-smart-routes"
            accessibilityRole="link"
            accessibilityLabel={t('plannerEvents.planner.quickActions.smartRoutesA11y')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(230, 122, 74, 0.1)' }]}>
              <MaterialIcons name="auto-awesome" size={24} color={colors.terracotta[500]} />
            </View>
            <Text style={styles.quickActionText}>{t('plannerEvents.planner.quickActions.smartRoutes')}</Text>
            <MaterialIcons name="arrow-forward" size={20} color={palette.gray[500]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/route-planner')}
            data-testid="quick-action-route-planner"
            accessibilityRole="link"
            accessibilityLabel={t('plannerEvents.planner.quickActions.routePlannerA11y')}
          >
            <View style={styles.quickActionIcon}>
              <MaterialIcons name="directions" size={24} color={palette.terracotta[500]} />
            </View>
            <Text style={styles.quickActionText}>{t('plannerEvents.planner.quickActions.routePlanner')}</Text>
            <MaterialIcons name="arrow-forward" size={20} color={palette.gray[500]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/nearby')}
            accessibilityRole="link"
            accessibilityLabel={t('plannerEvents.planner.quickActions.nearbyA11y')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
              <MaterialIcons name="near-me" size={24} color="#22C55E" />
            </View>
            <Text style={styles.quickActionText}>{t('plannerEvents.planner.quickActions.nearby')}</Text>
            <MaterialIcons name="arrow-forward" size={20} color={palette.gray[500]} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray[800],
    fontFamily: serif,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[800],
    fontFamily: serif,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  toolCard: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  toolCardSelected: {
    borderWidth: 2,
    borderColor: colors.terracotta[500],
  },
  toolGradient: {
    padding: 16,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  toolDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  durationRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    ...shadows.sm,
  },
  durationChipActive: {
    backgroundColor: colors.terracotta[500],
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[500],
  },
  durationTextActive: {
    color: '#FFFFFF',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    gap: 6,
    ...shadows.sm,
  },
  interestText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[600],
  },
  interestTextActive: {
    color: '#FFFFFF',
  },
  regionsRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  regionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.mint[100],
    borderWidth: 1,
    borderColor: palette.gray[800],
    marginRight: 8,
  },
  regionChipActive: {
    backgroundColor: colors.terracotta[500],
  },
  regionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[600],
  },
  regionTextActive: {
    color: '#FFFFFF',
  },
  startButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  startGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  startText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aiBadge: {
    backgroundColor: palette.terracotta[500],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  aiBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  aiSubtitle: {
    fontSize: 14,
    color: palette.gray[500],
    fontStyle: 'italic',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  aiDayCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    ...shadows.sm,
  },
  aiDayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  aiDayBadge: {
    backgroundColor: palette.terracotta[500],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiDayNumber: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  aiDayTheme: { fontSize: 14, fontWeight: '600', color: '#1F2937', flex: 1 },
  aiDayTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 8,
    paddingLeft: 4,
    fontFamily: serif,
  },
  aiPeriod: { marginBottom: 8 },
  aiPeriodLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.gray[300],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  aiNarrative: {
    fontSize: 13,
    color: palette.gray[500],
    lineHeight: 18,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  aiPoiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 4,
  },
  aiPoiName: { flex: 1, fontSize: 13, color: '#1F2937', fontWeight: '500' },
  iqBadge: {
    backgroundColor: 'rgba(196,154,108,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  iqText: { fontSize: 10, fontWeight: '700', color: palette.terracotta[500] },
  aiTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  aiTipText: { flex: 1, fontSize: 12, color: palette.gray[500] },
  aiClosing: {
    fontSize: 14,
    color: '#7C3AED',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginVertical: 12,
    fontFamily: serif,
  },
  aiTransport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(6,182,212,0.08)',
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  aiTransportText: { flex: 1, fontSize: 12, color: '#06B6D4' },
  // Locality styles
  localityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    gap: 8,
    ...shadows.sm,
  },
  localityTextInput: {
    flex: 1,
    fontSize: 14,
    color: colors.gray[800],
  },
  selectedLocalityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.terracotta[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  selectedLocalityText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  localityChip: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    ...shadows.sm,
  },
  localityChipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700] },
  localityChipCount: { fontSize: 10, color: colors.gray[400], marginTop: 2 },
  // Pace styles
  paceRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  paceChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    gap: 6,
    ...shadows.sm,
  },
  paceChipActive: { backgroundColor: '#F97316' },
  paceText: { fontSize: 13, fontWeight: '600', color: colors.gray[500] },
  paceTextActive: { color: '#FFF' },
  // Smart itinerary summary
  aiSummaryCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    ...shadows.sm,
  },
  aiSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  aiSummaryItem: { alignItems: 'center', gap: 2 },
  aiSummaryValue: { fontSize: 14, fontWeight: '700', color: colors.gray[800] },
  aiSummaryLabel: { fontSize: 10, color: colors.gray[400] },
  // Period header
  aiPeriodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  // POI meta info
  aiPoiMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  aiPoiMetaText: { fontSize: 10, color: palette.gray[300] },
  aiPoiTravel: { fontSize: 10, color: '#3B82F6' },
  // Events card
  aiEventsCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    ...shadows.sm,
  },
  aiEventsTitle: { fontSize: 14, fontWeight: '600', color: colors.gray[700], marginBottom: 8 },
  aiEventItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  aiEventText: { fontSize: 13, color: colors.gray[600] },
  // Reset button
  resetResultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors.terracotta[50],
    borderWidth: 1,
    borderColor: colors.terracotta[500],
    gap: 6,
  },
  resetResultText: { fontSize: 14, fontWeight: '600', color: colors.terracotta[500] },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  routesList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    ...shadows.sm,
  },
  routeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.terracotta[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[800],
    marginBottom: 4,
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeMetaText: {
    fontSize: 12,
    color: palette.gray[500],
    marginRight: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    marginHorizontal: 20,
    backgroundColor: palette.forest[600],
    borderRadius: 12,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: palette.gray[500],
  },
  quickActionsSection: {
    marginTop: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.forest[600],
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Profile selector
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    gap: 6,
    ...shadows.sm,
  },
  profileChipActive: {
    backgroundColor: '#3B82F6',
  },
  profileText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[600],
  },
  profileTextActive: {
    color: '#FFFFFF',
  },
  // AI narrative toggle
  aiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  aiToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aiToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  aiToggleSubtitle: {
    fontSize: 11,
    color: '#A78BFA',
    marginTop: 1,
  },
  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.forest[500],
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  showOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withOpacity(palette.terracotta[500], 0.12),
    borderWidth: 1,
    borderColor: withOpacity(palette.terracotta[500], 0.4),
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  showOnMapText: { color: palette.terracotta[500], fontSize: 14, fontWeight: '700' },
  // My Plans
  myPlansHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
    gap: 8,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    ...shadows.sm,
  },
  planTitle: { fontSize: 14, fontWeight: '600', color: colors.gray[800] },
  planMeta: { fontSize: 11, color: colors.gray[500], marginTop: 2 },
  // AI narrative cards
  narrativeCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  narrativeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 6,
    fontFamily: serif,
  },
  narrativeIntro: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
    fontStyle: 'italic',
  },
});
