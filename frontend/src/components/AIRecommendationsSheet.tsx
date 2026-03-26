import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

// ========================
// TYPES
// ========================

export interface RecommendationItem {
  id: string;
  name: string;
  category: string;
  region?: string;
  location: { lat: number; lng: number };
  distance_km: number;
  iq_score?: number;
  image_url?: string;
  description?: string;
}

interface AIRecommendationsResponse {
  recommendations: RecommendationItem[];
  ai_tip?: string;
}

export interface AIRecommendationsSheetProps {
  lat: number;
  lng: number;
  visible: boolean;
  onClose: () => void;
  onItemPress?: (item: RecommendationItem) => void;
}

type InterestId = 'natureza' | 'historia' | 'foto' | 'surf' | 'gastronomia';

// ========================
// CONSTANTS
// ========================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const C = {
  bg: '#1C2B2D',
  card: '#243336',
  accent: '#2E8B6A',
  text: '#E2DFD6',
  textMuted: '#94A3B8',
  chip: 'rgba(255,255,255,0.08)',
  chipActive: '#2E5E4E',
};

const INTERESTS: { id: InterestId; label: string; emoji: string }[] = [
  { id: 'natureza', label: 'Natureza', emoji: '🌿' },
  { id: 'historia', label: 'História', emoji: '🏛️' },
  { id: 'foto', label: 'Fotografia', emoji: '📸' },
  { id: 'surf', label: 'Surf', emoji: '🌊' },
  { id: 'gastronomia', label: 'Gastronomia', emoji: '🍽️' },
];

const BASE_RADIUS = 25;
const RADIUS_STEP = 10;

// ========================
// SKELETON
// ========================

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonThumb} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, { width: '65%' }]} />
            <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
            <View style={[styles.skeletonLine, { width: '30%', marginTop: 6 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ========================
// RECOMMENDATION CARD
// ========================

function RecommendationCard({
  item,
  onPress,
}: {
  item: RecommendationItem;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Thumbnail */}
      <View style={styles.thumbContainer}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <MaterialIcons name="place" size={26} color={C.accent} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.cardMeta}>
          {/* Category chip */}
          <View style={styles.categoryChip}>
            <Text style={styles.categoryText} numberOfLines={1}>
              {item.category}
            </Text>
          </View>

          {/* Distance badge */}
          <View style={styles.distanceBadge}>
            <MaterialIcons name="near-me" size={11} color={C.accent} />
            <Text style={styles.distanceText}>
              {item.distance_km < 1
                ? `${Math.round(item.distance_km * 1000)}m`
                : `${item.distance_km.toFixed(1)}km`}
            </Text>
          </View>
        </View>

        {/* IQ score */}
        {item.iq_score !== undefined && (
          <View style={styles.iqRow}>
            <MaterialIcons name="auto-awesome" size={12} color="#F59E0B" />
            <Text style={styles.iqText}>IQ {item.iq_score}</Text>
          </View>
        )}

        {/* Region */}
        {item.region ? (
          <Text style={styles.regionText} numberOfLines={1}>
            {item.region}
          </Text>
        ) : null}
      </View>

      <MaterialIcons name="chevron-right" size={20} color={C.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

// ========================
// MAIN COMPONENT
// ========================

export default function AIRecommendationsSheet({
  lat,
  lng,
  visible,
  onClose,
  onItemPress,
}: AIRecommendationsSheetProps) {
  const [activeInterests, setActiveInterests] = useState<InterestId[]>([]);
  const [radiusExtra, setRadiusExtra] = useState(0);

  const radius = BASE_RADIUS + radiusExtra;

  const { data, isLoading } = useQuery<AIRecommendationsResponse>({
    queryKey: ['ai-recs', lat, lng, activeInterests, radius],
    queryFn: () =>
      api
        .post('/ai/recommendations', {
          lat,
          lng,
          interests: activeInterests,
          radius_km: radius,
          limit: 10,
        })
        .then((r) => r.data),
    enabled: visible && !!lat && !!lng,
  });

  if (!visible) return null;

  const recommendations = data?.recommendations || [];
  const aiTip = data?.ai_tip;

  const toggleInterest = (id: InterestId) => {
    setActiveInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <View style={styles.sheet}>
      {/* Drag handle */}
      <View style={styles.dragHandleRow}>
        <View style={styles.dragHandle} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="auto-awesome" size={18} color={C.accent} />
          <Text style={styles.headerTitle}>Recomendações IA</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="close" size={22} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Interest filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.interestRow}
      >
        {INTERESTS.map((interest) => {
          const isActive = activeInterests.includes(interest.id);
          return (
            <TouchableOpacity
              key={interest.id}
              style={[styles.interestChip, isActive && styles.interestChipActive]}
              onPress={() => toggleInterest(interest.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.interestEmoji}>{interest.emoji}</Text>
              <Text style={[styles.interestLabel, isActive && styles.interestLabelActive]}>
                {interest.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* AI tip */}
      {aiTip ? (
        <View style={styles.aiTipContainer}>
          <MaterialIcons name="tips-and-updates" size={14} color={C.accent} />
          <Text style={styles.aiTipText}>{aiTip}</Text>
        </View>
      ) : null}

      {/* List */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : recommendations.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={36} color={C.textMuted} />
            <Text style={styles.emptyTitle}>Sem resultados</Text>
            <Text style={styles.emptyText}>
              Tenta aumentar o raio ou mudar os interesses.
            </Text>
          </View>
        ) : (
          recommendations.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              onPress={() => onItemPress?.(item)}
            />
          ))
        )}

        {/* Ver mais button */}
        {!isLoading && (
          <TouchableOpacity
            style={styles.verMaisBtn}
            onPress={() => setRadiusExtra((prev) => prev + RADIUS_STEP)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="expand-more" size={18} color={C.accent} />
            <Text style={styles.verMaisText}>
              Ver mais · raio {radius + RADIUS_STEP}km
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ========================
// STYLES
// ========================

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.7,
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
  },

  // Drag handle
  dragHandleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },

  // Interest chips
  interestRow: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.chip,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  interestChipActive: {
    backgroundColor: C.chipActive,
    borderColor: C.accent,
  },
  interestEmoji: {
    fontSize: 13,
  },
  interestLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
  },
  interestLabelActive: {
    color: C.text,
  },

  // AI tip
  aiTipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(46,139,106,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(46,139,106,0.25)',
  },
  aiTipText: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'italic',
    color: C.text,
    lineHeight: 18,
  },

  // List
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 2,
  },

  // Skeleton
  skeletonContainer: {
    gap: 10,
  },
  skeletonCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  skeletonThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  skeletonLines: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Recommendation card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  thumbContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  thumbPlaceholder: {
    backgroundColor: 'rgba(46,139,106,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 5,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryChip: {
    backgroundColor: C.chip,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 130,
  },
  categoryText: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '500',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(46,139,106,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 11,
    color: C.accent,
    fontWeight: '700',
  },
  iqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iqText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  regionText: {
    fontSize: 11,
    color: C.textMuted,
  },
  chevron: {
    marginLeft: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  emptyText: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
  },

  // Ver mais
  verMaisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(46,139,106,0.35)',
    backgroundColor: 'rgba(46,139,106,0.08)',
  },
  verMaisText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
  },
});
