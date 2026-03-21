/**
 * Planeador Automático - Tab
 * AI-powered trip planner with optimized itineraries
 * Smart Route Engine: locality-based, time-period-aware, category-diverse
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
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
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
import { colors, shadows } from '../../src/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');
const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

// Planning tools based on strategic report
const PLANNING_TOOLS = [
  {
    id: 'quick',
    title: 'Viagem Rápida',
    description: 'Gere um roteiro automático para um dia',
    icon: 'flash-on',
    color: '#C49A6C',
    gradient: ['#B08556', '#C49A6C'],
  },
  {
    id: 'weekend',
    title: 'Fim de Semana',
    description: 'Plano otimizado para 2-3 dias',
    icon: 'weekend',
    color: '#8B5CF6',
    gradient: ['#7C3AED', '#8B5CF6'],
  },
  {
    id: 'roadtrip',
    title: 'Road Trip',
    description: 'Aventura pela estrada com paragens',
    icon: 'directions-car',
    color: '#22C55E',
    gradient: ['#16A34A', '#22C55E'],
  },
  {
    id: 'thematic',
    title: 'Temático',
    description: 'Roteiro focado num tema específico',
    icon: 'category',
    color: '#06B6D4',
    gradient: ['#0891B2', '#06B6D4'],
  },
];

// All interest categories (covering all 44 subcategories)
const INTERESTS = [
  { id: 'natureza', name: 'Natureza', icon: 'terrain', color: '#22C55E' },
  { id: 'patrimonio', name: 'Património', icon: 'account-balance', color: '#C49A6C' },
  { id: 'gastronomia', name: 'Gastronomia', icon: 'restaurant', color: '#EF4444' },
  { id: 'historia', name: 'História', icon: 'history-edu', color: '#92400E' },
  { id: 'cultura', name: 'Cultura', icon: 'celebration', color: '#8B5CF6' },
  { id: 'praias', name: 'Praias', icon: 'beach-access', color: '#06B6D4' },
  { id: 'vinhos', name: 'Vinhos', icon: 'local-bar', color: '#7C3AED' },
  { id: 'aventura', name: 'Aventura', icon: 'hiking', color: '#84CC16' },
  { id: 'festas', name: 'Festas', icon: 'music-note', color: '#EC4899' },
];

// Portuguese regions
const REGIONS = [
  { id: 'norte', name: 'Norte', emoji: '🏔️' },
  { id: 'centro', name: 'Centro', emoji: '🏛️' },
  { id: 'lisboa', name: 'Lisboa', emoji: '🌆' },
  { id: 'alentejo', name: 'Alentejo', emoji: '🌾' },
  { id: 'algarve', name: 'Algarve', emoji: '🏖️' },
  { id: 'acores', name: 'Açores', emoji: '🌋' },
  { id: 'madeira', name: 'Madeira', emoji: '🌺' },
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

const PACE_OPTIONS = [
  { id: 'relaxado', name: 'Relaxado', icon: 'spa' },
  { id: 'moderado', name: 'Moderado', icon: 'directions-walk' },
  { id: 'intenso', name: 'Intenso', icon: 'directions-run' },
];

const PROFILE_OPTIONS = [
  { id: 'familia', name: 'Família', icon: 'family-restroom' },
  { id: 'casal', name: 'Casal', icon: 'favorite' },
  { id: 'solo', name: 'Solo', icon: 'person' },
  { id: 'senior', name: 'Sénior', icon: 'elderly' },
  { id: 'aventureiro', name: 'Aventureiro', icon: 'hiking' },
  { id: 'grupo', name: 'Grupo', icon: 'groups' },
];

export default function PlaneadorTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const { isPremium } = useAuth();
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
      const title = aiResult.locality
        ? `${aiResult.locality} · ${aiResult.days} dia${aiResult.days > 1 ? 's' : ''}`
        : `${aiResult.region} · ${aiResult.days} dia${aiResult.days > 1 ? 's' : ''}`;
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
      Alert.alert('Guardado!', 'O seu roteiro foi guardado em "Meus Planos".');
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar o roteiro.');
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
    Alert.alert('Eliminar', 'Tem a certeza que quer eliminar este roteiro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
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
    >
      <LinearGradient
        colors={tool.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.toolGradient}
      >
        <MaterialIcons name={tool.icon as any} size={28} color="#FFF" />
        <Text style={styles.toolTitle}>{tool.title}</Text>
        <Text style={styles.toolDescription}>{tool.description}</Text>
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
    >
      <View style={styles.routeIcon}>
        <MaterialIcons name="route" size={24} color="#C49A6C" />
      </View>
      <View style={styles.routeInfo}>
        <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
        <View style={styles.routeMeta}>
          {route.duration_hours && (
            <>
              <MaterialIcons name="schedule" size={12} color="#64748B" />
              <Text style={styles.routeMetaText}>{route.duration_hours}h</Text>
            </>
          )}
          {route.distance_km && (
            <>
              <MaterialIcons name="straighten" size={12} color="#64748B" />
              <Text style={styles.routeMetaText}>{route.distance_km}km</Text>
            </>
          )}
          {route.difficulty && (
            <View style={[
              styles.difficultyBadge,
              { backgroundColor: route.difficulty === 'fácil' ? '#22C55E' : route.difficulty === 'moderado' ? '#C49A6C' : '#EF4444' }
            ]}>
              <Text style={styles.difficultyText}>{route.difficulty}</Text>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#64748B" />
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
          <Text style={styles.headerTitle}>Planeador</Text>
          <Text style={styles.headerSubtitle}>Crie o seu roteiro perfeito</Text>
        </View>

        {/* Planning Tools */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-fix-high" size={20} color="#C49A6C" />
            <Text style={styles.sectionTitle}>Ferramentas de Planeamento</Text>
          </View>
          <View style={styles.toolsGrid}>
            {PLANNING_TOOLS.map(renderToolCard)}
          </View>
        </View>

        {/* Trip Duration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="schedule" size={20} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Duração da Viagem</Text>
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
              >
                <Text style={[
                  styles.durationText,
                  tripDays === days && styles.durationTextActive,
                ]}>
                  {days} {parseInt(days) === 1 ? 'dia' : 'dias'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="favorite" size={20} color="#EF4444" />
            <Text style={styles.sectionTitle}>Os Seus Interesses</Text>
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
              >
                <MaterialIcons
                  name={interest.icon as any}
                  size={18}
                  color={selectedInterests.includes(interest.id) ? '#FFF' : '#94A3B8'}
                />
                <Text style={[
                  styles.interestText,
                  selectedInterests.includes(interest.id) && styles.interestTextActive,
                ]}>
                  {interest.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Region Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="map" size={20} color="#06B6D4" />
            <Text style={styles.sectionTitle}>Região</Text>
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
            >
              <Text style={[
                styles.regionText,
                !selectedRegion && styles.regionTextActive,
              ]}>
                🇵🇹 Todas
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
              >
                <Text style={[
                  styles.regionText,
                  selectedRegion === region.id && styles.regionTextActive,
                ]}>
                  {region.emoji} {region.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Locality Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="place" size={20} color="#EF4444" />
            <Text style={styles.sectionTitle}>Localidade</Text>
          </View>
          <View style={styles.localityInput}>
            <MaterialIcons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.localityTextInput}
              placeholder="Pesquisar localidade (ex: Braga, Sintra...)"
              placeholderTextColor="#64748B"
              value={localitySearch}
              onChangeText={(text) => {
                setLocalitySearch(text);
                if (!text) setSelectedLocality(null);
              }}
            />
            {selectedLocality && (
              <TouchableOpacity onPress={() => { setSelectedLocality(null); setLocalitySearch(''); }}>
                <MaterialIcons name="close" size={18} color="#94A3B8" />
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
                >
                  <Text style={styles.localityChipText}>{loc.name}</Text>
                  <Text style={styles.localityChipCount}>{loc.poi_count} POIs</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Pace Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="speed" size={20} color="#F97316" />
            <Text style={styles.sectionTitle}>Ritmo</Text>
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
              >
                <MaterialIcons
                  name={pace.icon as any}
                  size={18}
                  color={selectedPace === pace.id ? '#FFF' : '#94A3B8'}
                />
                <Text style={[
                  styles.paceText,
                  selectedPace === pace.id && styles.paceTextActive,
                ]}>
                  {pace.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Traveler Profile */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person" size={20} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Perfil de Viajante</Text>
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
              >
                <MaterialIcons
                  name={profile.icon as any}
                  size={18}
                  color={selectedProfile === profile.id ? '#FFF' : '#94A3B8'}
                />
                <Text style={[
                  styles.profileText,
                  selectedProfile === profile.id && styles.profileTextActive,
                ]}>
                  {profile.name}
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
              <Text style={styles.aiToggleTitle}>Narrativa IA (GPT-4o)</Text>
              <Text style={styles.aiToggleSubtitle}>Descrições envolventes para cada dia</Text>
            </View>
          </View>
          <Switch
            value={aiNarrativeEnabled}
            onValueChange={setAiNarrativeEnabled}
            trackColor={{ false: '#E2E8F0', true: '#C4B5FD' }}
            thumbColor={aiNarrativeEnabled ? '#8B5CF6' : '#94A3B8'}
          />
        </View>

        {/* Start Planning Button */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartPlanning}
          activeOpacity={0.8}
          disabled={aiLoading}
          data-testid="start-planning-btn"
        >
          <LinearGradient
            colors={['#C49A6C', '#B08556']}
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
              {aiLoading ? 'A gerar roteiro inteligente...' : isPremium ? 'Gerar Roteiro com IA' : 'Gerar Roteiro com IA — Premium'}
            </Text>
            {!isPremium && <MaterialIcons name="lock" size={16} color="#000" />}
          </LinearGradient>
        </TouchableOpacity>

        {/* Smart Itinerary Result */}
        {aiResult && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="auto-awesome" size={20} color="#C49A6C" />
              <Text style={styles.sectionTitle}>
                {aiResult.locality ? `Roteiro em ${aiResult.locality}` : `Roteiro ${aiResult.region}`} - {aiResult.days} {aiResult.days === 1 ? 'dia' : 'dias'}
              </Text>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>IA</Text>
              </View>
            </View>

            {/* Summary */}
            <View style={styles.aiSummaryCard}>
              <View style={styles.aiSummaryRow}>
                <View style={styles.aiSummaryItem}>
                  <MaterialIcons name="place" size={16} color="#C49A6C" />
                  <Text style={styles.aiSummaryValue}>{aiResult.summary.total_pois}</Text>
                  <Text style={styles.aiSummaryLabel}>POIs</Text>
                </View>
                <View style={styles.aiSummaryItem}>
                  <MaterialIcons name="schedule" size={16} color="#22C55E" />
                  <Text style={styles.aiSummaryValue}>{aiResult.summary.total_visit_minutes} min</Text>
                  <Text style={styles.aiSummaryLabel}>Visitas</Text>
                </View>
                <View style={styles.aiSummaryItem}>
                  <MaterialIcons name="directions-car" size={16} color="#3B82F6" />
                  <Text style={styles.aiSummaryValue}>{aiResult.summary.total_travel_minutes} min</Text>
                  <Text style={styles.aiSummaryLabel}>Viagem</Text>
                </View>
                <View style={styles.aiSummaryItem}>
                  <MaterialIcons name="category" size={16} color="#8B5CF6" />
                  <Text style={styles.aiSummaryValue}>{aiResult.summary.category_count}</Text>
                  <Text style={styles.aiSummaryLabel}>Categorias</Text>
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
                    <Text style={styles.aiDayNumber}>Dia {day.day}</Text>
                  </View>
                  <Text style={styles.aiDayTheme}>
                    {dayNarrative?.theme || `${day.poi_count} POIs - ${Math.round(day.total_minutes / 60)}h total`}
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
                        color={PERIOD_COLORS[period.period] || '#94A3B8'}
                      />
                      <Text style={[styles.aiPeriodLabel, { color: PERIOD_COLORS[period.period] || '#94A3B8' }]}>
                        {period.label} ({period.start_time})
                      </Text>
                    </View>
                    {period.pois?.map((poi) => (
                      <TouchableOpacity
                        key={poi.id}
                        style={styles.aiPoiItem}
                        onPress={() => router.push(`/heritage/${poi.id}`)}
                      >
                        <MaterialIcons name="place" size={16} color={PERIOD_COLORS[period.period] || '#C49A6C'} />
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
                  Transportes: {aiResult.transport.recommended.join(' · ')}
                </Text>
              </View>
            )}

            {/* Events */}
            {aiResult.events_nearby?.length > 0 && (
              <View style={styles.aiEventsCard}>
                <Text style={styles.aiEventsTitle}>Eventos na região</Text>
                {aiResult.events_nearby.map((evt) => (
                  <View key={evt.id} style={styles.aiEventItem}>
                    <MaterialIcons name="event" size={14} color="#EC4899" />
                    <Text style={styles.aiEventText}>{evt.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Save button */}
            {isPremium && (
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveItinerary}
                disabled={saveLoading}
              >
                {saveLoading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <MaterialIcons name="bookmark-add" size={18} color="#FFF" />
                }
                <Text style={styles.saveBtnText}>Guardar Roteiro</Text>
              </TouchableOpacity>
            )}

            {/* Reset button */}
            <TouchableOpacity
              style={styles.resetResultBtn}
              onPress={() => { setAiResult(null); setAiNarrative(null); }}
            >
              <MaterialIcons name="refresh" size={18} color={colors.terracotta[500]} />
              <Text style={styles.resetResultText}>Novo Roteiro</Text>
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
            >
              <MaterialIcons name="folder" size={20} color="#C49A6C" />
              <Text style={styles.sectionTitle}>Meus Planos</Text>
              <MaterialIcons
                name={myPlansOpen ? 'expand-less' : 'expand-more'}
                size={22}
                color="#94A3B8"
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>

            {myPlansOpen && (
              myPlansLoading ? (
                <ActivityIndicator size="small" color="#C49A6C" style={{ padding: 20 }} />
              ) : myPlans.length === 0 ? (
                <Text style={[styles.emptyText, { paddingHorizontal: 20 }]}>
                  Ainda não tem roteiros guardados.
                </Text>
              ) : (
                <View style={{ paddingHorizontal: 20, gap: 8, marginTop: 8 }}>
                  {myPlans.map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.planCard}
                      onPress={() => router.push(`/itinerary/${plan.id}` as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planTitle} numberOfLines={1}>{plan.title}</Text>
                        <Text style={styles.planMeta}>
                          {plan.days} dia{plan.days > 1 ? 's' : ''} · {plan.total_pois} POIs
                          {plan.collaborators_count > 0 ? ` · ${plan.collaborators_count} colaborador${plan.collaborators_count > 1 ? 'es' : ''}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeletePlan(plan.id)} style={{ padding: 4 }}>
                        <MaterialIcons name="delete-outline" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                      <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
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
            <Text style={styles.sectionTitle}>Rotas Sugeridas</Text>
          </View>
          {routesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#C49A6C" />
            </View>
          ) : routesData && routesData.length > 0 ? (
            <View style={styles.routesList}>
              {routesData.slice(0, 5).map(renderRouteCard)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="explore" size={32} color="#64748B" />
              <Text style={styles.emptyText}>Selecione uma região para ver rotas</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/smart-routes')}
            data-testid="quick-action-smart-routes"
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(230, 122, 74, 0.1)' }]}>
              <MaterialIcons name="auto-awesome" size={24} color={colors.terracotta[500]} />
            </View>
            <Text style={styles.quickActionText}>Rotas Inteligentes (IQ)</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/route-planner')}
            data-testid="quick-action-route-planner"
          >
            <View style={styles.quickActionIcon}>
              <MaterialIcons name="directions" size={24} color="#C49A6C" />
            </View>
            <Text style={styles.quickActionText}>Planear Rota A→B</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/nearby')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
              <MaterialIcons name="near-me" size={24} color="#22C55E" />
            </View>
            <Text style={styles.quickActionText}>Locais Perto de Mim</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#64748B" />
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
    width: (width - 48) / 2,
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
    borderColor: '#2A2F2A',
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
    backgroundColor: '#C49A6C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  aiBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  aiSubtitle: {
    fontSize: 14,
    color: '#64748B',
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
    backgroundColor: '#C49A6C',
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
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  aiNarrative: {
    fontSize: 13,
    color: '#64748B',
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
  iqText: { fontSize: 10, fontWeight: '700', color: '#C49A6C' },
  aiTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  aiTipText: { flex: 1, fontSize: 12, color: '#64748B' },
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
  aiPoiMetaText: { fontSize: 10, color: '#94A3B8' },
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
    color: '#64748B',
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
    backgroundColor: '#264E41',
    borderRadius: 12,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  quickActionsSection: {
    marginTop: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#264E41',
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
    backgroundColor: '#2E5E4E',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
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
